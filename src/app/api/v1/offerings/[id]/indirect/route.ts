import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";

export interface IndirectCORating {
  co_code: string;
  course_outcome_id?: string;
  survey_score: number; // Raw survey score (e.g. 1-5 scale)
  normalized_level: number; // 0.0 - 3.0 attainment level
  sample_size: number;
  question_prompt?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json({
      offering_id: id,
      scale: "3_POINT_RUBRIC",
      max_level: 3.0,
      survey_scale_max: 5.0,
      has_data: false,
      ratings: [],
    });
  }

  try {
    const db = await getDbClient();
    const { data: dbIndirect, error } = await db
      .from("indirect_attainment")
      .select(`
        id,
        attainment_level,
        survey_sample_size,
        course_outcome_id,
        course_outcomes (
          co_code,
          description
        )
      `)
      .eq("course_offering_id", id);

    if (!error && dbIndirect && dbIndirect.length > 0) {
      const ratings: IndirectCORating[] = dbIndirect.map((row: any) => ({
        co_code: row.course_outcomes?.co_code || "CO",
        course_outcome_id: row.course_outcome_id,
        survey_score: Math.round(Number(row.attainment_level) * 1.666 * 100) / 100, // 0-3 mapped to 0-5 scale
        normalized_level: Number(row.attainment_level),
        sample_size: row.survey_sample_size || 0,
        question_prompt: row.course_outcomes?.description || "",
      }));

      return NextResponse.json({
        offering_id: id,
        scale: "3_POINT_RUBRIC",
        max_level: 3.0,
        survey_scale_max: 5.0,
        has_data: true,
        ratings,
      });
    }

    // Explicit empty state when no survey data exists (never fabricate fake results)
    return NextResponse.json({
      offering_id: id,
      scale: "3_POINT_RUBRIC",
      max_level: 3.0,
      survey_scale_max: 5.0,
      has_data: false,
      ratings: [],
      message: "No indirect exit survey data recorded for this offering.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load indirect survey data" },
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
    const { ratings } = body;

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return NextResponse.json(
        { error: "Valid survey ratings array is required." },
        { status: 400 }
      );
    }

    const db = await getDbClient();

    // Query course_id for offering
    const { data: offering } = await db
      .from("course_offerings")
      .select("course_id")
      .eq("id", id)
      .single();

    if (!offering?.course_id) {
      return NextResponse.json({ error: "Course offering not found." }, { status: 404 });
    }

    // Query COs for the course
    const { data: cos } = await db
      .from("course_outcomes")
      .select("id, co_code")
      .eq("course_id", offering.course_id);

    const coMap = new Map<string, string>();
    (cos || []).forEach((c: any) => coMap.set(c.co_code.toUpperCase(), c.id));

    const rowsToUpsert: any[] = [];
    const sanitized: IndirectCORating[] = [];

    for (const r of ratings) {
      const coCode = String(r.co_code).trim().toUpperCase();
      const coId = r.course_outcome_id || coMap.get(coCode);
      if (!coId) continue;

      const level = Math.min(3.0, Math.max(0.0, Number(r.normalized_level ?? 3.0)));
      const sampleSize = Number(r.sample_size ?? 0);

      rowsToUpsert.push({
        course_offering_id: id,
        course_outcome_id: coId,
        attainment_level: Math.round(level * 100) / 100,
        survey_sample_size: sampleSize,
        updated_at: new Date().toISOString(),
      });

      sanitized.push({
        co_code: coCode,
        course_outcome_id: coId,
        survey_score: Number(r.survey_score ?? level * 1.666),
        normalized_level: Math.round(level * 100) / 100,
        sample_size: sampleSize,
        question_prompt: r.question_prompt || "",
      });
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertErr } = await db
        .from("indirect_attainment")
        .upsert(rowsToUpsert, { onConflict: "course_offering_id,course_outcome_id" });

      if (upsertErr) {
        throw new Error(`Failed to save indirect attainment: ${upsertErr.message}`);
      }
    }

    // Record audit event
    try {
      await db.from("audit_logs").insert({
        profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
        action: "INDIRECT_ATTAINMENT_SAVED",
        resource_type: "indirect_attainment",
        resource_id: id,
        payload: {
          offering_id: id,
          user_email: authCtx.user.email,
          ratings_count: rowsToUpsert.length,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      offering_id: id,
      has_data: true,
      count: sanitized.length,
      ratings: sanitized,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save indirect survey data" },
      { status: 500 }
    );
  }
}
