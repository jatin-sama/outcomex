import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Users,
  Target,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Award,
  ArrowRight,
  BookOpen,
  Calculator,
} from "lucide-react";

export default function DashboardPage() {
  // Reference data extracted from Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx
  const coResults = [
    { code: "CO1", description: "Foundational principles & workflow of data science", direct: 3.0, indirect: 3.0, final: 3.0, level: 3, percent: "88.9%" },
    { code: "CO2", description: "Data preprocessing, wrangling & exploratory analysis", direct: 3.0, indirect: 3.0, final: 3.0, level: 3, percent: "86.4%" },
    { code: "CO3", description: "Statistical inference and regression models", direct: 3.0, indirect: 3.0, final: 3.0, level: 3, percent: "85.2%" },
    { code: "CO4", description: "Classification, clustering & unsupervised learning", direct: 3.0, indirect: 3.0, final: 3.0, level: 3, percent: "55.6%" },
    { code: "CO5", description: "Model performance evaluation & validation metrics", direct: 3.0, indirect: 3.0, final: 3.0, level: 3, percent: "71.6%" },
    { code: "CO6", description: "Communication of data-driven insights through visualization", direct: 3.0, indirect: 3.0, final: 3.0, level: 3, percent: "72.8%" },
  ];

  const poResults = [
    { code: "PO1", target: 3.0, achieved: 2.67, status: "High" },
    { code: "PO2", target: 3.0, achieved: 2.67, status: "High" },
    { code: "PO3", target: 2.0, achieved: 2.0, status: "Target Met" },
    { code: "PO4", target: 3.0, achieved: 2.6, status: "High" },
    { code: "PO5", target: 3.0, achieved: 2.5, status: "High" },
    { code: "PO7", target: 2.0, achieved: 1.16, status: "Moderate" },
    { code: "PO8", target: 1.0, achieved: 1.0, status: "Target Met" },
    { code: "PO9", target: 3.0, achieved: 1.5, status: "Moderate" },
    { code: "PO10", target: 1.0, achieved: 1.0, status: "Target Met" },
    { code: "PO11", target: 3.0, achieved: 2.67, status: "High" },
    { code: "PSO 1", target: 2.0, achieved: 2.0, status: "Target Met" },
    { code: "PSO 2", target: 2.0, achieved: 2.0, status: "Target Met" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/" />

        <main className="flex-1 p-6 lg:p-8 space-y-8 max-w-7xl">
          {/* Welcome & Course Offering Header */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md bg-sky-50 dark:bg-sky-950/80 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 mb-2">
                  <span>Priyadarshini College of Engineering, Nagpur</span>
                  <span>•</span>
                  <span>Autonomous Scheme 2025-26</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Introduction to Data Science (25UCS623T)
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  3rd Year / 5th Semester • Section A • Department of Computer Science & Engineering
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/marks"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Enter / Import Marks
                </Link>
                <Link
                  href="/reports"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Export Template (.xlsx)
                </Link>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span>Enrolled Students</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">81</p>
                <p className="text-[11px] text-slate-400 mt-0.5">80 attended assessments</p>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Course Outcomes</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">6 COs</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">100% Attained Level 3</p>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Attainment Scheme</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">60 / 40</p>
                <p className="text-[11px] text-slate-400 mt-0.5">40% IAM + 60% Endsem</p>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span>Direct / Indirect</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">80% / 20%</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Threshold: 45% of max marks</p>
              </div>
            </div>
          </div>

          {/* Data Validation Alert (Findings from Audit) */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <h2 className="font-semibold text-amber-900 dark:text-amber-300">
                  Data Entry Attention Items (From Reference Excel File)
                </h2>
                <p className="text-amber-800/90 dark:text-amber-400/90 mt-1 text-xs leading-relaxed">
                  The automated validation engine flagged <strong>2 mark values exceeding maximum component limits</strong> in the workbook:
                  Roll 138 (JEET LAMBAT) scored 19/10 in Mid Term-I CO2, and Roll 218 scored 9/8 in ESE CO5.
                  The OutcomeX marks editor allows you to inspect and correct these anomalies prior to report generation.
                </p>
              </div>
            </div>
          </div>

          {/* Course Outcomes Attainment Grid */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Course Outcomes (CO) Attainment Summary
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Evaluated using 80% Direct Assessment (40% IAM + 60% ESE) + 20% Indirect Exit Survey
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All 6 COs Met Target
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                    <th className="py-3 px-4">CO Code</th>
                    <th className="py-3 px-4">Outcome Description</th>
                    <th className="py-3 px-4 text-center">Class Attained %</th>
                    <th className="py-3 px-4 text-center">Direct Att.</th>
                    <th className="py-3 px-4 text-center">Indirect Att.</th>
                    <th className="py-3 px-4 text-center">Final Attainment</th>
                    <th className="py-3 px-4 text-center">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {coResults.map((co) => (
                    <tr key={co.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{co.code}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md">{co.description}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800 dark:text-slate-200">{co.percent}</td>
                      <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">{co.direct.toFixed(1)}</td>
                      <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">{co.indirect.toFixed(1)}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-white">{co.final.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-bold badge-level-3">
                          Level {co.level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Program Outcomes (PO/PSO) Matrix Preview */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Program Outcome (PO & PSO) Attainment Mapping
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calculated through mapping strength matrix weighted against Final CO Attainment
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {poResults.map((po) => (
                <div
                  key={po.code}
                  className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40 p-3 text-center"
                >
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{po.code}</p>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {po.achieved.toFixed(2)}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                    {po.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
