import { NextRequest, NextResponse } from "next/server";
import { INITIAL_POS, INITIAL_MAPPINGS } from "@/lib/data/initialData";

let currentMappings: Record<string, Record<string, Record<string, number | null>>> = {
  "o0000000-0000-0000-0000-000000000001": JSON.parse(JSON.stringify(INITIAL_MAPPINGS)),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mappings = currentMappings[id] || INITIAL_MAPPINGS;

  return NextResponse.json({
    offering_id: id,
    program_outcomes: INITIAL_POS,
    mappings,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
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

    currentMappings[id] = sanitized;

    return NextResponse.json({
      success: true,
      offering_id: id,
      mappings: sanitized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update mappings" },
      { status: 500 }
    );
  }
}
