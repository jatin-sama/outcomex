import { NextRequest, NextResponse } from "next/server";
import { REFERENCE_MARKS, StudentMarksRecord } from "@/lib/data/referenceMarks";
import { INITIAL_ASSESSMENTS } from "@/lib/data/initialData";

let currentMarksStore: Record<string, StudentMarksRecord[]> = {
  "o0000000-0000-0000-0000-000000000001": JSON.parse(JSON.stringify(REFERENCE_MARKS)),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const marks = currentMarksStore[id] || [...REFERENCE_MARKS];

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
