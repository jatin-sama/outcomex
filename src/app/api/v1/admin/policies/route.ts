import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const db = await getDbClient();
    const { data, error } = await db
      .from("attainment_schemes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const config = data.config_json || {};
      return NextResponse.json({
        poAggregationMode: data.po_aggregation_method === "MAPPING_AVERAGE" ? "reference" : "weighted",
        studentThreshold: Number(data.threshold_percent) || 45,
        level2Boundary: Number(data.level_2_threshold) || 45,
        level3Boundary: Number(data.level_3_threshold) || 55,
        absenteePolicy: config.absenteePolicy || "zero",
        directWeight: Number(data.direct_weight) || 0.8,
        indirectWeight: Number(data.indirect_weight) || 0.2,
        iamWeight: Number(data.iam_weight) || 0.4,
        esamWeight: Number(data.esam_weight) || 0.6,
        isApproved: data.is_approved ?? true,
      });
    }

    // Default institutional policy fallback
    return NextResponse.json({
      poAggregationMode: "reference",
      studentThreshold: 45,
      level2Boundary: 45,
      level3Boundary: 55,
      absenteePolicy: "zero",
      directWeight: 0.8,
      indirectWeight: 0.2,
      iamWeight: 0.4,
      esamWeight: 0.6,
      isApproved: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        poAggregationMode: "reference",
        studentThreshold: 45,
        level2Boundary: 45,
        level3Boundary: 55,
        absenteePolicy: "zero",
        directWeight: 0.8,
        indirectWeight: 0.2,
        iamWeight: 0.4,
        esamWeight: 0.6,
        isApproved: true,
      },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      poAggregationMode,
      studentThreshold,
      level2Boundary,
      level3Boundary,
      absenteePolicy,
    } = body;

    const db = await getDbClient();

    const poAggMethod = poAggregationMode === "reference" ? "MAPPING_AVERAGE" : "WEIGHTED_AVERAGE";

    // Query active scheme
    const { data: existingScheme } = await db
      .from("attainment_schemes")
      .select("id, department_id, config_json")
      .limit(1)
      .maybeSingle();

    if (existingScheme?.id) {
      const mergedConfig = {
        ...(existingScheme.config_json || {}),
        absenteePolicy: absenteePolicy || "zero",
        updatedAt: new Date().toISOString(),
      };

      await db
        .from("attainment_schemes")
        .update({
          po_aggregation_method: poAggMethod,
          threshold_percent: studentThreshold ?? 45,
          level_2_threshold: level2Boundary ?? 45,
          level_3_threshold: level3Boundary ?? 55,
          config_json: mergedConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingScheme.id);

      // Audit log
      try {
        await db.from("audit_logs").insert({
          action: "UPDATE_POLICY",
          entity: "attainment_schemes",
          entity_id: existingScheme.id,
          payload: {
            poAggregationMode,
            studentThreshold,
            level2Boundary,
            level3Boundary,
            absenteePolicy,
          },
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: "Academic policies and thresholds updated successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update academic policies." },
      { status: 500 }
    );
  }
}
