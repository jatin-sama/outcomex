import { NextRequest, NextResponse } from "next/server";
import { INITIAL_ASSESSMENTS } from "@/lib/data/initialData";
import { AssessmentComponent } from "@/types/database";

let currentAssessments: Record<string, AssessmentComponent[]> = {
  "o0000000-0000-0000-0000-000000000001": [...INITIAL_ASSESSMENTS],
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const components = currentAssessments[id] || [...INITIAL_ASSESSMENTS];

  return NextResponse.json({
    offering_id: id,
    count: components.length,
    components: components.sort((a, b) => a.sort_order - b.sort_order),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { components } = body;

    if (!Array.isArray(components) || components.length === 0) {
      return NextResponse.json(
        { error: "At least one assessment component is required." },
        { status: 400 }
      );
    }

    const sanitized: AssessmentComponent[] = [];
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
        id: c.id || `ac-${id}-${i + 1}`,
        course_offering_id: id,
        category: c.category || "MID_TERM_1",
        component_name: c.component_name || `Component ${i + 1}`,
        max_marks: maxMarks,
        sort_order: i + 1,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    currentAssessments[id] = sanitized;

    return NextResponse.json({
      success: true,
      offering_id: id,
      count: sanitized.length,
      components: sanitized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update assessment components" },
      { status: 500 }
    );
  }
}
