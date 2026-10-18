"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  FileSpreadsheet,
  Calculator,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { AuditLogEntry } from "@/lib/audit/auditLogger";

const FALLBACK_LOGS: AuditLogEntry[] = [];

export default function HistoryPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(FALLBACK_LOGS);
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/offerings/off-ids-3rd-2526/audit")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to fetch logs");
      })
      .then((data) => {
        if (data.logs && data.logs.length > 0) {
          setLogs(data.logs);
        }
      })
      .catch(() => {
        // Use fallback
      });
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = selectedFilter === "ALL" || log.action === selectedFilter;
    const matchesSearch =
      log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.payload).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ATTAINMENT_CALCULATED":
        return "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300";
      case "MARKS_IMPORTED":
      case "MARKS_UPDATED":
        return "bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300";
      case "REPORT_GENERATED":
      case "REPORT_DOWNLOADED":
        return "bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300";
    }
  };

  const exportAuditLog = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outcomex-audit-trail-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/history" />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                  Compliance & Traceability
                </span>
                <span className="text-xs text-slate-500">NBA Criteria 3.1 & 3.2 Audit Trail</span>
              </div>
              <h1 className="mt-1 text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                OBE Audit Trail & Historical Revisions
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Immutable, timestamped record of marks imports, threshold adjustments, calculation runs, and report exports
              </p>
            </div>

            <button
              onClick={exportAuditLog}
              className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="h-4 w-4 text-sky-600" />
              <span>Export Audit Log (JSON)</span>
            </button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit trail by user, action, or payload detail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "ALL", label: "All Events" },
                { id: "MARKS_IMPORTED", label: "Marks Imports" },
                { id: "ATTAINMENT_CALCULATED", label: "Attainment Runs" },
                { id: "REPORT_GENERATED", label: "Reports" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedFilter === f.id
                      ? "bg-sky-600 text-white"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Trail List */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching audit log entries found.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div key={log.id} className="p-4 sm:p-5 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{log.user_email}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          <span>{isExpanded ? "Hide Details" : "View Payload"}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span>Resource: <strong className="text-slate-700 dark:text-slate-300">{log.resource_type}</strong></span>
                      <span>Offering: <code className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">{log.offering_id}</code></span>
                    </div>

                    {/* Expandable JSON Payload */}
                    {isExpanded && (
                      <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Audit Payload Diff & Parameters
                        </p>
                        <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
