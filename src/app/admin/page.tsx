"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Settings,
  ShieldCheck,
  Building2,
  BookOpen,
  Award,
  Sliders,
  CheckCircle2,
  Users,
  Database,
  FileCheck,
  HelpCircle,
  Save,
  RotateCcw,
} from "lucide-react";
import { INITIAL_COURSE, INITIAL_OFFERING, INITIAL_SCHEMES, INITIAL_POS } from "@/lib/data/initialData";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"policies" | "schemes" | "pos" | "faculty">("policies");

  // Department Policy Settings State
  const [poAggregationMode, setPoAggregationMode] = useState<"reference" | "weighted">("reference");
  const [studentThreshold, setStudentThreshold] = useState(45);
  const [level2Boundary, setLevel2Boundary] = useState(45);
  const [level3Boundary, setLevel3Boundary] = useState(55);
  const [absenteePolicy, setAbsenteePolicy] = useState<"zero" | "exclude">("zero");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load saved policies on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("outcomeX_admin_policies");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.poAggregationMode) setPoAggregationMode(parsed.poAggregationMode);
        if (parsed.studentThreshold) setStudentThreshold(Number(parsed.studentThreshold));
        if (parsed.level2Boundary) setLevel2Boundary(Number(parsed.level2Boundary));
        if (parsed.level3Boundary) setLevel3Boundary(Number(parsed.level3Boundary));
        if (parsed.absenteePolicy) setAbsenteePolicy(parsed.absenteePolicy);
      }
    } catch {}
  }, []);

  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(
        "outcomeX_admin_policies",
        JSON.stringify({
          poAggregationMode,
          studentThreshold,
          level2Boundary,
          level3Boundary,
          absenteePolicy,
        })
      );
    } catch {}

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Department Admin / HOD" />

      <div className="flex">
        <Sidebar currentPath="/admin" />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                  HOD & Admin Portal
                </span>
                <span className="text-xs text-slate-500">PCE Nagpur Autonomous</span>
              </div>
              <h1 className="mt-1 text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Department OBE Administration
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage accreditation policies, attainment scheme parameters, NBA PO/PSO catalogs, and course allocations
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                <span>RLS Active (19 Tables)</span>
              </span>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Department</span>
                <Building2 className="h-4 w-4 text-sky-600" />
              </div>
              <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                Comp. Sci. & Engg.
              </p>
              <p className="mt-1 text-xs text-slate-500">Academic Year 2025-26</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Attainment Schemes</span>
                <Sliders className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                60/40 & 30/20 v1
              </p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                PCE Autonomous Approved
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">PO / PSO Catalog</span>
                <Award className="h-4 w-4 text-purple-600" />
              </div>
              <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                12 POs + 2 PSOs
              </p>
              <p className="mt-1 text-xs text-slate-500">NBA Criteria 1–12 Mapped</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Supabase Staging</span>
                <Database className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                Healthy
              </p>
              <p className="mt-1 text-xs text-slate-500 truncate" title="twuvuovkznrksymbobav.supabase.co">
                twuvuovkznrksymbobav
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
            {[
              { id: "policies", label: "Institutional Policies & Thresholds", icon: Sliders },
              { id: "schemes", label: "Curriculum Schemes", icon: BookOpen },
              { id: "pos", label: "PO & PSO Definitions", icon: Award },
              { id: "faculty", label: "Course Allocations & Teachers", icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
                    isActive
                      ? "border-sky-600 text-sky-600 dark:text-sky-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: POLICIES */}
          {activeTab === "policies" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    PCE Autonomous Institutional OBE Parameters
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Department-wide configuration governing student qualification cut-offs and attainment boundaries.
                  </p>
                </div>

                <form onSubmit={handleSavePolicies} className="space-y-6">
                  {/* PO Aggregation Mode Policy Switch */}
                  <div className="rounded-xl border border-sky-100 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-sky-600" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          PO Attainment Calculation Formula (Department Policy)
                        </h3>
                      </div>
                      <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        Institutional Approval Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Determine how Program Outcome attainment values are synthesized from Course Outcome levels:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <label
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          poAggregationMode === "reference"
                            ? "border-sky-600 bg-white dark:bg-slate-900 shadow-sm"
                            : "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="poMode"
                            checked={poAggregationMode === "reference"}
                            onChange={() => setPoAggregationMode("reference")}
                            className="mt-1 text-sky-600"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              Mode A: Direct Mapping-Strength Average (Reference Mode)
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Matches the original PCE Autonomous reference template formula:
                              <br />
                              <code className="text-sky-600 dark:text-sky-400 font-mono text-[10px]">
                                PO Attainment = AVERAGE(CO Mapping Strength for mapped COs)
                              </code>
                            </p>
                          </div>
                        </div>
                      </label>

                      <label
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          poAggregationMode === "weighted"
                            ? "border-sky-600 bg-white dark:bg-slate-900 shadow-sm"
                            : "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="poMode"
                            checked={poAggregationMode === "weighted"}
                            onChange={() => setPoAggregationMode("weighted")}
                            className="mt-1 text-sky-600"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              Mode B: Attainment-Weighted Formula
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Weights attained levels by CO-PO matrix correlation coefficient:
                              <br />
                              <code className="text-sky-600 dark:text-sky-400 font-mono text-[10px]">
                                PO = Sum(Attainment * Mapping) / Sum(Mapping)
                              </code>
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Thresholds */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Student Qualification Threshold
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={studentThreshold}
                          onChange={(e) => setStudentThreshold(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                        />
                        <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">%</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Default: 45% marks required to consider a student qualified.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Class Level 2 Boundary
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={level2Boundary}
                          onChange={(e) => setLevel2Boundary(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                        />
                        <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">%</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Default: 45% students qualified $\rightarrow$ Attainment Level 2.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Class Level 3 Boundary
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={level3Boundary}
                          onChange={(e) => setLevel3Boundary(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                        />
                        <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">%</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Default: 55% students qualified $\rightarrow$ Attainment Level 3.
                      </p>
                    </div>
                  </div>

                  {/* Absenteeism Rule */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Student Absenteeism & Missing Marks Rule
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label
                        className={`cursor-pointer rounded-xl border p-3 flex items-center gap-3 ${
                          absenteePolicy === "zero"
                            ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/20"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="absenteePolicy"
                          checked={absenteePolicy === "zero"}
                          onChange={() => setAbsenteePolicy("zero")}
                          className="text-sky-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            Zero Marks (Standard PCE Policy)
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Absentees are assigned 0 marks and included in the total cohort denominator.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`cursor-pointer rounded-xl border p-3 flex items-center gap-3 ${
                          absenteePolicy === "exclude"
                            ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/20"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="absenteePolicy"
                          checked={absenteePolicy === "exclude"}
                          onChange={() => setAbsenteePolicy("exclude")}
                          className="text-sky-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            Exclude from Denominator
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Absent students are removed from the percentage calculation base.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {savedSuccess && (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Policy updates saved and locked for Academic Year 2025-26!</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save Department Policies</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: CURRICULUM SCHEMES */}
          {activeTab === "schemes" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {INITIAL_SCHEMES.map((scheme) => (
                  <div
                    key={scheme.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="rounded bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                          Version {scheme.version}.0
                        </span>
                        <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                          {scheme.scheme_name}
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                        <span className="text-slate-400 font-medium">Internal Assessment (IAM)</span>
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {Math.round(scheme.iam_weight * 100)}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                        <span className="text-slate-400 font-medium">End Semester Exam (ESE)</span>
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {Math.round(scheme.esam_weight * 100)}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                        <span className="text-slate-400 font-medium">Direct Weight</span>
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {Math.round(scheme.direct_weight * 100)}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                        <span className="text-slate-400 font-medium">Indirect (Exit Survey)</span>
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {Math.round(scheme.indirect_weight * 100)}%
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                      Components: Continuous Assessment (CA1, CA2), Mid-Semester Exam (MSE), Prelim Examination, and ESE University Marksheet.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: POS & PSOS */}
          {activeTab === "pos" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Program Outcomes (PO1–PO12) & PSOs Master Catalog
                  </h2>
                  <p className="text-xs text-slate-500">
                    National Board of Accreditation (NBA) Tier-1 Washington Accord Graduate Attributes
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Target Benchmark: 2.0 / 3.0
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {INITIAL_POS.map((po) => (
                  <div key={po.id} className="py-3 flex items-start gap-4 text-xs">
                    <span className="shrink-0 font-bold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 text-xs">
                      {po.po_code}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 dark:text-white">{po.description}</p>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">Category: {po.po_type}</p>
                    </div>
                    <span className="shrink-0 text-slate-400 font-medium">
                      Target: 2.0
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: FACULTY ALLOCATIONS */}
          {activeTab === "faculty" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Active Faculty & Course Allocations
                </h2>
                <p className="text-xs text-slate-500">
                  Teachers assigned as Course Coordinators with access to mark sheets and attainment recalculation
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5">Course Code</th>
                      <th className="py-2.5">Course Name</th>
                      <th className="py-2.5">Semester & Year</th>
                      <th className="py-2.5">Assigned Teacher</th>
                      <th className="py-2.5">Students</th>
                      <th className="py-2.5">Attainment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-3 font-bold text-sky-600 dark:text-sky-400">
                        {INITIAL_COURSE.course_code}
                      </td>
                      <td className="py-3 font-medium text-slate-900 dark:text-white">
                        {INITIAL_COURSE.course_name}
                      </td>
                      <td className="py-3 text-slate-500">
                        {INITIAL_COURSE.semester} • {INITIAL_COURSE.year_of_study}
                      </td>
                      <td className="py-3 text-slate-700 dark:text-slate-300">
                        teacher.cse@pce.edu.in
                      </td>
                      <td className="py-3 font-semibold text-slate-900 dark:text-white">
                        81 Students
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Calculated (Level 3.0)
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
