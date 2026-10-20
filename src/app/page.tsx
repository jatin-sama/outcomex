import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userRole = (user.user_metadata?.role as string) || "Teacher / Course Coordinator";
  const userEmail = user.email || "";

  let enrolledCount = 0;
  let activeOfferingsCount = 1;
  let pendingReportsCount = 0;
  let activeCourseName = "Introduction to Data Science (25UCS623T)";
  let activeOfferingSection = "3rd Year / 5th Semester • Section A • Department of Computer Science & Engineering";

  try {
    const { offeringStore, DEFAULT_OFFERING_ID } = await import("@/lib/domain/offeringStore");
    const initialRoster = await offeringStore.getRoster(DEFAULT_OFFERING_ID);
    enrolledCount = initialRoster.length;

    const { getDbClient } = await import("@/lib/supabase/admin");
    const db = await getDbClient();

    const { count: studentCount } = await db
      .from("students")
      .select("*", { count: "exact", head: true });
    if (typeof studentCount === "number" && studentCount > 0) {
      enrolledCount = studentCount;
    }

    const { data: offerings } = await db
      .from("course_offerings")
      .select(`
        id,
        section,
        courses (
          course_code,
          course_name,
          semester,
          year_of_study
        )
      `)
      .limit(5);

    let activeOfferingId = DEFAULT_OFFERING_ID;
    if (offerings && offerings.length > 0) {
      activeOfferingsCount = offerings.length;
      const first: any = offerings[0];
      activeOfferingId = first.id;
      if (first.courses) {
        activeCourseName = `${first.courses.course_name} (${first.courses.course_code})`;
        activeOfferingSection = `${first.courses.year_of_study} / ${first.courses.semester} • Section ${first.section || "A"} • Department of Computer Science & Engineering`;
      }
    }

    const { count: pendingCount } = await db
      .from("report_runs")
      .select("*", { count: "exact", head: true })
      .in("workflow_status", ["SUBMITTED", "UNDER_REVIEW"]);
    if (typeof pendingCount === "number") {
      pendingReportsCount = pendingCount;
    }
  } catch {}

  let coResults: any[] = [];
  let poResults: any[] = [];
  let summaryData: any = null;

  try {
    const { calculateOfferingAttainment, DEFAULT_OFFERING_ID } = await import("@/lib/domain/offeringStore");
    const calc = await calculateOfferingAttainment(DEFAULT_OFFERING_ID);
    if (calc && calc.co_results && calc.co_results.length > 0) {
      coResults = calc.co_results;
      poResults = calc.po_results || [];
      summaryData = calc.summary;
    }
  } catch {}

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole={userRole} userEmail={userEmail} />

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
                  {activeCourseName}
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {activeOfferingSection}
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
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{enrolledCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{enrolledCount > 1 ? `${enrolledCount - 1} attended assessments` : "Active student roster"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Course Outcomes</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {coResults.length > 0 ? `${coResults.length} COs` : "0 COs"}
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {summaryData ? `Avg: ${summaryData.average_final_co_attainment.toFixed(2)} / 3.00` : "Pending marks entry"}
                </p>
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

          {/* Pending Reports Notice */}
          {pendingReportsCount > 0 && (
            <div className="rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/80 dark:bg-sky-950/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <div className="text-sm">
                    <h2 className="font-semibold text-sky-900 dark:text-sky-200">
                      Attainment Reports Awaiting Review ({pendingReportsCount})
                    </h2>
                    <p className="text-sky-800/80 dark:text-sky-400/80 text-xs mt-0.5">
                      Submitted course attainment reports are pending HOD / Coordinator approval.
                    </p>
                  </div>
                </div>
                <Link
                  href="/reports"
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
                >
                  Review in Report Center
                </Link>
              </div>
            </div>
          )}

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
              {coResults.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {summaryData ? `Avg Attainment: ${summaryData.average_final_co_attainment.toFixed(2)}` : "Calculated"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  Pending Marks
                </span>
              )}
            </div>

            {coResults.length > 0 ? (
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
                      <tr key={co.co_code || co.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{co.co_code || co.code}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md">{co.co_description || co.description || "-"}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-800 dark:text-slate-200">
                          {typeof co.class_percentage === "number" ? `${co.class_percentage.toFixed(1)}%` : co.percent || "-"}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">
                          {typeof co.direct_level === "number" ? co.direct_level.toFixed(1) : typeof co.direct === "number" ? co.direct.toFixed(1) : "-"}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">
                          {typeof co.indirect_level === "number" ? co.indirect_level.toFixed(1) : typeof co.indirect === "number" ? co.indirect.toFixed(1) : "-"}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-white">
                          {typeof co.final_attainment === "number" ? co.final_attainment.toFixed(2) : typeof co.final === "number" ? co.final.toFixed(2) : "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-bold badge-level-3">
                            Level {co.direct_level !== undefined ? Math.round(co.direct_level) : co.level || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Target className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No attainment records computed yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Student marks must be entered or imported to calculate Course Outcome and Program Outcome attainment.
                </p>
                <Link
                  href="/marks"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Enter / Import Marks
                </Link>
              </div>
            )}
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

            {poResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {poResults.map((po) => (
                  <div
                    key={po.po_code || po.code}
                    className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40 p-3 text-center"
                  >
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{po.po_code || po.code}</p>
                    <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {typeof po.achieved_value === "number" ? po.achieved_value.toFixed(2) : typeof po.achieved === "number" ? po.achieved.toFixed(2) : "-"}
                    </p>
                    <span className="inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                      {po.status || "Target Met"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500">
                Program Outcome attainment values will appear here after Course Outcome calculation is complete.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
