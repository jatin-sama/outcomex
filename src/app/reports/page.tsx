"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Download,
  FileSpreadsheet,
  Check,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  History,
  ArrowLeft,
  Lock,
  Unlock,
  Send,
  CheckCheck,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { INITIAL_OFFERING } from "@/lib/data/initialData";

export default function ReportsPage() {
  const [offeringId, setOfferingId] = useState<string>(INITIAL_OFFERING.id);

  const [selectedScheme, setSelectedScheme] = useState<"60_40" | "30_20">("60_40");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDownloadUrl, setCurrentDownloadUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Reopen Modal State
  const [reopenModalReportId, setReopenModalReportId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Sync offeringId from URL or localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("offeringId");
      const stored = localStorage.getItem("outcomeX_active_offering_id");
      const active = param || stored || INITIAL_OFFERING.id;
      setOfferingId(active);
      localStorage.setItem("outcomeX_active_offering_id", active);
    }
  }, []);

  // Fetch report history
  const fetchHistory = async () => {
    if (!offeringId) return;
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/export`);
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [offeringId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCurrentDownloadUrl(null);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemeType: selectedScheme, action: "GENERATE" }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Generation failed");

      setCurrentDownloadUrl(data.download_url);
      fetchHistory();
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWorkflowAction = async (reportId: string, action: string, comments?: string, reason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reportId, comments, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Action ${action} failed`);
      setReopenModalReportId(null);
      setReopenReason("");
      fetchHistory();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getWorkflowBadge = (status: string) => {
    switch (status) {
      case "LOCKED":
        return (
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Lock className="h-3 w-3" />
            LOCKED
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            <CheckCheck className="h-3 w-3" />
            APPROVED
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
            <Send className="h-3 w-3" />
            SUBMITTED
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            DRAFT / REVISIONS
          </span>
        );
      case "CALCULATED":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
            <CheckCircle2 className="h-3 w-3" />
            CALCULATED
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/reports" />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Courses
              </Link>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Report Center & Excel Workbook Exports
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Priyadarshini College of Engineering • Attainment Report Generation, Review & Locking Workflow
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generation Configuration Card */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Select Approved Template Version</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Both templates retain original worksheet names, cell alignments, merged ranges, and 50% landscape print scaling.
                </p>
              </div>

              {/* Template Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setSelectedScheme("60_40")}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all space-y-3 ${
                    selectedScheme === "60_40"
                      ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/40 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">60 / 40 Scheme (Final)</span>
                    <span className="rounded bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-300">
                      Primary
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    6 Course Outcomes (CO1–CO6), 81 students range, 40% Internal + 60% Endsem split. Sheet name: <code className="font-mono">For 60_40 (final)</code>.
                  </p>
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Verified with active student data</span>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedScheme("30_20")}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all space-y-3 ${
                    selectedScheme === "30_20"
                      ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/40 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">30 / 20 Scheme (Final)</span>
                    <span className="rounded bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
                      Repaired
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    4 Course Outcomes (CO1–CO4), 65 students range. Sheet name: <code className="font-mono">For 30_20 (Final)</code>.
                  </p>
                  <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Repairs verified #REF! formula errors</span>
                  </div>
                </div>
              </div>

              {/* Pre-Export Checklist */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pre-Export Verification Checklist
                </h3>
                <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Original template file unmodified in place (read-only preservation)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Formula evaluation verified against independent calculation engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Print setup preserved: Landscape orientation, Paper Size A4, Scale 50%</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{isGenerating ? "Generating Workbook..." : "Generate Verified Excel Report"}</span>
                </button>

                {currentDownloadUrl && (
                  <a
                    href={currentDownloadUrl}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition-all"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Ready (.xlsx)</span>
                  </a>
                )}
              </div>
            </div>

            {/* Template Architecture Info */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-sky-600" />
                Academic Governance Lifecycle
              </h3>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">State Machine:</p>
                  <p className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
                    CALCULATED &rarr; SUBMITTED &rarr; APPROVED &rarr; LOCKED
                  </p>
                </div>
                <p>
                  <strong>Course Coordinator:</strong> Generates calculation snapshot and submits for Department Head verification.
                </p>
                <p>
                  <strong>HOD Review:</strong> Reviews attainment percentages, approves compliant reports or requests revisions with comments.
                </p>
                <p>
                  <strong>Locking & Immutability:</strong> Approved reports can be permanently locked for NBA Accreditation. Reopening requires logged justification.
                </p>
              </div>
            </div>
          </div>

          {/* Report History & Lifecycle Grid */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  Report Lifecycle, Review & Download Registry
                </h2>
                <p className="text-xs text-slate-500">Track submission status, approvals, lock states, and re-download audited workbooks</p>
              </div>

              <span className="text-xs text-slate-400 font-semibold">{history.length} report snapshot(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">Filename & Version</th>
                    <th className="py-2.5 px-3">Template</th>
                    <th className="py-2.5 px-3">Lifecycle State</th>
                    <th className="py-2.5 px-3">Audit / Notes</th>
                    <th className="py-2.5 px-3 text-center">Governance Actions</th>
                    <th className="py-2.5 px-3 text-center">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {history.map((rep) => {
                    const status = rep.workflow_status || "CALCULATED";
                    return (
                      <tr key={rep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          <div>{rep.filename}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {new Date(rep.generated_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {rep.template_name}
                        </td>
                        <td className="py-3 px-3">
                          {getWorkflowBadge(status)}
                        </td>
                        <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                          {rep.reviewer_comments && (
                            <div className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3 text-sky-500 shrink-0" />
                              <span className="truncate">{rep.reviewer_comments}</span>
                            </div>
                          )}
                          {rep.reopen_reason && (
                            <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <Unlock className="h-3 w-3 shrink-0" />
                              <span className="truncate">Reopened: {rep.reopen_reason}</span>
                            </div>
                          )}
                          {!rep.reviewer_comments && !rep.reopen_reason && (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {(status === "CALCULATED" || status === "DRAFT") && (
                              <button
                                onClick={() => handleWorkflowAction(rep.id, "SUBMIT")}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 cursor-pointer"
                              >
                                <Send className="h-3 w-3" />
                                <span>Submit for Review</span>
                              </button>
                            )}

                            {status === "SUBMITTED" && (
                              <>
                                <button
                                  onClick={() => handleWorkflowAction(rep.id, "APPROVE")}
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                                >
                                  <CheckCheck className="h-3 w-3" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const comment = prompt("Enter revision comments for faculty:");
                                    if (comment) handleWorkflowAction(rep.id, "REJECT", comment);
                                  }}
                                  disabled={actionLoading}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer"
                                >
                                  <XCircle className="h-3 w-3" />
                                  <span>Request Revisions</span>
                                </button>
                              </>
                            )}

                            {status === "APPROVED" && (
                              <button
                                onClick={() => handleWorkflowAction(rep.id, "LOCK")}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                              >
                                <Lock className="h-3 w-3" />
                                <span>Lock for NBA</span>
                              </button>
                            )}

                            {status === "LOCKED" && (
                              <button
                                onClick={() => setReopenModalReportId(rep.id)}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 cursor-pointer"
                              >
                                <Unlock className="h-3 w-3" />
                                <span>Reopen</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-sans">
                          <a
                            href={`/api/v1/reports/download?filename=${encodeURIComponent(rep.filename)}`}
                            className="text-sky-600 hover:text-sky-700 font-bold inline-flex items-center gap-1"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        No reports generated yet. Click &quot;Generate Verified Excel Report&quot; above to create your first workbook.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Reopen Modal */}
      {reopenModalReportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Authorized Report Reopening</h3>
                <p className="text-xs text-slate-500">Provide an institutional reason for reopening this locked report</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason / Approval Reference
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Recalculation approved by HOD following marks re-evaluation (Order #2026-CSE-14)"
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReopenModalReportId(null);
                  setReopenReason("");
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reopenReason.trim() || actionLoading}
                onClick={() => handleWorkflowAction(reopenModalReportId, "REOPEN", undefined, reopenReason)}
                className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Confirm Reopen & Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
