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

// In-memory persistent audit log for MVP (mirrors public.audit_logs in Supabase)
let auditLogs: AuditLogEntry[] = [
  {
    id: "log-seed-1",
    offering_id: "off-ids-3rd-2526",
    user_email: "teacher.cse@pce.edu.in",
    action: "COURSE_CREATED",
    resource_type: "course_offering",
    resource_id: "off-ids-3rd-2526",
    payload: {
      course_code: "25UCS623T",
      course_name: "Introduction to Data Science",
      department: "CSE",
      scheme: "60_40",
      academic_year: "2025-26",
    },
    created_at: "2026-10-18T08:00:00.000Z",
  },
  {
    id: "log-seed-2",
    offering_id: "off-ids-3rd-2526",
    user_email: "teacher.cse@pce.edu.in",
    action: "STUDENT_ROSTER_UPDATED",
    resource_type: "student_roster",
    resource_id: "off-ids-3rd-2526",
    payload: {
      student_count: 81,
      roll_range: "102 - 160",
    },
    created_at: "2026-10-18T08:15:00.000Z",
  },
  {
    id: "log-seed-3",
    offering_id: "off-ids-3rd-2526",
    user_email: "teacher.cse@pce.edu.in",
    action: "MARKS_IMPORTED",
    resource_type: "student_marks",
    resource_id: "off-ids-3rd-2526",
    payload: {
      source_file: "Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx",
      total_rows: 81,
      components_mapped: 13,
      anomalies_detected: 2, // Roll 138 (Jeet Lambat) 19/10, Roll 218 9/8
    },
    created_at: "2026-10-18T08:30:00.000Z",
  },
  {
    id: "log-seed-4",
    offering_id: "off-ids-3rd-2526",
    user_email: "teacher.cse@pce.edu.in",
    action: "ATTAINMENT_CALCULATED",
    resource_type: "calculation_runs",
    resource_id: "calc-run-init",
    payload: {
      method: "PCE_AUTONOMOUS_OBE",
      iam_weight: 0.40,
      ese_weight: 0.60,
      direct_co_levels: { CO1: 3, CO2: 3, CO3: 3, CO4: 3, CO5: 3, CO6: 3 },
      po_averages: { PO1: 2.67, PO2: 2.67, PO3: 2.0, PO4: 2.6, PO11: 2.67 },
    },
    created_at: "2026-10-18T09:00:00.000Z",
  },
];

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
