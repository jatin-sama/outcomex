import { NextRequest, NextResponse } from "next/server";
import { INITIAL_ASSESSMENTS } from "@/lib/data/initialData";
import { AssessmentComponent } from "@/types/database";
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
      count: INITIAL_ASSESSMENTS.length,
      components: INITIAL_ASSESSMENTS,
    });
  }

  try {
    const db = await getDbClient();
    const { data: dbComps, error } = await db
      .from("assessment_components")
      .select("*")
      .eq("course_offering_id", id)
      .order("sort_order", { ascending: true });

    if (!error && dbComps && dbComps.length > 0) {
      return NextResponse.json({
        offering_id: id,
        count: dbComps.length,
        components: dbComps,
      });
    }

    return NextResponse.json({
      offering_id: id,
      count: INITIAL_ASSESSMENTS.length,
      components: INITIAL_ASSESSMENTS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load assessment components" },
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
    const { components } = body;

    if (!Array.isArray(components) || components.length === 0) {
      return NextResponse.json(
        { error: "At least one assessment component is required." },
        { status: 400 }
      );
    }

    const sanitized: any[] = [];
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      const maxMarks = Number(c.max_marks);

      if (isNaN(maxMarks) || maxMarks <= 0) {
        return NextResponse.json(
          { error: `Component "${c.component_name || i + 1}" must have maximum marks greater than zero.` },
          { status: 400 }
        );
      }

      sanitized.push({
        id: c.id && isValidUuid(c.id) ? c.id : crypto.randomUUID(),
        course_offering_id: id,
        category: c.category || "MID_TERM_1",
        component_name: c.component_name || `Component ${i + 1}`,
        max_marks: maxMarks,
        sort_order: i + 1,
        updated_at: new Date().toISOString(),
      });
    }

    const db = await getDbClient();

    // Persist to Supabase assessment_components table
    const { data: savedComps, error } = await db
      .from("assessment_components")
      .upsert(sanitized, { onConflict: "course_offering_id,component_name" })
      .select();

    if (error) {
      throw new Error(`Failed to persist assessment components in database: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      offering_id: id,
      count: savedComps?.length || sanitized.length,
      components: savedComps || sanitized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update assessment components" },
      { status: 500 }
    );
  }
}
