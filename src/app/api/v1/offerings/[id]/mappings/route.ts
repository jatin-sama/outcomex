import { NextRequest, NextResponse } from "next/server";
import { INITIAL_POS, INITIAL_MAPPINGS } from "@/lib/data/initialData";
import { getDbClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json({
      offering_id: id,
      program_outcomes: INITIAL_POS,
      mappings: INITIAL_MAPPINGS,
    });
  }

  try {
    const db = await getDbClient();

    // 1. Resolve offering, course_id, and department_id
    const { data: offering } = await db
      .from("course_offerings")
      .select(`
        id,
        course_id,
        courses (
          department_id
        )
      `)
      .eq("id", id)
      .maybeSingle();

    const courseId = offering?.course_id;
    const c: any = offering?.courses;
    const deptId = Array.isArray(c) ? c[0]?.department_id : c?.department_id;

    // 2. Fetch program outcomes for the department
    let pos = INITIAL_POS;
    if (deptId) {
      const { data: dbPos } = await db
        .from("program_outcomes")
        .select("id, po_code, po_type, description, sort_order")
        .eq("department_id", deptId)
        .order("sort_order", { ascending: true });
      if (dbPos && dbPos.length > 0) {
        pos = dbPos as any;
      }
    }

    // 3. Fetch CO-PO mappings scoped to course outcomes of this course
    if (courseId) {
      const { data: dbMappings } = await db
        .from("course_po_mappings")
        .select(`
          mapping_strength,
          course_outcomes!inner (
            course_id,
            co_code
          ),
          program_outcomes!inner (
            po_code
          )
        `)
        .eq("course_outcomes.course_id", courseId);

      if (dbMappings && dbMappings.length > 0) {
        const reconstructed: Record<string, Record<string, number | null>> = {};
        for (const row of dbMappings as any[]) {
          const co = row.course_outcomes?.co_code;
          const po = row.program_outcomes?.po_code;
          if (co && po) {
            if (!reconstructed[co]) reconstructed[co] = {};
            reconstructed[co][po] = row.mapping_strength;
          }
        }
        if (Object.keys(reconstructed).length > 0) {
          return NextResponse.json({
            offering_id: id,
            program_outcomes: pos,
            mappings: reconstructed,
          });
        }
      }
    }

    return NextResponse.json({
      offering_id: id,
      program_outcomes: pos,
      mappings: INITIAL_MAPPINGS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load mappings" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid course offering ID." }, { status: 400 });
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.reason || "Unauthorized." }, { status: 403 });
    }

    const body = await request.json();
    const { mappings } = body;

    if (!mappings || typeof mappings !== "object") {
      return NextResponse.json(
        { error: "Invalid mappings payload provided." },
        { status: 400 }
      );
    }

    // Validate strength values: must be 1, 2, 3 or null/0
    const sanitized: Record<string, Record<string, number | null>> = {};

    for (const [coCode, poMap] of Object.entries(mappings)) {
      sanitized[coCode] = {};
      if (typeof poMap === "object" && poMap !== null) {
        for (const [poCode, val] of Object.entries(poMap as Record<string, unknown>)) {
          if (val === null || val === undefined || val === 0 || val === "") {
            sanitized[coCode][poCode] = null;
          } else {
            const num = Number(val);
            if (![1, 2, 3].includes(num)) {
              return NextResponse.json(
                { error: `Invalid mapping strength ${val} for ${coCode} -> ${poCode}. Must be 1, 2, or 3.` },
                { status: 400 }
              );
            }
            sanitized[coCode][poCode] = num;
          }
        }
      }
    }

    const db = await getDbClient();

    // Query course_id for offering
    const { data: offering } = await db
      .from("course_offerings")
      .select(`
        course_id,
        courses (
          department_id
        )
      `)
      .eq("id", id)
      .single();

    if (!offering?.course_id) {
      return NextResponse.json({ error: "Course offering not found." }, { status: 404 });
    }

    const courseId = offering.course_id;
    const c: any = offering.courses;
    const deptId = Array.isArray(c) ? c[0]?.department_id : c?.department_id;

    // Fetch CO IDs for course
    const { data: cos } = await db
      .from("course_outcomes")
      .select("id, co_code")
      .eq("course_id", courseId);

    const coMap = new Map<string, string>();
    (cos || []).forEach((c: any) => coMap.set(c.co_code.toUpperCase(), c.id));

    // Fetch PO IDs for department
    const { data: pos } = await db
      .from("program_outcomes")
      .select("id, po_code")
      .eq("department_id", deptId);

    const poMap = new Map<string, string>();
    (pos || []).forEach((p: any) => poMap.set(p.po_code.toUpperCase(), p.id));

    // Upsert mappings into course_po_mappings table
    const rowsToUpsert: any[] = [];
    for (const [coCode, poRatings] of Object.entries(sanitized)) {
      const coId = coMap.get(coCode.toUpperCase());
      if (!coId) continue;

      for (const [poCode, strength] of Object.entries(poRatings)) {
        const poId = poMap.get(poCode.toUpperCase());
        if (!poId) continue;

        rowsToUpsert.push({
          course_outcome_id: coId,
          program_outcome_id: poId,
          mapping_strength: strength,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertErr } = await db
        .from("course_po_mappings")
        .upsert(rowsToUpsert, { onConflict: "course_outcome_id,program_outcome_id" });

      if (upsertErr) {
        throw new Error(`Failed to persist mappings in database: ${upsertErr.message}`);
      }
    }

    // Record audit event
    try {
      await db.from("audit_logs").insert({
        profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
        action: "MAPPINGS_UPDATED",
        resource_type: "course_po_mappings",
        resource_id: id,
        payload: {
          offering_id: id,
          course_id: courseId,
          user_email: authCtx.user.email,
          mappings_count: rowsToUpsert.length,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      offering_id: id,
      count: rowsToUpsert.length,
      mappings: sanitized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update CO-PO mappings" },
      { status: 500 }
    );
  }
}
