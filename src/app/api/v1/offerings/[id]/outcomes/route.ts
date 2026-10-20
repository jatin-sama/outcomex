import { NextRequest, NextResponse } from "next/server";
import { INITIAL_COS } from "@/lib/data/initialData";
import { CourseOutcome } from "@/types/database";
import { getDbClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json({ offering_id: id, count: INITIAL_COS.length, outcomes: INITIAL_COS });
  }

  try {
    const db = await getDbClient();

    // 1. Resolve course_id for this offering
    const { data: offering } = await db
      .from("course_offerings")
      .select("course_id")
      .eq("id", id)
      .maybeSingle();

    if (offering?.course_id) {
      const { data: dbOutcomes, error } = await db
        .from("course_outcomes")
        .select("*")
        .eq("course_id", offering.course_id)
        .order("sort_order", { ascending: true });

      if (!error && dbOutcomes && dbOutcomes.length > 0) {
        return NextResponse.json({
          offering_id: id,
          course_id: offering.course_id,
          count: dbOutcomes.length,
          outcomes: dbOutcomes,
        });
      }
    }

    return NextResponse.json({
      offering_id: id,
      count: INITIAL_COS.length,
      outcomes: INITIAL_COS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load course outcomes" },
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
    const { outcomes } = body;

    if (!Array.isArray(outcomes) || outcomes.length === 0) {
      return NextResponse.json(
        { error: "At least one Course Outcome (CO) is required." },
        { status: 400 }
      );
    }

    const db = await getDbClient();

    // Resolve course_id
    const { data: offering, error: offErr } = await db
      .from("course_offerings")
      .select("course_id")
      .eq("id", id)
      .single();

    if (offErr || !offering?.course_id) {
      return NextResponse.json({ error: "Course offering not found in database." }, { status: 404 });
    }

    const courseId = offering.course_id;
    const seenCodes = new Set<string>();
    const rowsToUpsert: any[] = [];

    for (let i = 0; i < outcomes.length; i++) {
      const co = outcomes[i];
      const code = (co.co_code || `CO${i + 1}`).trim().toUpperCase();

      if (seenCodes.has(code)) {
        return NextResponse.json(
          { error: `Duplicate Course Outcome code detected: "${code}". Codes must be distinct.` },
          { status: 400 }
        );
      }
      seenCodes.add(code);

      rowsToUpsert.push({
        course_id: courseId,
        co_code: code,
        description: co.description || `Course Outcome ${i + 1}`,
        sort_order: i + 1,
        updated_at: new Date().toISOString(),
      });
    }

    const { data: savedOutcomes, error: saveErr } = await db
      .from("course_outcomes")
      .upsert(rowsToUpsert, { onConflict: "course_id,co_code" })
      .select();

    if (saveErr) {
      throw new Error(`Failed to save outcomes: ${saveErr.message}`);
    }

    return NextResponse.json({
      success: true,
      offering_id: id,
      course_id: courseId,
      count: savedOutcomes?.length || rowsToUpsert.length,
      outcomes: savedOutcomes || rowsToUpsert,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update Course Outcomes" },
      { status: 500 }
    );
  }
}
