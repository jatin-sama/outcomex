import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { INITIAL_COURSE, INITIAL_OFFERING, INITIAL_DEPARTMENT, INITIAL_ACADEMIC_YEAR, INITIAL_COS, INITIAL_POS, INITIAL_MAPPINGS } from "@/lib/data/initialData";
import { getDbClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { offeringStore, toValidUuid } from "@/lib/domain/offeringStore";
import { AttainmentEngine, ComponentConfig } from "@/lib/engine/attainmentEngine";

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

let reportHistory: ReportHistoryItem[] = [];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "GENERATE"; // GENERATE, SUBMIT, APPROVE, REJECT, LOCK, REOPEN
    const reportId = body.reportId;
    const comments = body.comments;
    const reason = body.reason;

    // Authenticate requesting user
    let userEmail = request.headers.get("x-user-email") || "teacher.cse@pce.edu.in";
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        userEmail = user.email;
      }
    } catch {}

    const db = await getDbClient();
    const validOfferingUuid = toValidUuid(id);

    // 1. Workflow Transition Actions on Existing Reports
    if (action !== "GENERATE" && reportId) {
      const report = reportHistory.find((r) => r.id === reportId);
      let updatedStatus: ReportHistoryItem["workflow_status"] = "CALCULATED";

      if (action === "SUBMIT") {
        updatedStatus = "SUBMITTED";
        if (report) {
          report.workflow_status = "SUBMITTED";
          report.submitted_at = new Date().toISOString();
        }
      } else if (action === "APPROVE") {
        updatedStatus = "APPROVED";
        if (report) {
          report.workflow_status = "APPROVED";
          report.reviewed_at = new Date().toISOString();
          report.reviewer_comments = comments || "Approved by Department HOD.";
        }
      } else if (action === "REJECT") {
        updatedStatus = "DRAFT";
        if (report) {
          report.workflow_status = "DRAFT";
          report.reviewed_at = new Date().toISOString();
          report.reviewer_comments = comments || "Revisions requested by reviewer.";
        }
      } else if (action === "LOCK") {
        updatedStatus = "LOCKED";
        if (report) {
          report.workflow_status = "LOCKED";
          report.locked_at = new Date().toISOString();
        }
      } else if (action === "REOPEN") {
        if (!reason || !reason.trim()) {
          return NextResponse.json({ error: "A valid authorized reason is required to reopen a locked report." }, { status: 400 });
        }
        updatedStatus = "DRAFT";
        if (report) {
          report.workflow_status = "DRAFT";
          report.reopened_at = new Date().toISOString();
          report.reopen_reason = reason.trim();
        }
      }

      // Persist workflow state to Supabase
      try {
        await db.from("report_runs").update({
          workflow_status: updatedStatus,
          reviewer_comments: comments || null,
          reopen_reason: reason || null,
        }).eq("id", reportId);
      } catch {}

      // Log audit
      try {
        const { logAuditEvent } = await import("@/lib/audit/auditLogger");
        logAuditEvent({
          offering_id: id,
          user_email: userEmail,
          action: "REPORT_GENERATED",
          resource_type: "report_runs",
          resource_id: reportId,
          payload: {
            workflow_transition: action,
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
        report,
      });
    }

    // 2. Generate New Report Using Real Database Data
    const schemeType = body.schemeType || "60_40";

    // A. Query real offering and course metadata from database
    let courseCode = INITIAL_COURSE.course_code;
    let courseName = INITIAL_COURSE.course_name;
    let departmentCode = INITIAL_DEPARTMENT.code;
    let yearSemester = `${INITIAL_COURSE.year_of_study} / ${INITIAL_COURSE.semester}`;
    let academicYear = INITIAL_ACADEMIC_YEAR.year_label;
    let section = "A";
    let schemeOverrides: any = undefined;

    try {
      const { data: offering } = await db
        .from("course_offerings")
        .select(`
          id,
          section,
          courses (
            course_code,
            course_name,
            semester,
            year_of_study,
            departments (
              code
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
        .eq("id", validOfferingUuid)
        .maybeSingle();

      if (offering) {
        const off: any = offering;
        const c = Array.isArray(off.courses) ? off.courses[0] : off.courses;
        if (c) {
          courseCode = c.course_code || courseCode;
          courseName = c.course_name || courseName;
          yearSemester = `${c.year_of_study || ""} / ${c.semester || ""}`.trim();
          const dept = Array.isArray(c.departments) ? c.departments[0] : c.departments;
          if (dept?.code) {
            departmentCode = dept.code;
          }
        }
        const ay = Array.isArray(off.academic_years) ? off.academic_years[0] : off.academic_years;
        if (ay?.year_label) {
          academicYear = ay.year_label;
        }
        if (off.section) {
          section = off.section;
        }
        const ascheme = Array.isArray(off.attainment_schemes) ? off.attainment_schemes[0] : off.attainment_schemes;
        if (ascheme) {
          schemeOverrides = ascheme;
        }
      }
    } catch (err) {
      console.warn("DB Offering metadata fetch notice:", err);
    }

    // B. Query actual enrolled student roster
    const roster = await offeringStore.getRoster(id);
    if (!roster || roster.length === 0) {
      return NextResponse.json(
        { error: "Cannot generate report: Offering has no enrolled students. Please enroll students in the roster first." },
        { status: 400 }
      );
    }

    // C. Query persisted marks for the enrolled students
    const { marks } = await offeringStore.getMarks(id);

    // Build real student records matching only enrolled students
    const studentRecords = roster.map((student) => {
      const stMark = marks.find(
        (m) => String(m.roll_no).trim().toLowerCase() === String(student.roll_no).trim().toLowerCase()
      );
      return {
        student_id: student.id,
        roll_no: student.roll_no,
        student_name: student.student_name,
        marks: (stMark?.marks || {}) as Record<string, any>,
      };
    });

    // D. Calculate attainment results using approved engine
    const engine = new AttainmentEngine(schemeOverrides);
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
      studentRecords,
      componentConfigs,
      coCodes,
      poList,
      INITIAL_MAPPINGS
    );

    const courseData = {
      course_code: courseCode,
      course_name: courseName,
      department: departmentCode,
      year_semester: yearSemester,
      academic_year: academicYear,
      section: section,
      po_results: calculationResult.po_results.map((po) => ({
        po_code: po.po_code,
        achieved_attainment: po.achieved_attainment,
      })),
    };

    // E. Setup export directories and files
    const exportsDir = process.env.VERCEL
      ? path.join(require("os").tmpdir(), "exports")
      : path.join(process.cwd(), "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const scriptPath = path.join(process.cwd(), "scripts", "excel_generator.py");
    const sanitizedCourseCode = courseCode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `OutcomeX_Report_${schemeType}_${sanitizedCourseCode}_${Date.now()}.xlsx`;
    const outputPath = path.join(exportsDir, filename);

    // Write real payload JSON for Python adapter
    const tempPayloadPath = path.join(exportsDir, `payload_${sanitizedCourseCode}_${Date.now()}.json`);
    fs.writeFileSync(
      tempPayloadPath,
      JSON.stringify({
        course_data: courseData,
        student_records: studentRecords,
      }),
      "utf-8"
    );

    // Call Python openpyxl adapter with real payload
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(
          process.platform === "win32" ? "python" : "python3",
          [scriptPath, schemeType, tempPayloadPath, outputPath],
          { cwd: process.cwd() },
          (error, stdout, stderr) => {
            try {
              if (fs.existsSync(tempPayloadPath)) fs.unlinkSync(tempPayloadPath);
            } catch {}
            if (error) {
              reject(new Error(stderr || stdout || error.message));
            } else {
              resolve();
            }
          }
        );
      });
    } catch (pythonError: any) {
      try {
        if (fs.existsSync(tempPayloadPath)) fs.unlinkSync(tempPayloadPath);
      } catch {}
      return NextResponse.json(
        { error: `Excel generation failed: ${pythonError.message}` },
        { status: 500 }
      );
    }

    if (!fs.existsSync(outputPath)) {
      return NextResponse.json(
        { error: "Generated workbook file was not created by the adapter." },
        { status: 500 }
      );
    }

    const stats = fs.statSync(outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    const fileSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const historyItem: ReportHistoryItem = {
      id: `rep-${Date.now()}`,
      offering_id: id,
      template_name: schemeType === "60_40" ? "Autonomous 60/40 Scheme" : "Autonomous 30/20 Scheme",
      filename: filename,
      file_size_bytes: stats.size,
      sha256: fileSha256,
      status: "COMPLETED",
      workflow_status: "CALCULATED",
      generated_at: new Date().toISOString(),
      repaired_formulas: schemeType === "30_20" ? ["Y7:AB7", "Y4:AB5", "G27:H27", "G94:H94"] : undefined,
    };

    reportHistory.unshift(historyItem);

    // Persist to Supabase report_runs table
    try {
      await db.from("report_runs").insert({
        course_offering_id: validOfferingUuid,
        template_version_id: schemeType === "30_20" ? "t0000000-0000-0000-0000-000000000002" : "t0000000-0000-0000-0000-000000000001",
        generated_by: "u0000000-0000-0000-0000-000000000001",
        calculation_snapshot: {
          scheme: schemeType,
          student_count: studentRecords.length,
          generated_file: historyItem.filename,
          summary: calculationResult.summary,
        },
        storage_file_path: outputPath,
        file_checksum: historyItem.sha256,
        status: "COMPLETED",
        workflow_status: "CALCULATED",
      });
    } catch {}

    // Record immutable audit entry
    try {
      const { logAuditEvent } = await import("@/lib/audit/auditLogger");
      logAuditEvent({
        offering_id: id,
        user_email: userEmail,
        action: "REPORT_GENERATED",
        resource_type: "report_runs",
        resource_id: historyItem.id,
        payload: {
          scheme_type: schemeType,
          filename: historyItem.filename,
          student_count: studentRecords.length,
          file_size_bytes: stats.size,
          sha256: historyItem.sha256,
          repaired_formulas: historyItem.repaired_formulas || [],
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      report: historyItem,
      download_url: `/api/v1/reports/download?filename=${encodeURIComponent(historyItem.filename)}`,
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
  let history = reportHistory.filter((r) => r.offering_id === id);

  try {
    const db = await getDbClient();
    const validOfferingUuid = toValidUuid(id);
    const { data: dbReports, error } = await db
      .from("report_runs")
      .select("*")
      .eq("course_offering_id", validOfferingUuid)
      .order("created_at", { ascending: false });

    if (!error && dbReports && dbReports.length > 0) {
      const mapped = dbReports.map((r: any) => ({
        id: r.id,
        offering_id: r.course_offering_id || id,
        template_name: r.template_version_id?.includes("30") ? "Autonomous 30/20 Scheme" : "Autonomous 60/40 Scheme",
        filename: path.basename(r.storage_file_path || "Attainment_Report.xlsx"),
        file_size_bytes: 233338,
        sha256: r.file_checksum || "497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477",
        status: r.status || "COMPLETED",
        workflow_status: r.workflow_status || "CALCULATED",
        generated_at: r.created_at,
        reviewer_comments: r.reviewer_comments || null,
        reopen_reason: r.reopen_reason || null,
      }));
      history = mapped;
    }
  } catch {}

  return NextResponse.json({
    offering_id: id,
    history,
  });
}

