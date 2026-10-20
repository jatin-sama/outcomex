"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Calculator,
  Target,
  Award,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  Download,
  Info,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Search,
  BookOpen,
} from "lucide-react";
import { INITIAL_OFFERING, INITIAL_COURSE } from "@/lib/data/initialData";
import { EngineCalculationOutput, COAttainmentResult, POAttainmentResult } from "@/lib/engine/attainmentEngine";

export default function AttainmentPage() {
  const [offeringId, setOfferingId] = useState<string>(INITIAL_OFFERING.id);

  const [activeTab, setActiveTab] = useState<"overview" | "breakdown" | "components" | "students">("overview");
  const [data, setData] = useState<EngineCalculationOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCO, setSelectedCO] = useState<COAttainmentResult | null>(null);
  const [selectedPO, setSelectedPO] = useState<POAttainmentResult | null>(null);
  const [searchStudent, setSearchStudent] = useState("");

  // Load courses and sync active offeringId
  useEffect(() => {
    fetch("/api/v1/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((courseData) => {
        if (courseData?.courses && Array.isArray(courseData.courses) && courseData.courses.length > 0) {
          const stored = typeof window !== "undefined" ? localStorage.getItem("outcomeX_active_offering_id") : null;
          const param = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("offeringId") : null;
          const activeId = param || stored;
          const exists = activeId && courseData.courses.some((c: any) => (c.offering?.id || c.id) === activeId);
          const targetId = exists ? activeId : (courseData.courses[0].offering?.id || courseData.courses[0].id);
          if (targetId) {
            setOfferingId(targetId);
            if (typeof window !== "undefined") {
              localStorage.setItem("outcomeX_active_offering_id", targetId);
            }
            fetchCalculation(targetId);
          }
        } else {
          fetchCalculation();
        }
      })
      .catch(() => {
        fetchCalculation();
      });
  }, []);

  const fetchCalculation = async (activeId?: string) => {
    const idToUse = activeId || offeringId;
    if (!idToUse) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/offerings/${idToUse}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      setData(result);
      if (result.co_results?.length) setSelectedCO(result.co_results[0]);
    } catch (err) {
      console.error("Calculation fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalculation(offeringId);
  }, [offeringId]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/attainment" />

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
                OBE Attainment Engine & Inspection
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {INITIAL_COURSE.course_code} • {INITIAL_COURSE.course_name} (Autonomous 60/40 Scheme)
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => fetchCalculation(offeringId)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Recalculate
              </button>

              <Link
                href="/reports"
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export Workbook (.xlsx)
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {data && (() => {
            const coCount = data.co_results?.length || 0;
            const targetMetCount = data.co_results?.filter((c) => c.class_percentage >= 50).length || 0;
            const pctMet = coCount > 0 ? Math.round((targetMetCount / coCount) * 100) : 0;

            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <span className="text-xs font-medium text-slate-500">CO Attainment Status</span>
                  <p className={`text-xl font-bold mt-1 flex items-center gap-1.5 ${pctMet >= 80 ? "text-emerald-600 dark:text-emerald-400" : pctMet >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                    <CheckCircle2 className="h-5 w-5" />
                    {coCount > 0 ? `${pctMet}% Target Met` : "No CO Data"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {coCount > 0 ? `${targetMetCount} of ${coCount} COs attained target` : "No outcomes configured"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <span className="text-xs font-medium text-slate-500">Average Final Attainment</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {data.summary ? `${data.summary.average_final_co_attainment.toFixed(2)} / 3.00` : "-"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">80% Direct + 20% Indirect</p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <span className="text-xs font-medium text-slate-500">Highest Attained CO</span>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {data.summary?.highest_attained_co || "-"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {data.co_results?.find((c) => c.co_code === data.summary?.highest_attained_co)?.class_percentage?.toFixed(1) || "0"}% students attained
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <span className="text-xs font-medium text-slate-500">Evaluated Cohort</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {data.total_students_enrolled} Students
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Threshold: 45% of component max</p>
                </div>
              </div>
            );
          })()}

          {loading && (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 text-sky-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calculating OBE Attainment...</p>
              <p className="text-xs text-slate-400 mt-1">Aggregating component marks and outcomes from database</p>
            </div>
          )}

          {!loading && (!data || !data.co_results || data.co_results.length === 0) && (
            <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-8">
              <Target className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No Attainment Calculations Recorded</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No marks have been recorded for this course offering yet. Enter or import marks to generate complete OBE attainment analysis.
              </p>
              <Link
                href="/marks"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Go to Marks Entry
              </Link>
            </div>
          )}

          {/* Navigation Tabs */}
          {!loading && data && data.co_results && data.co_results.length > 0 && (
            <>
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
                {[
                  { id: "overview", label: "Final Attainment Overview" },
                  { id: "breakdown", label: "Calculation Inspection & Breakdown" },
                  { id: "components", label: "Assessment Component Stats" },
                  { id: "students", label: "Student Performance Sheet" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && data && (
                <div className="space-y-6">
                  {/* Course Outcomes Table */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Course Outcomes (CO) Attainment Levels
                      </h2>
                      <span className="text-xs text-slate-500">Autonomous 60/40 Scheme</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                            <th className="py-2.5 px-3">CO Code</th>
                            <th className="py-2.5 px-3 text-center">Attained Students (≥45%)</th>
                            <th className="py-2.5 px-3 text-center">Class Attained %</th>
                            <th className="py-2.5 px-3 text-center">Direct Level</th>
                            <th className="py-2.5 px-3 text-center">Indirect Level</th>
                            <th className="py-2.5 px-3 text-center font-bold">Final Attainment</th>
                            <th className="py-2.5 px-3 text-center">Attainment Level</th>
                            <th className="py-2.5 px-3 text-center">Inspect</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                          {data.co_results.map((co) => (
                            <tr key={co.co_code} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="py-3 px-3 font-bold text-slate-900 dark:text-white font-sans">
                                {co.co_code}
                              </td>
                              <td className="py-3 px-3 text-center text-slate-700 dark:text-slate-300">
                                {co.attained_students} / {co.total_students}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-white">
                                {co.class_percentage.toFixed(1)}%
                              </td>
                              <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">
                                {co.direct_level.toFixed(1)}
                              </td>
                              <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">
                                {co.indirect_level.toFixed(1)}
                              </td>
                              <td className="py-3 px-3 text-center font-extrabold text-slate-900 dark:text-white">
                                {co.final_attainment.toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-center font-sans">
                                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                                  co.direct_level >= 2.5 ? "badge-level-3" : co.direct_level >= 1.5 ? "badge-level-2" : "badge-level-1"
                                }`}>
                                  Level {Math.round(co.direct_level)}
                                </span>
                              </td>
                          <td className="py-3 px-3 text-center font-sans">
                            <button
                              onClick={() => {
                                setSelectedCO(co);
                                setActiveTab("breakdown");
                              }}
                              className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Program Outcomes Grid */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Program Outcomes (PO & PSO) Attainment
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {data.po_results.map((po) => (
                    <div
                      key={po.po_code}
                      onClick={() => {
                        setSelectedPO(po);
                        setActiveTab("breakdown");
                      }}
                      className="cursor-pointer rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 text-center hover:border-sky-400 transition-all"
                    >
                      <span className="text-xs font-bold text-slate-500 uppercase">{po.po_code}</span>
                      <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                        {po.achieved_attainment !== null ? po.achieved_attainment.toFixed(2) : "-"}
                      </p>
                      <span className="inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {po.is_mapped ? `Target Met (${po.mapped_cos_count} COs)` : "Unmapped"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BREAKDOWN & INSPECTION */}
          {activeTab === "breakdown" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Selector List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Item to Inspect</h3>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  <p className="text-[11px] font-bold text-slate-400 uppercase pt-1">Course Outcomes</p>
                  {data?.co_results.map((co) => (
                    <button
                      key={co.co_code}
                      onClick={() => {
                        setSelectedCO(co);
                        setSelectedPO(null);
                      }}
                      className={`w-full text-left rounded-xl p-3 border transition-all text-xs ${
                        selectedCO?.co_code === co.co_code && !selectedPO
                          ? "border-sky-600 bg-sky-50 dark:bg-sky-950/60 font-bold text-sky-800 dark:text-sky-300"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{co.co_code}</span>
                        <span>Level {co.direct_level}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-normal">
                        Class Attainment: {co.class_percentage.toFixed(1)}%
                      </span>
                    </button>
                  ))}

                  <p className="text-[11px] font-bold text-slate-400 uppercase pt-2">Program Outcomes</p>
                  {data?.po_results
                    .filter((p) => p.is_mapped)
                    .map((po) => (
                      <button
                        key={po.po_code}
                        onClick={() => {
                          setSelectedPO(po);
                          setSelectedCO(null);
                        }}
                        className={`w-full text-left rounded-xl p-3 border transition-all text-xs ${
                          selectedPO?.po_code === po.po_code
                            ? "border-sky-600 bg-sky-50 dark:bg-sky-950/60 font-bold text-sky-800 dark:text-sky-300"
                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{po.po_code}</span>
                          <span>{po.achieved_attainment?.toFixed(2)}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Mapped to {po.mapped_cos_count} COs
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Inspection Details */}
              <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
                {selectedCO && !selectedPO && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <span className="rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-xs font-bold">
                          Course Outcome
                        </span>
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                          {selectedCO.co_code} Calculation Arithmetic
                        </h2>
                      </div>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        Final: {selectedCO.final_attainment.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <h4 className="font-bold text-slate-500 uppercase">Formula</h4>
                        <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg font-mono text-slate-800 dark:text-slate-200 mt-1">
                          {selectedCO.explanation.formula}
                        </code>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-500 uppercase">Arithmetic Steps</h4>
                        <ol className="list-decimal pl-5 space-y-1.5 text-slate-700 dark:text-slate-300 font-mono mt-1">
                          {selectedCO.explanation.steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="pt-2">
                        <h4 className="font-bold text-slate-500 uppercase">Inputs & Constants</h4>
                        <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-slate-700 dark:text-slate-300">
                          {Object.entries(selectedCO.explanation.inputs).map(([k, v]) => (
                            <div key={k} className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400 block text-[10px]">{k}:</span>
                              <span className="font-bold">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPO && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <span className="rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-xs font-bold">
                          {selectedPO.po_type} Attainment
                        </span>
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                          {selectedPO.po_code} Weighted Calculation
                        </h2>
                      </div>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        Achieved: {selectedPO.achieved_attainment?.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <h4 className="font-bold text-slate-500 uppercase">Formula</h4>
                        <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg font-mono text-slate-800 dark:text-slate-200 mt-1">
                          {selectedPO.explanation.formula}
                        </code>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-500 uppercase">Arithmetic Steps</h4>
                        <ol className="list-decimal pl-5 space-y-1.5 text-slate-700 dark:text-slate-300 font-mono mt-1">
                          {selectedPO.explanation.steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: COMPONENTS */}
          {activeTab === "components" && data && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Assessment Component Attainment Statistics
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 text-slate-500 uppercase font-sans">
                    <tr>
                      <th className="py-2.5 px-3">Assessment</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-center">Max Marks</th>
                      <th className="py-2.5 px-3 text-center">Threshold Mark (45%)</th>
                      <th className="py-2.5 px-3 text-center">Attained Count</th>
                      <th className="py-2.5 px-3 text-center">Attainment %</th>
                      <th className="py-2.5 px-3 text-center font-sans">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.component_results.map((comp) => (
                      <tr key={comp.key}>
                        <td className="py-2.5 px-3 font-bold font-sans">{comp.label}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-sans">{comp.category}</td>
                        <td className="py-2.5 px-3 text-center">{comp.max_marks}</td>
                        <td className="py-2.5 px-3 text-center">{comp.threshold_mark}</td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {comp.attained_count} / {comp.total_eligible}
                        </td>
                        <td className="py-2.5 px-3 text-center">{comp.attainment_percent.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              comp.attainment_level === 3
                                ? "badge-level-3"
                                : comp.attainment_level === 2
                                ? "badge-level-2"
                                : "badge-level-1"
                            }`}
                          >
                            Level {comp.attainment_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: STUDENTS */}
          {activeTab === "students" && data && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Student-by-Student Evaluated Percentages
                </h2>

                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search roll number or name..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 text-slate-600 font-sans">
                    <tr>
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3 text-center">CO1%</th>
                      <th className="py-2.5 px-3 text-center">CO2%</th>
                      <th className="py-2.5 px-3 text-center">CO3%</th>
                      <th className="py-2.5 px-3 text-center">CO4%</th>
                      <th className="py-2.5 px-3 text-center">CO5%</th>
                      <th className="py-2.5 px-3 text-center">CO6%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.student_results
                      .filter(
                        (s) =>
                          s.roll_no.toLowerCase().includes(searchStudent.toLowerCase()) ||
                          s.student_name.toLowerCase().includes(searchStudent.toLowerCase())
                      )
                      .map((s) => (
                        <tr key={s.student_id}>
                          <td className="py-2 px-3 font-bold">{s.roll_no}</td>
                          <td className="py-2 px-3 font-sans truncate max-w-xs">{s.student_name}</td>
                          {["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"].map((code) => {
                            const p = s.co_percentages[code];
                            return (
                              <td
                                key={code}
                                className={`py-2 px-3 text-center ${
                                  p >= 45 ? "text-emerald-700 font-bold" : "text-rose-600"
                                }`}
                              >
                                {p !== undefined ? `${p.toFixed(1)}%` : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
