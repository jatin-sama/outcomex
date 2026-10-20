import { NextRequest, NextResponse } from "next/server";
import { AttainmentEngine, ComponentConfig, SchemeConfig } from "@/lib/engine/attainmentEngine";
import { getDbClient } from "@/lib/supabase/admin";
import { offeringStore, isValidUuid, normalizeComponentKey } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";
import { INITIAL_COS, INITIAL_POS, INITIAL_MAPPINGS, INITIAL_SCHEMES } from "@/lib/data/initialData";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json(
      { error: `Invalid offering ID "${id}": must be a valid UUID.` },
      { status: 400 }
    );
  }

  try {
    // 1. Authenticate & Authorize
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to run attainment calculation." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized access to this course offering." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { schemeOverrides, studentMarks } = body;

    const db = await getDbClient();

    // 2. Fetch offering, course, department, and scheme
    const { data: offering, error: offErr } = await db
      .from("course_offerings")
      .select(`
        id,
        course_id,
        section,
        courses (
          id,
          course_code,
          course_name,
          department_id
        ),
        attainment_schemes (
          id,
          scheme_name,
          threshold_percent,
          level_3_threshold,
          level_2_threshold,
          direct_weight,
          indirect_weight,
          iam_weight,
          esam_weight,
          po_aggregation_method
        )
      `)
      .eq("id", id)
      .maybeSingle();

    const courseObj: any = offering?.courses;
    const courseId = Array.isArray(courseObj) ? courseObj[0]?.id : courseObj?.id;
    const deptId = Array.isArray(courseObj) ? courseObj[0]?.department_id : courseObj?.department_id || authCtx.department_id;
    const dbScheme: any = Array.isArray(offering?.attainment_schemes) ? offering?.attainment_schemes[0] : offering?.attainment_schemes;

    // 3. Resolve scheme configuration
    const schemeConfig: Partial<SchemeConfig> = {
      threshold_percent: Number(schemeOverrides?.threshold_percent ?? dbScheme?.threshold_percent ?? INITIAL_SCHEMES[0].threshold_percent),
      level_3_threshold: Number(schemeOverrides?.level_3_threshold ?? dbScheme?.level_3_threshold ?? INITIAL_SCHEMES[0].level_3_threshold),
      level_2_threshold: Number(schemeOverrides?.level_2_threshold ?? dbScheme?.level_2_threshold ?? INITIAL_SCHEMES[0].level_2_threshold),
      iam_weight: Number(schemeOverrides?.iam_weight ?? dbScheme?.iam_weight ?? INITIAL_SCHEMES[0].iam_weight),
      esam_weight: Number(schemeOverrides?.esam_weight ?? dbScheme?.esam_weight ?? INITIAL_SCHEMES[0].esam_weight),
      direct_weight: Number(schemeOverrides?.direct_weight ?? dbScheme?.direct_weight ?? INITIAL_SCHEMES[0].direct_weight),
      indirect_weight: Number(schemeOverrides?.indirect_weight ?? dbScheme?.indirect_weight ?? INITIAL_SCHEMES[0].indirect_weight),
      po_aggregation_method: (schemeOverrides?.po_aggregation_method ?? dbScheme?.po_aggregation_method ?? "WEIGHTED_AVERAGE") as any,
    };

    const engine = new AttainmentEngine(schemeConfig);

    // 4. Fetch Course Outcomes (COs) for this course
    let coCodes: string[] = [];
    const coIdMap = new Map<string, string>(); // co_id -> co_code

    if (courseId) {
      const { data: dbCos } = await db
        .from("course_outcomes")
        .select("id, co_code, sort_order")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });

      if (dbCos && dbCos.length > 0) {
        coCodes = dbCos.map((c: any) => c.co_code);
        dbCos.forEach((c: any) => coIdMap.set(c.id, c.co_code));
      }
    }

    if (coCodes.length === 0) {
      coCodes = INITIAL_COS.map((c) => c.co_code);
    }

    // 5. Fetch Assessment Components for this offering
    const { data: dbComps } = await db
      .from("assessment_components")
      .select(`
        id,
        component_name,
        category,
        max_marks,
        sort_order,
        assessment_component_co_mappings (
          course_outcome_id
        )
      `)
      .eq("course_offering_id", id)
      .order("sort_order", { ascending: true });

    let componentConfigs: ComponentConfig[] = [];

    if (dbComps && dbComps.length > 0) {
      componentConfigs = dbComps.map((c: any) => {
        const normKey = normalizeComponentKey(c.component_name);
        let mappedCo: string | undefined = undefined;

        // Check if there is an explicit DB component-to-CO mapping
        const mappings: any[] = c.assessment_component_co_mappings || [];
        if (mappings.length > 0 && mappings[0]?.course_outcome_id) {
          mappedCo = coIdMap.get(mappings[0].course_outcome_id);
        }

        // Fallback to name heuristic if not explicitly joined
        if (!mappedCo) {
          const match = c.component_name.match(/CO[1-6]/i);
          if (match) mappedCo = match[0].toUpperCase();
        }

        return {
          key: normKey,
          label: c.component_name,
          category: c.category || "MID_TERM_1",
          max_marks: Number(c.max_marks),
          co_code: mappedCo,
        };
      });
    } else {
      // Standard 60/40 component config
      componentConfigs = [
        { key: "mt1_co1", label: "MT1 CO1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" },
        { key: "mt1_co2", label: "MT1 CO2", category: "MID_TERM_1", max_marks: 10, co_code: "CO2" },
        { key: "mt1_co3", label: "MT1 CO3", category: "MID_TERM_1", max_marks: 10, co_code: "CO3" },
        { key: "mt2_co4", label: "MT2 CO4", category: "MID_TERM_2", max_marks: 10, co_code: "CO4" },
        { key: "mt2_co5", label: "MT2 CO5", category: "MID_TERM_2", max_marks: 10, co_code: "CO5" },
        { key: "mt2_co6", label: "MT2 CO6", category: "MID_TERM_2", max_marks: 10, co_code: "CO6" },
        { key: "ta", label: "TA", category: "TEACHER_ASSESSMENT", max_marks: 10 },
        { key: "ese_co1", label: "ESE CO1", category: "END_SEM", max_marks: 10, co_code: "CO1" },
        { key: "ese_co2", label: "ESE CO2", category: "END_SEM", max_marks: 12, co_code: "CO2" },
        { key: "ese_co3", label: "ESE CO3", category: "END_SEM", max_marks: 12, co_code: "CO3" },
        { key: "ese_co4", label: "ESE CO4", category: "END_SEM", max_marks: 10, co_code: "CO4" },
        { key: "ese_co5", label: "ESE CO5", category: "END_SEM", max_marks: 8, co_code: "CO5" },
        { key: "ese_co6", label: "ESE CO6", category: "END_SEM", max_marks: 8, co_code: "CO6" },
      ];
    }

    // 6. Fetch POs and PSOs for the department
    let poList: Array<{ po_code: string; po_type: "PO" | "PSO" }> = [];
    const { data: dbPos } = await db
      .from("program_outcomes")
      .select("id, po_code, po_type, sort_order")
      .eq("department_id", deptId)
      .order("sort_order", { ascending: true });

    if (dbPos && dbPos.length > 0) {
      poList = dbPos.map((p: any) => ({
        po_code: p.po_code,
        po_type: (p.po_type as any) || "PO",
      }));
    } else {
      poList = INITIAL_POS.map((p) => ({ po_code: p.po_code, po_type: p.po_type }));
    }

    // 7. Fetch CO-to-PO Mappings from database
    let mappings: Record<string, Record<string, number | null>> = {};
    const { data: dbMappings } = await db
      .from("course_po_mappings")
      .select(`
        mapping_strength,
        course_outcomes (
          course_id,
          co_code
        ),
        program_outcomes (
          po_code
        )
      `);

    if (dbMappings && dbMappings.length > 0) {
      for (const m of dbMappings as any[]) {
        const cCourseId = m.course_outcomes?.course_id;
        if (!courseId || cCourseId === courseId) {
          const co = m.course_outcomes?.co_code;
          const po = m.program_outcomes?.po_code;
          if (co && po) {
            if (!mappings[co]) mappings[co] = {};
            mappings[co][po] = m.mapping_strength;
          }
        }
      }
    }

    if (Object.keys(mappings).length === 0) {
      mappings = INITIAL_MAPPINGS;
    }

    // 8. Fetch Indirect Survey Ratings from database
    let indirectMap: Record<string, number> | undefined = undefined;
    const { data: dbIndirect } = await db
      .from("indirect_attainment")
      .select(`
        attainment_level,
        course_outcomes (
          co_code
        )
      `)
      .eq("course_offering_id", id);

    if (dbIndirect && dbIndirect.length > 0) {
      indirectMap = {};
      for (const row of dbIndirect as any[]) {
        const co = row.course_outcomes?.co_code;
        if (co) {
          indirectMap[co] = Number(row.attainment_level);
        }
      }
    }

    // 9. Load Student Marks from database
    let studentsToEvaluate = Array.isArray(studentMarks) ? studentMarks : null;
    if (!studentsToEvaluate || studentsToEvaluate.length === 0) {
      const { marks } = await offeringStore.getMarks(id);
      studentsToEvaluate = marks;
    }

    // 10. Execute Attainment Engine
    const calculationResult = engine.calculate(
      studentsToEvaluate,
      componentConfigs,
      coCodes,
      poList,
      mappings,
      indirectMap
    );

    // 11. Record durable audit log in database
    try {
      await db.from("audit_logs").insert({
        profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
        action: "ATTAINMENT_CALCULATED",
        resource_type: "calculation_runs",
        resource_id: id,
        payload: {
          offering_id: id,
          user_email: authCtx.user.email,
          student_count: studentsToEvaluate.length,
          components_count: componentConfigs.length,
          po_aggregation_method: schemeConfig.po_aggregation_method,
          average_attainment: calculationResult.summary.average_final_co_attainment,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      offering_id: id,
      calculated_at: new Date().toISOString(),
      scheme_used: schemeConfig,
      ...calculationResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute calculation engine" },
      { status: 500 }
    );
  }
}
