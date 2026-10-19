import { NextRequest, NextResponse } from "next/server";
import { INITIAL_POS, INITIAL_MAPPINGS } from "@/lib/data/initialData";
import { getDbClient } from "@/lib/supabase/admin";

let currentMappings: Record<string, Record<string, Record<string, number | null>>> = {
  "o0000000-0000-0000-0000-000000000001": JSON.parse(JSON.stringify(INITIAL_MAPPINGS)),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let mappings = currentMappings[id] || INITIAL_MAPPINGS;

  try {
    const db = await getDbClient();
    const { data: dbMappings, error } = await db
      .from("course_po_mappings")
      .select(`
        mapping_strength,
        course_outcomes (
          co_code
        ),
        program_outcomes (
          po_code
        )
      `);

    if (!error && dbMappings && dbMappings.length > 0) {
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
        mappings = reconstructed;
        currentMappings[id] = reconstructed;
      }
    }
  } catch {
    // Fallback to memory
  }

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

    // Persist to Supabase database
    try {
      const db = await getDbClient();
      const { data: cos } = await db.from("course_outcomes").select("id, co_code");
      const { data: pos } = await db.from("program_outcomes").select("id, po_code");

      if (cos && pos && cos.length > 0 && pos.length > 0) {
        const coMap = new Map(cos.map((c: any) => [c.co_code, c.id]));
        const poMap = new Map(pos.map((p: any) => [p.po_code, p.id]));

        const mappingsToUpsert: Array<{
          course_outcome_id: string;
          program_outcome_id: string;
          mapping_strength: number;
        }> = [];

        for (const [coCode, pMap] of Object.entries(sanitized)) {
          const coId = coMap.get(coCode);
          if (!coId) continue;

          for (const [poCode, strength] of Object.entries(pMap)) {
            const poId = poMap.get(poCode);
            if (!poId || strength === null) continue;

            mappingsToUpsert.push({
              course_outcome_id: coId,
              program_outcome_id: poId,
              mapping_strength: strength,
            });
          }
        }

        if (mappingsToUpsert.length > 0) {
          await db
            .from("course_po_mappings")
            .upsert(mappingsToUpsert, { onConflict: "course_outcome_id,program_outcome_id" });
        }
      }
    } catch {
      // Fallback
    }

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
