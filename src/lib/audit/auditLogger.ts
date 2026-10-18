/**
 * OutcomeX — Immutable Audit Logging Service
 * Tracks all user actions, calculation runs, marks imports, and report generations.
 */

export interface AuditLogEntry {
  id: string;
  offering_id: string;
  profile_id?: string;
  user_email: string;
  action:
    | "COURSE_CREATED"
    | "STUDENT_ROSTER_UPDATED"
    | "MARKS_IMPORTED"
    | "MARKS_UPDATED"
    | "ATTAINMENT_CALCULATED"
    | "REPORT_GENERATED"
    | "REPORT_DOWNLOADED";
  resource_type: string;
  resource_id?: string;
  payload: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

// In-memory persistent audit log for active session (mirrors public.audit_logs in Supabase)
let auditLogs: AuditLogEntry[] = [];

export function logAuditEvent(entry: Omit<AuditLogEntry, "id" | "created_at">): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  auditLogs.unshift(newEntry);
  return newEntry;
}

export function getAuditLogs(offeringId?: string): AuditLogEntry[] {
  if (!offeringId) return auditLogs;
  return auditLogs.filter((log) => log.offering_id === offeringId);
}
