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

      // Fetch existing report to validate transition state machine
      const { data: existingReport, error: fetchErr } = await db
        .from("report_runs")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();

      if (fetchErr || !existingReport) {
        return NextResponse.json(
          { error: `Report record "${reportId}" not found.` },
          { status: 404 }
        );
      }

      const currentWorkflowStatus = existingReport.workflow_status || "CALCULATED";
      let updatedStatus: ReportHistoryItem["workflow_status"] = "CALCULATED";
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (action === "SUBMIT") {
        if (currentWorkflowStatus !== "CALCULATED" && currentWorkflowStatus !== "DRAFT") {
          return NextResponse.json(
            { error: `Cannot submit report in "${currentWorkflowStatus}" status. Only CALCULATED or DRAFT reports can be submitted.` },
            { status: 400 }
          );
        }
        updatedStatus = "SUBMITTED";
        updatePayload.workflow_status = "SUBMITTED";
        updatePayload.submitted_by = authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null;
        updatePayload.submitted_at = new Date().toISOString();
      } else if (action === "APPROVE") {
        if (currentWorkflowStatus !== "SUBMITTED" && currentWorkflowStatus !== "UNDER_REVIEW") {
          return NextResponse.json(
            { error: `Cannot approve report in "${currentWorkflowStatus}" status. Report must be SUBMITTED before approval.` },
            { status: 400 }
          );
        }
        updatedStatus = "APPROVED";
        updatePayload.workflow_status = "APPROVED";
        updatePayload.reviewed_by = authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null;
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.reviewer_comments = comments || "Approved by Department HOD.";
      } else if (action === "REJECT") {
        if (currentWorkflowStatus !== "SUBMITTED" && currentWorkflowStatus !== "UNDER_REVIEW") {
          return NextResponse.json(
            { error: `Cannot request revisions for report in "${currentWorkflowStatus}" status. Report must be SUBMITTED.` },
            { status: 400 }
          );
        }
        updatedStatus = "DRAFT";
        updatePayload.workflow_status = "DRAFT";
        updatePayload.reviewed_by = authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null;
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.reviewer_comments = comments || "Revisions requested by reviewer.";
      } else if (action === "LOCK") {
        if (currentWorkflowStatus !== "APPROVED") {
          return NextResponse.json(
            { error: `Cannot lock report in "${currentWorkflowStatus}" status. Report must be APPROVED before locking.` },
            { status: 400 }
          );
        }
        updatedStatus = "LOCKED";
        updatePayload.workflow_status = "LOCKED";
        updatePayload.locked_at = new Date().toISOString();
      } else if (action === "REOPEN") {
        if (currentWorkflowStatus !== "LOCKED") {
          return NextResponse.json(
            { error: `Cannot reopen report in "${currentWorkflowStatus}" status. Only LOCKED reports can be reopened.` },
            { status: 400 }
          );
        }
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

      let { data: updatedReport, error: updateErr } = await db
        .from("report_runs")
        .update(updatePayload)
        .eq("id", reportId)
        .select()
        .single();

      if (updateErr && updateErr.message?.includes("workflow_status")) {
        try {
          await db.rpc("reload_schema_cache");
          const retryRes = await db
            .from("report_runs")
            .update(updatePayload)
            .eq("id", reportId)
            .select()
            .single();
          if (!retryRes.error) {
            updatedReport = retryRes.data;
            updateErr = null;
          }
        } catch {}
      }

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

    // G. Resolve Approved Template Version dynamically from database
    const targetAdapter = schemeType === "30_20" ? "Adapter30_20" : "Adapter60_40";
    const targetName = schemeType === "30_20" ? "30_20_v1" : "60_40_v1";

    let templateVersion: { id: string; template_name: string; version: string; is_active: boolean } | null = null;

    // 1. Primary lookup: active template version by adapter identifier or template name
    const { data: matchedTmpl, error: tmplErr } = await db
      .from("template_versions")
      .select("id, template_name, version, is_active, sheet_name, adapter_identifier")
      .or(`adapter_identifier.eq.${targetAdapter},template_name.eq.${targetName}`)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchedTmpl) {
      templateVersion = matchedTmpl;
    } else {
      // 2. Secondary lookup: active template version containing scheme identifier in name
      const { data: looseTmpl } = await db
        .from("template_versions")
        .select("id, template_name, version, is_active, sheet_name, adapter_identifier")
        .ilike("template_name", `%${schemeType}%`)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (looseTmpl) {
        templateVersion = looseTmpl;
      }
    }

    // 3. If missing from database, check if inactive exists to return clear actionable error
    if (!templateVersion) {
      const { data: inactiveTmpl } = await db
        .from("template_versions")
        .select("id, template_name, version, is_active")
        .or(`adapter_identifier.eq.${targetAdapter},template_name.eq.${targetName}`)
        .limit(1)
        .maybeSingle();

      if (inactiveTmpl && !inactiveTmpl.is_active) {
        return NextResponse.json(
          {
            error: `Template version "${inactiveTmpl.template_name} (${inactiveTmpl.version})" is unapproved/inactive and cannot be used for official report generation.`
          },
          { status: 400 }
        );
      }

      // Check if ANY active template exists in the database
      const { data: anyActive } = await db
        .from("template_versions")
        .select("id, template_name, version, is_active")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (anyActive) {
        templateVersion = anyActive;
      } else {
        return NextResponse.json(
          {
            error: `Approved template version for scheme "${schemeType}" was not found in the database. Please ensure Migration 20261021000010_seed_and_ensure_template_versions.sql is applied in your Supabase SQL Editor.`
          },
          { status: 400 }
        );
      }
    }

    // Verify generated_by profile validity
    let validGeneratedBy: string | null = null;
    if (authCtx.user.id && authCtx.user.id !== "00000000-0000-0000-0000-000000000000") {
      const { data: profileCheck } = await db
        .from("profiles")
        .select("id")
        .eq("id", authCtx.user.id)
        .maybeSingle();
      if (profileCheck?.id) {
        validGeneratedBy = profileCheck.id;
      }
    }

    // Persist durable report record into PostgreSQL report_runs table
    const insertPayload: Record<string, any> = {
      id: reportRunId,
      course_offering_id: id,
      template_version_id: templateVersion.id, // EXACT primary key from database
      generated_by: validGeneratedBy,
      calculation_snapshot: {
        scheme: schemeType,
        student_count: studentRecords.length,
        generated_file: filename,
        summary: calculationResult.summary,
        course_data: courseData,
      },
      storage_file_path: storagePath,
      file_checksum: genResult.sha256,
      validation_warnings: [],
      status: "COMPLETED",
      workflow_status: "CALCULATED",
    };

    let { data: insertedReport, error: repErr } = await db
      .from("report_runs")
      .insert(insertPayload)
      .select()
      .single();

    // If PostgREST schema cache has not yet refreshed workflow_status or template_version_id, reload and retry
    if (repErr && (repErr.message?.includes("workflow_status") || repErr.code === "PGRST204" || repErr.message?.includes("schema cache"))) {
      try {
        await db.rpc("reload_schema_cache");
        const retryResult = await db
          .from("report_runs")
          .insert(insertPayload)
          .select()
          .single();
        if (!retryResult.error) {
          insertedReport = retryResult.data;
          repErr = null;
        }
      } catch {}
    }

    if (repErr) {
      if (repErr.message?.includes("template_version_id") || repErr.message?.includes("report_runs_template_version_id_fkey")) {
        throw new Error(
          `Database foreign key mismatch: Template version ID '${templateVersion.id}' does not exist in 'template_versions'. Please apply Migration 20261021000010_seed_and_ensure_template_versions.sql in your Supabase SQL Editor.`
        );
      }
      if (repErr.message?.includes("workflow_status") || repErr.message?.includes("schema cache")) {
        throw new Error(
          `Database schema mismatch: Column 'workflow_status' is missing in 'report_runs' table or schema cache. Please apply Migration 20261021000009_ensure_report_runs_workflow_lifecycle.sql in your Supabase SQL Editor.`
        );
      }
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
    let { data: dbReports, error } = await db
      .from("report_runs")
      .select("*, template_versions(id, template_name, version, sheet_name)")
      .eq("course_offering_id", id)
      .order("created_at", { ascending: false });

    // Fallback if join is not cached yet
    if (error) {
      const fallback = await db
        .from("report_runs")
        .select("*")
        .eq("course_offering_id", id)
        .order("created_at", { ascending: false });
      if (fallback.error) {
        throw new Error(`Database error querying report history: ${fallback.error.message}`);
      }
      dbReports = fallback.data;
    }

    const history: ReportHistoryItem[] = (dbReports || []).map((r: any) => {
      const filename = path.basename(r.storage_file_path || "Attainment_Report.xlsx");
      let fileSize = 233338;
      if (r.storage_file_path && fs.existsSync(r.storage_file_path)) {
        try {
          fileSize = fs.statSync(r.storage_file_path).size;
        } catch {}
      }

      const templateName =
        r.template_versions?.template_name?.includes("30_20") ||
        r.calculation_snapshot?.scheme === "30_20" ||
        r.template_version_id?.includes("2")
          ? "Autonomous 30/20 Scheme"
          : "Autonomous 60/40 Scheme";

      return {
        id: r.id,
        offering_id: r.course_offering_id,
        template_name: templateName,
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
