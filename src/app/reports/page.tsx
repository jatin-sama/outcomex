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
  FileCheck,
  RefreshCw,
  ExternalLink,
  Layers,
} from "lucide-react";
import { INITIAL_COURSE, INITIAL_OFFERING } from "@/lib/data/initialData";

export default function ReportsPage() {
  const offeringId = INITIAL_OFFERING.id;

  const [selectedScheme, setSelectedScheme] = useState<"60_40" | "30_20">("60_40");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDownloadUrl, setCurrentDownloadUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Fetch report history
  const fetchHistory = async () => {
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
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCurrentDownloadUrl(null);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemeType: selectedScheme }),
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
                Excel Attainment Report Generator
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Generate byte-exact workbooks matching Priyadarshini College of Engineering template formats
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
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/25 transition-all disabled:opacity-50"
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
                Template Integrity Safeguards
              </h3>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <p>
                  <strong>Template Fidelity:</strong> The OutcomeX Excel adapter loads the verified master workbook and populates student rows while retaining all cell formulas (e.g. <code className="font-mono text-[11px]">=AVERAGE(...)</code>, <code className="font-mono text-[11px]">=COUNTIF(...)</code>).
                </p>
                <p>
                  <strong>Formula Repair:</strong> Broken references in the 30/20 template (such as `#REF!` in row 7) are cleanly reconstructed without modifying the original template.
                </p>
                <p>
                  <strong>Reproducibility:</strong> Every generated report receives an immutable SHA-256 checksum and timestamp for accreditation audit trails.
                </p>
              </div>
            </div>
          </div>

          {/* Report History */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  Report Generation & Download History
                </h2>
                <p className="text-xs text-slate-500">Previously compiled Excel workbooks available for re-download</p>
              </div>

              <span className="text-xs text-slate-400">{history.length} report run(s) logged</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">Filename</th>
                    <th className="py-2.5 px-3">Template</th>
                    <th className="py-2.5 px-3 text-center">File Size</th>
                    <th className="py-2.5 px-3">Generated At</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {history.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white font-sans">
                        {rep.filename}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-sans">
                        {rep.template_name}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500">
                        {(rep.file_size_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-sans">
                        {new Date(rep.generated_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {rep.status}
                        </span>
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
                  ))}
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
    </div>
  );
}
