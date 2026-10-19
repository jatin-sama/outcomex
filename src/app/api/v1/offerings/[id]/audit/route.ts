import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs, logAuditEvent } from "@/lib/audit/auditLogger";
import { getDbClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let logs = getAuditLogs(id);

  try {
    const db = await getDbClient();
    const { data: dbLogs, error } = await db
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && dbLogs && dbLogs.length > 0) {
      logs = dbLogs;
    }
  } catch {}

  return NextResponse.json({
    offering_id: id,
    count: logs.length,
    logs,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const entry = logAuditEvent({
      offering_id: id,
      user_email: body.user_email || request.headers.get("x-user-email") || "faculty@pce.edu.in",
      action: body.action,
      resource_type: body.resource_type || "system",
      resource_id: body.resource_id,
      payload: body.payload || {},
    });

    // Persist to Supabase audit_logs table
    try {
      const db = await getDbClient();
      await db.from("audit_logs").insert({
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        payload: entry.payload,
      });
    } catch {}

    return NextResponse.json({ success: true, log: entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to log event" }, { status: 500 });
  }
}
