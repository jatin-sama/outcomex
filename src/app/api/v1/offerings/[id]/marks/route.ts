import { NextRequest, NextResponse } from "next/server";
import { offeringStore } from "@/lib/domain/offeringStore";
import { INITIAL_ASSESSMENTS } from "@/lib/data/initialData";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { marks, count } = await offeringStore.getMarks(id);

    return NextResponse.json({
      offering_id: id,
      count,
      components: INITIAL_ASSESSMENTS,
      marks,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load marks" },
      { status: 500 }
    );
  }
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

    const result = await offeringStore.saveMarks(id, updatedMarks);

    return NextResponse.json({
      success: true,
      offering_id: id,
      saved_count: result.savedCount,
      has_validation_warnings: result.warnings.length > 0,
      validation_warnings: result.warnings,
      last_saved_at: result.timestamp,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update marks grid" },
      { status: 500 }
    );
  }
}
