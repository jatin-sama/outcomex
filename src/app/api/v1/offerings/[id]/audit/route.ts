import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json({ offering_id: id, count: 0, logs: [] });
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json({ error: "Authentication required to view audit trail." }, { status: 401 });
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.reason || "Unauthorized." }, { status: 403 });
    }

    const db = await getDbClient();
    const { data: dbLogs, error } = await db
      .from("audit_logs")
      .select(`
        id,
        action,
        resource_type,
        resource_id,
        payload,
        created_at,
        profiles (
          email,
          full_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Database error querying audit logs: ${error.message}`);
    }

    // Filter logs for this specific offering
    const filtered = (dbLogs || []).filter((l: any) => {
      const offId = l.payload?.offering_id || l.resource_id;
      return offId === id;
    });

    const mapped = filtered.map((l: any) => ({
      id: l.id,
      offering_id: id,
      user_email: l.profiles?.email || l.payload?.user_email || "system@outcomex.internal",
      action: l.action,
      resource_type: l.resource_type,
      resource_id: l.resource_id,
      payload: l.payload || {},
      created_at: l.created_at,
    }));

    return NextResponse.json({
      offering_id: id,
      count: mapped.length,
      logs: mapped,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load audit logs" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid course offering ID." }, { status: 400 });
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json({ error: "Authentication required to record audit events." }, { status: 401 });
    }

    const body = await request.json();
    const { action, resource_type, resource_id, payload } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    const db = await getDbClient();
    const { data: logEntry, error } = await db
      .from("audit_logs")
      .insert({
        profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
        action,
        resource_type: resource_type || "system",
        resource_id: resource_id || id,
        payload: {
          ...(payload || {}),
          offering_id: id,
          user_email: authCtx.user.email,
        },
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert audit log: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      log: logEntry,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to record audit event" },
      { status: 500 }
    );
  }
}
