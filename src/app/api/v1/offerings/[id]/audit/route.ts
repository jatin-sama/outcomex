import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs, logAuditEvent } from "@/lib/audit/auditLogger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const logs = getAuditLogs(id);
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
      user_email: body.user_email || "teacher.cse@pce.edu.in",
      action: body.action,
      resource_type: body.resource_type || "system",
      resource_id: body.resource_id,
      payload: body.payload || {},
    });

    return NextResponse.json({ success: true, log: entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to log event" }, { status: 500 });
  }
}
