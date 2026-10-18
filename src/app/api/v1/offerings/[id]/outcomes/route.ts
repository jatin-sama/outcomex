import { NextRequest, NextResponse } from "next/server";
import { INITIAL_COS } from "@/lib/data/initialData";
import { CourseOutcome } from "@/types/database";

// In-memory state for offerings outcomes
let currentOutcomes: Record<string, CourseOutcome[]> = {
  "o0000000-0000-0000-0000-000000000001": [...INITIAL_COS],
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const outcomes = currentOutcomes[id] || [...INITIAL_COS];
  return NextResponse.json({
    offering_id: id,
    count: outcomes.length,
    outcomes: outcomes.sort((a, b) => a.sort_order - b.sort_order),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { outcomes } = body;

    if (!Array.isArray(outcomes) || outcomes.length === 0) {
      return NextResponse.json(
        { error: "At least one Course Outcome (CO) is required." },
        { status: 400 }
      );
    }

    // Validate outcomes structure
    const seenCodes = new Set<string>();
    const sanitized: CourseOutcome[] = [];

    for (let i = 0; i < outcomes.length; i++) {
      const co = outcomes[i];
      const code = (co.co_code || `CO${i + 1}`).trim().toUpperCase();

      if (seenCodes.has(code)) {
        return NextResponse.json(
          { error: `Duplicate CO code detected: ${code}` },
          { status: 400 }
        );
      }
      seenCodes.add(code);

      sanitized.push({
        id: co.id || `co-${id}-${code.toLowerCase()}`,
        course_id: co.course_id || "c0000000-0000-0000-0000-000000000001",
        co_code: code,
        description: co.description || "",
        sort_order: i + 1,
        created_at: co.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    currentOutcomes[id] = sanitized;

    return NextResponse.json({
      success: true,
      offering_id: id,
      count: sanitized.length,
      outcomes: sanitized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
