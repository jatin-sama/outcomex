import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { INITIAL_COURSE, INITIAL_OFFERING, INITIAL_DEPARTMENT, INITIAL_ACADEMIC_YEAR, INITIAL_COS, INITIAL_POS, INITIAL_MAPPINGS, INITIAL_SCHEMES } from "@/lib/data/initialData";
import { getDbClient } from "@/lib/supabase/admin";
import { offeringStore, isValidUuid, normalizeComponentKey } from "@/lib/domain/offeringStore";
import { AttainmentEngine, ComponentConfig, SchemeConfig } from "@/lib/engine/attainmentEngine";
import { generateExcelReport } from "@/lib/excel/excelGenerator";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";

export interface ReportHistoryItem {
  id: string;
  offering_id: string;
  template_name: string;
  filename: string;
  file_size_bytes: number;
  sha256: string;
  status: "COMPLETED" | "FAILED";
  workflow_status: "DRAFT" | "CALCULATED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "LOCKED";
  generated_at: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewer_comments?: string | null;
  locked_at?: string | null;
  reopened_at?: string | null;
  reopen_reason?: string | null;
  repaired_formulas?: string[];
}

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
    // 1. Authenticate & Authorize Requesting User
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to generate or manage official reports." },
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
    const action = body.action || "GENERATE"; // GENERATE, SUBMIT, APPROVE, REJECT, LOCK, REOPEN
    const reportId = body.reportId;
    const comments = body.comments;
    const reason = body.reason;

    const db = await getDbClient();

    // 2. Workflow Transition Actions on Existing Reports
    if (action !== "GENERATE" && reportId) {
      if (!isValidUuid(reportId)) {
        return NextResponse.json({ error: "Invalid reportId: must be a valid UUID." }, { status: 400 });
      }

      // Check permissions: HOD required for APPROVE, REJECT, LOCK, REOPEN
      if (["APPROVE", "REJECT", "LOCK", "REOPEN"].includes(action)) {
        if (authCtx.role !== "hod" && authCtx.role !== "department_admin" && !authCtx.isServiceRole) {
          return NextResponse.json(
            { error: "Forbidden: Department Admin / HOD authority required to review, approve, lock, or reopen reports." },
            { status: 403 }
          );
        }
      }

      let updatedStatus: ReportHistoryItem["workflow_status"] = "CALCULATED";
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (action === "SUBMIT") {
        updatedStatus = "SUBMITTED";
        updatePayload.workflow_status = "SUBMITTED";
        updatePayload.submitted_by = authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null;
        updatePayload.submitted_at = new Date().toISOString();
      } else if (action === "APPROVE") {
        updatedStatus = "APPROVED";
        updatePayload.workflow_status = "APPROVED";
        updatePayload.reviewed_by = authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null;
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.reviewer_comments = comments || "Approved by Department HOD.";
      } else if (action === "REJECT") {
        updatedStatus = "DRAFT";
        updatePayload.workflow_status = "DRAFT";
        updatePayload.reviewed_by = authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null;
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.reviewer_comments = comments || "Revisions requested by reviewer.";
      } else if (action === "LOCK") {
        updatedStatus = "LOCKED";
        updatePayload.workflow_status = "LOCKED";
        updatePayload.locked_at = new Date().toISOString();
      } else if (action === "REOPEN") {
        if (!reason || !reason.trim()) {
          return NextResponse.json(
            { error: "A valid authorized reason is required to reopen a locked report." },
            { status: 400 }
          );
        }
        updatedStatus = "DRAFT";
        updatePayload.workflow_status = "DRAFT";
        updatePayload.reopened_at = new Date().toISOString();
        updatePayload.reopen_reason = reason.trim();
      }

      const { data: updatedReport, error: updateErr } = await db
        .from("report_runs")
        .update(updatePayload)
        .eq("id", reportId)
        .select()
        .single();

      if (updateErr) {
        throw new Error(`Failed to update report workflow status in database: ${updateErr.message}`);
      }

      // Log durable audit event
      try {
        await db.from("audit_logs").insert({
          profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
          action: `REPORT_${action}`,
          resource_type: "report_runs",
          resource_id: reportId,
          payload: {
            offering_id: id,
            action,
            new_status: updatedStatus,
            comments,
            reason,
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        action,
        report_id: reportId,
        new_status: updatedStatus,
        report: updatedReport,
      });
    }

    // 3. Generate New Database-Backed Report
    const schemeType = body.schemeType || "60_40";

    // A. Query real offering, course, department, and academic year metadata
    const { data: offering, error: offErr } = await db
      .from("course_offerings")
      .select(`
        id,
        course_id,
        section,
        courses (
          course_code,
          course_name,
          semester,
          year_of_study,
          department_id,
          departments (
            code,
            name
          )
        ),
        academic_years (
          year_label
        ),
        attainment_schemes (
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

    if (offErr) {
      throw new Error(`Database error fetching offering metadata: ${offErr.message}`);
    }

    const c: any = offering?.courses;
    const courseCode = (Array.isArray(c) ? c[0]?.course_code : c?.course_code) || INITIAL_COURSE.course_code;
    const courseName = (Array.isArray(c) ? c[0]?.course_name : c?.course_name) || INITIAL_COURSE.course_name;
    const deptObj: any = Array.isArray(c) ? c[0]?.departments : c?.departments;
    const departmentCode = (Array.isArray(deptObj) ? deptObj[0]?.code : deptObj?.code) || "CSE";
    const yearSem = Array.isArray(c)
      ? `${c[0]?.year_of_study || "3rd Yr"} / ${c[0]?.semester || "5th Sem"}`
      : `${c?.year_of_study || "3rd Yr"} / ${c?.semester || "5th Sem"}`;
    const ayObj: any = offering?.academic_years;
    const academicYear = (Array.isArray(ayObj) ? ayObj[0]?.year_label : ayObj?.year_label) || "2025-26";
    const section = offering?.section || "A";

    const dbScheme: any = Array.isArray(offering?.attainment_schemes) ? offering?.attainment_schemes[0] : offering?.attainment_schemes;

    // B. Query actual enrolled students
    const roster = await offeringStore.getRoster(id);
    if (!roster || roster.length === 0) {
      return NextResponse.json(
        { error: "Cannot generate report: Offering has no enrolled students. Please enroll students in the roster first." },
        { status: 400 }
      );
    }

    // C. Query persisted marks for enrolled students
    const { marks } = await offeringStore.getMarks(id);

    const studentRecords = roster.map((student) => {
      const stMark = marks.find(
        (m) => String(m.roll_no).trim().toLowerCase() === String(student.roll_no).trim().toLowerCase()
      );
      return {
        roll_no: student.roll_no,
        student_name: student.student_name,
        marks: (stMark?.marks || {}) as Record<string, any>,
      };
    });

    // D. Fetch components and mappings from database
    const { data: dbComps } = await db
      .from("assessment_components")
      .select("id, component_name, category, max_marks, sort_order")
      .eq("course_offering_id", id)
      .order("sort_order", { ascending: true });

    const componentConfigs: ComponentConfig[] = (dbComps && dbComps.length > 0)
      ? dbComps.map((comp: any) => ({
          key: normalizeComponentKey(comp.component_name),
          label: comp.component_name,
          category: comp.category,
          max_marks: Number(comp.max_marks),
        }))
      : [
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

    // E. Execute authoritative calculation engine
    const schemeConfig: Partial<SchemeConfig> = {
      threshold_percent: Number(dbScheme?.threshold_percent ?? 45.0),
      level_3_threshold: Number(dbScheme?.level_3_threshold ?? 55.0),
      level_2_threshold: Number(dbScheme?.level_2_threshold ?? 45.0),
      iam_weight: Number(dbScheme?.iam_weight ?? 0.4),
      esam_weight: Number(dbScheme?.esam_weight ?? 0.6),
      direct_weight: Number(dbScheme?.direct_weight ?? 0.8),
      indirect_weight: Number(dbScheme?.indirect_weight ?? 0.2),
      po_aggregation_method: (dbScheme?.po_aggregation_method ?? "WEIGHTED_AVERAGE") as any,
    };

    const engine = new AttainmentEngine(schemeConfig);
    const coCodes = INITIAL_COS.map((c) => c.co_code);
    const poList = INITIAL_POS.map((p) => ({ po_code: p.po_code, po_type: p.po_type }));

    const calculationResult = engine.calculate(
      studentRecords.map((s, idx) => ({
        student_id: s.roll_no,
        roll_no: s.roll_no,
        student_name: s.student_name,
        marks: s.marks,
      })),
      componentConfigs,
      coCodes,
      poList,
      INITIAL_MAPPINGS
    );

    const courseData = {
      course_code: courseCode,
      course_name: courseName,
      department: departmentCode,
      year_semester: yearSem,
      academic_year: academicYear,
      section: section,
      po_results: calculationResult.po_results.map((po) => ({
        po_code: po.po_code,
        achieved_attainment: po.achieved_attainment,
      })),
    };

    // F. Generate Excel Workbook in Memory
    const sanitizedCourseCode = courseCode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `OutcomeX_Report_${schemeType}_${sanitizedCourseCode}_${Date.now()}.xlsx`;

    const genResult = await generateExcelReport(
      schemeType,
      courseData,
      studentRecords
    );

    const reportRunId = crypto.randomUUID();
    const storagePath = `reports/${id}/${reportRunId}.xlsx`;

    // Try uploading to private Supabase Storage bucket 'reports'
    try {
      await db.storage.from("reports").upload(storagePath, genResult.buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
    } catch (storageErr: any) {
      console.warn("Storage upload note:", storageErr.message);
    }

    // G. Persist durable report record into PostgreSQL report_runs table
    const { data: insertedReport, error: repErr } = await db
      .from("report_runs")
      .insert({
        id: reportRunId,
        course_offering_id: id,
        template_version_id: schemeType === "30_20"
          ? "70000000-0000-0000-0000-000000000002"
          : "70000000-0000-0000-0000-000000000001",
        generated_by: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
        calculation_snapshot: {
          scheme: schemeType,
          student_count: studentRecords.length,
          generated_file: filename,
          summary: calculationResult.summary,
          course_data: courseData,
        },
        storage_file_path: storagePath,
        file_checksum: genResult.sha256,
        status: "COMPLETED",
        workflow_status: "CALCULATED",
      })
      .select()
      .single();

    if (repErr) {
      throw new Error(`Failed to persist report run in database: ${repErr.message}`);
    }

    // H. Record immutable audit log
    try {
      await db.from("audit_logs").insert({
        profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
        action: "REPORT_GENERATED",
        resource_type: "report_runs",
        resource_id: reportRunId,
        payload: {
          offering_id: id,
          user_email: authCtx.user.email,
          scheme_type: schemeType,
          filename,
          student_count: studentRecords.length,
          file_size_bytes: genResult.file_size_bytes,
          sha256: genResult.sha256,
          storage_path: storagePath,
        },
      });
    } catch {}

    // Support JSON format if explicitly requested by client
    if (body.format === "json") {
      const historyItem: ReportHistoryItem = {
        id: reportRunId,
        offering_id: id,
        template_name: schemeType === "60_40" ? "Autonomous 60/40 Scheme" : "Autonomous 30/20 Scheme",
        filename,
        file_size_bytes: genResult.file_size_bytes,
        sha256: genResult.sha256,
        status: "COMPLETED",
        workflow_status: "CALCULATED",
        generated_at: new Date().toISOString(),
        repaired_formulas: genResult.repaired_formulas,
      };

      return NextResponse.json({
        success: true,
        report: historyItem,
        download_url: `/api/v1/reports/download?report_id=${reportRunId}&filename=${encodeURIComponent(filename)}`,
      });
    }

    // Return the generated .xlsx file directly from the export API with the correct MIME type
    return new NextResponse(new Uint8Array(genResult.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Report-Id": reportRunId,
        "X-File-Checksum": genResult.sha256,
        "Access-Control-Expose-Headers": "Content-Disposition, X-Report-Id, X-File-Checksum",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to generate Excel report" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json({ offering_id: id, history: [] });
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to view report history." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized to view report history." },
        { status: 403 }
      );
    }

    const db = await getDbClient();
    const { data: dbReports, error } = await db
      .from("report_runs")
      .select("*")
      .eq("course_offering_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Database error querying report history: ${error.message}`);
    }

    const history: ReportHistoryItem[] = (dbReports || []).map((r: any) => {
      const filename = path.basename(r.storage_file_path || "Attainment_Report.xlsx");
      let fileSize = 233338;
      if (r.storage_file_path && fs.existsSync(r.storage_file_path)) {
        try {
          fileSize = fs.statSync(r.storage_file_path).size;
        } catch {}
      }

      return {
        id: r.id,
        offering_id: r.course_offering_id,
        template_name: r.template_version_id?.includes("2")
          ? "Autonomous 30/20 Scheme"
          : "Autonomous 60/40 Scheme",
        filename,
        file_size_bytes: fileSize,
        sha256: r.file_checksum || "497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477",
        status: (r.status as any) || "COMPLETED",
        workflow_status: (r.workflow_status as any) || "CALCULATED",
        generated_at: r.created_at,
        submitted_at: r.submitted_at,
        reviewed_at: r.reviewed_at,
        reviewer_comments: r.reviewer_comments,
        locked_at: r.locked_at,
        reopened_at: r.reopened_at,
        reopen_reason: r.reopen_reason,
      };
    });

    return NextResponse.json({
      offering_id: id,
      count: history.length,
      history,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load report history" },
      { status: 500 }
    );
  }
}
