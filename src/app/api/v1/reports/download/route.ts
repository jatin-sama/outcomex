import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";
import { getDbClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/domain/offeringStore";

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

    // 4. Secure path traversal sanitization: strictly locate file within exports/
    const targetFilename = path.basename(
      reportRecord?.storage_file_path || filename || "report.xlsx"
    );

    // Explicitly reject any traversal attempts or attempts to access reference files
    if (targetFilename.includes("..") || targetFilename.includes("/") || targetFilename.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
    }

    const primaryExportsDir = path.join(process.cwd(), "exports");
    const tmpExportsDir = path.join(require("os").tmpdir(), "exports");

    let resolvedPath = path.join(primaryExportsDir, targetFilename);
    if (!fs.existsSync(resolvedPath)) {
      resolvedPath = path.join(tmpExportsDir, targetFilename);
    }

    // NEVER serve from reference/ or arbitrary directories
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json(
        { error: "Requested report file is not available on disk." },
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

    const fileBuffer = fs.readFileSync(resolvedPath);

    return new NextResponse(fileBuffer, {
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
