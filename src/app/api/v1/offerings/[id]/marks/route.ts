import { NextRequest, NextResponse } from "next/server";
import { REFERENCE_MARKS, StudentMarksRecord } from "@/lib/data/referenceMarks";
import { INITIAL_ASSESSMENTS } from "@/lib/data/initialData";
import { getDbClient } from "@/lib/supabase/admin";

let currentMarksStore: Record<string, StudentMarksRecord[]> = {
  "o0000000-0000-0000-0000-000000000001": JSON.parse(JSON.stringify(REFERENCE_MARKS)),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let marks = currentMarksStore[id] || [...REFERENCE_MARKS];

  try {
    const db = await getDbClient();
    // Fetch assessment components for this offering
    const { data: dbComps } = await db
      .from("assessment_components")
      .select("id, component_name")
      .eq("course_offering_id", id);

    // Fetch marks joined with enrollments
    const { data: dbMarks, error } = await db
      .from("student_marks")
      .select(`
        id,
        marks_obtained,
        status,
        assessment_component_id,
        enrollments!inner (
          id,
          roll_no,
          course_offering_id,
          students (
            student_name
          )
        )
      `)
      .eq("enrollments.course_offering_id", id);

    if (!error && dbMarks && dbMarks.length > 0 && dbComps) {
      const compMap = new Map(dbComps.map((c: any) => [c.id, c.component_name]));
      const studentMap = new Map<string, StudentMarksRecord>();

      for (const row of dbMarks as any[]) {
        const roll = row.enrollments?.roll_no;
        const name = row.enrollments?.students?.student_name || `Student ${roll}`;
        const compName = compMap.get(row.assessment_component_id) || row.assessment_component_id;

        if (!studentMap.has(roll)) {
          studentMap.set(roll, {
            student_id: row.enrollments?.id || row.id || `s-${roll}`,
            roll_no: roll,
            student_name: name,
            marks: {},
          });
        }

        const rec = studentMap.get(roll)!;
        rec.marks[compName] = row.status === "ABSENT" ? "AB" : row.marks_obtained;
      }

      marks = Array.from(studentMap.values());
      currentMarksStore[id] = marks;
    }
  } catch {
    // Fallback to memory store
  }

  return NextResponse.json({
    offering_id: id,
    count: marks.length,
    components: INITIAL_ASSESSMENTS,
    marks,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { updatedMarks } = body;

    if (!Array.isArray(updatedMarks)) {
      return NextResponse.json(
        { error: "Invalid updatedMarks payload. Expected an array of student marks." },
        { status: 400 }
      );
    }

    // Build max marks map for validation
    const maxMarksMap: Record<string, number> = {
      mt1_co1: 10,
      mt1_co2: 10,
      mt1_co3: 10,
      mt2_co4: 10,
      mt2_co5: 10,
      mt2_co6: 10,
      ese_co1: 10,
      ese_co2: 12,
      ese_co3: 12,
      ese_co4: 10,
      ese_co5: 8,
      ese_co6: 8,
      ta: 10,
    };

    const validationWarnings: Array<{ roll_no: string; component: string; value: number; max: number }> = [];

    // Check for values exceeding max marks
    for (const record of updatedMarks) {
      if (record.marks && typeof record.marks === "object") {
        for (const [comp, val] of Object.entries(record.marks)) {
          if (typeof val === "number") {
            const max = maxMarksMap[comp] ?? 10;
            if (val > max) {
              validationWarnings.push({
                roll_no: record.roll_no,
                component: comp,
                value: val,
                max,
              });
            }
          }
        }
      }
    }

    currentMarksStore[id] = updatedMarks;

    // Persist to Supabase database
    try {
      const db = await getDbClient();
      const { data: enrollments } = await db
        .from("enrollments")
        .select("id, roll_no")
        .eq("course_offering_id", id);

      const { data: components } = await db
        .from("assessment_components")
        .select("id, component_name")
        .eq("course_offering_id", id);

      if (enrollments && components && enrollments.length > 0 && components.length > 0) {
        const enrollMap = new Map(enrollments.map((e: any) => [e.roll_no, e.id]));
        const compMap = new Map(components.map((c: any) => [c.component_name, c.id]));

        const marksToUpsert: Array<{
          enrollment_id: string;
          assessment_component_id: string;
          marks_obtained: number | null;
          status: string;
        }> = [];

        for (const record of updatedMarks) {
          const enrollId = enrollMap.get(record.roll_no);
          if (!enrollId) continue;

          for (const [compName, val] of Object.entries(record.marks || {})) {
            const compId = compMap.get(compName);
            if (!compId) continue;

            const isAbsent = val === "AB" || val === "A";
            const numVal = typeof val === "number" ? val : null;

            marksToUpsert.push({
              enrollment_id: enrollId,
              assessment_component_id: compId,
              marks_obtained: isAbsent ? null : numVal,
              status: isAbsent ? "ABSENT" : "PRESENT",
            });
          }
        }

        if (marksToUpsert.length > 0) {
          await db
            .from("student_marks")
            .upsert(marksToUpsert, { onConflict: "enrollment_id,assessment_component_id" });
        }
      }
    } catch {
      // Graceful fallback to memory store
    }

    return NextResponse.json({
      success: true,
      offering_id: id,
      saved_count: updatedMarks.length,
      has_validation_warnings: validationWarnings.length > 0,
      validation_warnings: validationWarnings,
      last_saved_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update marks grid" },
      { status: 500 }
    );
  }
}
