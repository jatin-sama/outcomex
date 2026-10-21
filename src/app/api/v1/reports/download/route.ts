import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";
import { getDbClient } from "@/lib/supabase/admin";
import { isValidUuid, offeringStore } from "@/lib/domain/offeringStore";
import { generateExcelReport } from "@/lib/excel/excelGenerator";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate caller via verified server session
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to download official report workbooks." },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const reportId = searchParams.get("report_id");
    const filename = searchParams.get("filename");

    if (!reportId && !filename) {
      return NextResponse.json(
        { error: "report_id or filename query parameter is required." },
        { status: 400 }
      );
    }

    const db = await getDbClient();
    let reportRecord: any = null;

    // 2. Resolve report record from PostgreSQL database
    if (reportId && isValidUuid(reportId)) {
      const { data, error } = await db
        .from("report_runs")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();
      if (!error && data) {
        reportRecord = data;
      }
    }

    if (!reportRecord && filename) {
      const safeFilename = path.basename(filename);
      const { data, error } = await db
        .from("report_runs")
        .select("*")
        .ilike("storage_file_path", `%${safeFilename}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        reportRecord = data;
      }
    }

    // If report record is not in database, reject to prevent unauthorized access
    if (!reportRecord && !authCtx.isServiceRole) {
      return NextResponse.json(
        { error: "Report record not found or unauthorized." },
        { status: 404 }
      );
    }

    // 3. Authorize caller for the offering associated with this report
    if (reportRecord?.course_offering_id) {
      const authCheck = await authorizeOfferingAccess(authCtx, reportRecord.course_offering_id);
      if (!authCheck.authorized) {
        return NextResponse.json(
          { error: authCheck.reason || "Forbidden: You are not authorized to download reports for this course offering." },
          { status: 403 }
        );
      }
    }

    const targetFilename = path.basename(
      reportRecord?.storage_file_path || filename || "report.xlsx"
    );

    // Explicitly reject any path traversal attempts
    if (targetFilename.includes("..") || targetFilename.includes("/") || targetFilename.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
    }

    // 4. Retrieve workbook bytes from durable Supabase Storage or regenerate in memory
    let fileBuffer: Buffer | null = null;
    const storagePath = reportRecord?.storage_file_path;

    if (storagePath) {
      try {
        const { data: storageBlob, error: storageErr } = await db.storage
          .from("reports")
          .download(storagePath);

        if (!storageErr && storageBlob) {
          const ab = await storageBlob.arrayBuffer();
          fileBuffer = Buffer.from(ab);
        }
      } catch (storageDownloadErr: any) {
        console.warn("Storage download note:", storageDownloadErr.message);
      }
    }

    // Fallback: If not in storage bucket, dynamically regenerate the verified workbook in memory
    if (!fileBuffer && reportRecord?.course_offering_id) {
      const offeringId = reportRecord.course_offering_id;
      const snapshot = reportRecord.calculation_snapshot || {};
      const schemeType = snapshot.scheme || "60_40";

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
            departments ( code, name )
          ),
          academic_years ( year_label )
        `)
        .eq("id", offeringId)
        .maybeSingle();

      const c: any = offering?.courses;
      const courseData = snapshot.course_data || {
        course_code: (Array.isArray(c) ? c[0]?.course_code : c?.course_code) || "25UCS623T",
        course_name: (Array.isArray(c) ? c[0]?.course_name : c?.course_name) || "Introduction to Data Science",
        department: (Array.isArray(c) ? c[0]?.departments?.code : c?.departments?.code) || "CSE",
        year_semester: Array.isArray(c)
          ? `${c[0]?.year_of_study || "3rd Yr"} / ${c[0]?.semester || "5th Sem"}`
          : `${c?.year_of_study || "3rd Yr"} / ${c?.semester || "5th Sem"}`,
        academic_year: (Array.isArray(offering?.academic_years) ? (offering?.academic_years as any)[0]?.year_label : (offering?.academic_years as any)?.year_label) || "2025-26",
        section: offering?.section || "A",
      };

      const roster = await offeringStore.getRoster(offeringId);
      const { marks } = await offeringStore.getMarks(offeringId);

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

      if (studentRecords.length > 0) {
        const genResult = await generateExcelReport(schemeType, courseData, studentRecords);
        fileBuffer = genResult.buffer;
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: "Requested report could not be retrieved or regenerated." },
        { status: 404 }
      );
    }

    // 5. Record immutable audit log
    try {
      await db.from("audit_logs").insert({
        profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
        action: "REPORT_DOWNLOADED",
        resource_type: "report_runs",
        resource_id: reportRecord?.id || targetFilename,
        payload: {
          offering_id: reportRecord?.course_offering_id,
          user_email: authCtx.user.email,
          filename: targetFilename,
          downloaded_at: new Date().toISOString(),
        },
      });
    } catch {}

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${targetFilename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process download request." },
      { status: 500 }
    );
  }
}
