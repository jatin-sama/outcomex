import { NextRequest, NextResponse } from "next/server";
import { AttainmentEngine, ComponentConfig } from "@/lib/engine/attainmentEngine";
import { REFERENCE_MARKS } from "@/lib/data/referenceMarks";
import { INITIAL_ASSESSMENTS, INITIAL_POS, INITIAL_MAPPINGS, INITIAL_COS } from "@/lib/data/initialData";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const { schemeOverrides, studentMarks } = body;

    const engine = new AttainmentEngine(schemeOverrides);

    const studentsToEvaluate = Array.isArray(studentMarks) ? studentMarks : REFERENCE_MARKS;

    // Component configurations mapped to COs
    const componentConfigs: ComponentConfig[] = [
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

    const coCodes = INITIAL_COS.map((c) => c.co_code);
    const poList = INITIAL_POS.map((p) => ({ po_code: p.po_code, po_type: p.po_type }));

    const calculationResult = engine.calculate(
      studentsToEvaluate,
      componentConfigs,
      coCodes,
      poList,
      INITIAL_MAPPINGS
    );

    // Record audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit/auditLogger");
      logAuditEvent({
        offering_id: id,
        user_email: "teacher.cse@pce.edu.in",
        action: "ATTAINMENT_CALCULATED",
        resource_type: "calculation_runs",
        resource_id: `calc-${Date.now()}`,
        payload: {
          student_count: studentsToEvaluate.length,
          components_count: componentConfigs.length,
          direct_co_levels: calculationResult.co_results.map((c) => ({
            co: c.co_code,
            level: c.final_attainment,
          })),
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      offering_id: id,
      calculated_at: new Date().toISOString(),
      ...calculationResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute calculation engine" },
      { status: 500 }
    );
  }
}
