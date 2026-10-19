import { NextRequest, NextResponse } from "next/server";
import { INITIAL_COS } from "@/lib/data/initialData";
import { getDbClient } from "@/lib/supabase/admin";

export interface IndirectCORating {
  co_code: string;
  survey_score: number; // Raw survey score (e.g. 1-5 or 0-3 scale)
  normalized_level: number; // 0.0 - 3.0 attainment level
  sample_size: number; // e.g. 78 students responded
  question_prompt?: string;
}

let currentIndirectRatings: Record<string, IndirectCORating[]> = {
  "o0000000-0000-0000-0000-000000000001": INITIAL_COS.map((co) => ({
    co_code: co.co_code,
    survey_score: 4.5,
    normalized_level: 3.0,
    sample_size: 78,
    question_prompt: `Rate your confidence in applying knowledge related to ${co.description}`,
  })),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let ratings = currentIndirectRatings[id] || currentIndirectRatings["o0000000-0000-0000-0000-000000000001"];

  try {
    const db = await getDbClient();
    const { data: dbIndirect, error } = await db
      .from("indirect_attainment")
      .select(`
        id,
        attainment_level,
        survey_sample_size,
        course_outcomes (
          co_code,
          description
        )
      `)
      .eq("course_offering_id", id);

    if (!error && dbIndirect && dbIndirect.length > 0) {
      ratings = dbIndirect.map((row: any) => ({
        co_code: row.course_outcomes?.co_code || "CO",
        survey_score: row.attainment_level * 1.5, // 0-3 mapped to 0-4.5 scale
        normalized_level: Number(row.attainment_level),
        sample_size: row.survey_sample_size || 78,
        question_prompt: row.course_outcomes?.description || "",
      }));
      currentIndirectRatings[id] = ratings;
    }
  } catch {
    // Fallback to memory
  }

  return NextResponse.json({
    offering_id: id,
    scale: "3_POINT_RUBRIC",
    max_level: 3.0,
    survey_scale_max: 5.0,
    ratings,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { ratings } = body;

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return NextResponse.json(
        { error: "Valid survey ratings array is required." },
        { status: 400 }
      );
    }

    const sanitized: IndirectCORating[] = [];
    for (const r of ratings) {
      const level = Math.min(3.0, Math.max(0.0, Number(r.normalized_level ?? 3.0)));
      sanitized.push({
        co_code: String(r.co_code).trim().toUpperCase(),
        survey_score: Number(r.survey_score ?? 4.5),
        normalized_level: Math.round(level * 100) / 100,
        sample_size: Number(r.sample_size ?? 78),
        question_prompt: r.question_prompt || "",
      });
    }

    currentIndirectRatings[id] = sanitized;

    // Persist to Supabase indirect_attainment table
    try {
      const db = await getDbClient();
      const { data: cos } = await db.from("course_outcomes").select("id, co_code");

      if (cos && cos.length > 0) {
        const coMap = new Map(cos.map((c: any) => [c.co_code, c.id]));
        for (const item of sanitized) {
          const coId = coMap.get(item.co_code);
          if (coId) {
            await db.from("indirect_attainment").upsert({
              course_offering_id: id,
              course_outcome_id: coId,
              attainment_level: item.normalized_level,
              survey_sample_size: item.sample_size,
            }, { onConflict: "course_offering_id,course_outcome_id" });
          }
        }
      }
    } catch {
      // Fallback
    }

    // Audit log
    try {
      const { logAuditEvent } = await import("@/lib/audit/auditLogger");
      logAuditEvent({
        offering_id: id,
        user_email: request.headers.get("x-user-email") || "faculty@pce.edu.in",
        action: "COURSE_CREATED",
        resource_type: "indirect_attainment",
        payload: {
          co_count: sanitized.length,
          average_level: sanitized.reduce((a, b) => a + b.normalized_level, 0) / sanitized.length,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      offering_id: id,
      count: sanitized.length,
      ratings: sanitized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save indirect survey ratings" },
      { status: 500 }
    );
  }
}
