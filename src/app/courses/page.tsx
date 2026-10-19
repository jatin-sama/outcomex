"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  BookOpen,
  Plus,
  Users,
  Calendar,
  Settings,
  ChevronRight,
  ShieldCheck,
  Award,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { INITIAL_COURSE, INITIAL_OFFERING, INITIAL_SCHEMES } from "@/lib/data/initialData";

const DEFAULT_COURSES = [
  {
    ...INITIAL_COURSE,
    offering: INITIAL_OFFERING,
    studentsCount: 81,
    cosCount: 6,
    schemeName: "Autonomous 60/40 Scheme",
  },
];

export default function CoursesPage() {
  const [courses, setCourses] = useState(DEFAULT_COURSES);
  const [loading, setLoading] = useState(false);
  const [activeOfferingId, setActiveOfferingId] = useState<string>("");

  const refreshCourses = () => {
    fetch("/api/v1/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.courses && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
          const stored = localStorage.getItem("outcomeX_active_offering_id");
          if (stored) {
            setActiveOfferingId(stored);
          } else if (data.courses[0]?.offering?.id) {
            setActiveOfferingId(data.courses[0].offering.id);
            localStorage.setItem("outcomeX_active_offering_id", data.courses[0].offering.id);
          }
        }
      })
      .catch(() => {});
  };

  // Load courses from Supabase database via API
  React.useEffect(() => {
    refreshCourses();
    const stored = localStorage.getItem("outcomeX_active_offering_id");
    if (stored) setActiveOfferingId(stored);
  }, []);

  const handleSetActive = (offeringId: string) => {
    setActiveOfferingId(offeringId);
    localStorage.setItem("outcomeX_active_offering_id", offeringId);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSemester, setNewSemester] = useState("5th Sem");
  const [newYear, setNewYear] = useState("3rd Yr");
  const [newScheme, setNewScheme] = useState(INITIAL_SCHEMES[0].id);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    setLoading(true);
    const selectedScheme = INITIAL_SCHEMES.find((s) => s.id === newScheme) || INITIAL_SCHEMES[0];

    try {
      const res = await fetch("/api/v1/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_code: newCode.trim().toUpperCase(),
          course_name: newName.trim(),
          semester: newSemester,
          year_of_study: newYear,
          attainment_scheme_id: selectedScheme.id,
        }),
      });

      const data = await res.json();
      if (data?.course) {
        setCourses((prev) => [data.course, ...prev]);
        if (data.course.offering?.id) {
          handleSetActive(data.course.offering.id);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
      setIsModalOpen(false);
      setNewCode("");
      setNewName("");
      refreshCourses();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/courses" />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Courses & Offerings Management
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Configure curriculum outcomes, attainment schemes, and assigned student cohorts
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Course
            </button>
          </div>

          {/* Department Filter Banner */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Department:</span>
              <span className="rounded bg-sky-100 dark:bg-sky-950/80 px-2.5 py-1 font-bold text-sky-700 dark:text-sky-300">
                CSE (Computer Science & Engineering)
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Academic Year:</span>
              <span className="font-bold text-slate-900 dark:text-white">2025-26</span>
            </div>

            <span className="text-slate-500">
              Showing <strong>{courses.length}</strong> active course offering(s)
            </span>
          </div>

          {/* Courses List */}
          <div className="grid grid-cols-1 gap-4">
            {courses.map((course) => {
              const offeringId = course.offering?.id || course.id;
              const isActive = activeOfferingId === offeringId;

              return (
                <div
                  key={course.id}
                  className={`rounded-2xl border p-6 transition-all ${
                    isActive
                      ? "border-sky-500 dark:border-sky-500 bg-white dark:bg-slate-900 shadow-md ring-1 ring-sky-500/30"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-sky-100 dark:bg-sky-950/80 px-2.5 py-1 font-mono text-xs font-bold text-sky-700 dark:text-sky-300">
                          {course.course_code}
                        </span>
                        <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {course.semester} • {course.year_of_study}
                        </span>
                        <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          Section {course.offering?.section || "A"}
                        </span>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-0.5 text-[11px] font-bold shadow-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            Active Offering
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetActive(offeringId)}
                            className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            Set as Active
                          </button>
                        )}
                      </div>

                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {course.course_name}
                      </h2>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-slate-400" />
                          <span className={course.studentsCount > 0 ? "font-semibold text-slate-800 dark:text-slate-200" : "text-amber-600 dark:text-amber-400 font-semibold"}>
                            {course.studentsCount} Students Enrolled
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-4 w-4 text-slate-400" />
                          <span>{course.cosCount} Course Outcomes</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-slate-400" />
                          <span>Scheme: {course.schemeName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                      <Link
                        href={`/courses/${offeringId}/setup`}
                        onClick={() => handleSetActive(offeringId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        COs & Scheme
                      </Link>

                      <Link
                        href={`/roster?offeringId=${offeringId}`}
                        onClick={() => handleSetActive(offeringId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Roster ({course.studentsCount})
                      </Link>

                      <Link
                        href={`/marks?offeringId=${offeringId}`}
                        onClick={() => handleSetActive(offeringId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        Marks Entry
                      </Link>

                      <Link
                        href={`/reports?offeringId=${offeringId}`}
                        onClick={() => handleSetActive(offeringId)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 transition-colors"
                      >
                        <span>Export Report</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>


          {/* New Course Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create New Course Offering</h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateCourse} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 25UCS624T"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Artificial Intelligence"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Semester
                      </label>
                      <select
                        value={newSemester}
                        onChange={(e) => setNewSemester(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        <option value="3rd Sem">3rd Sem</option>
                        <option value="4th Sem">4th Sem</option>
                        <option value="5th Sem">5th Sem</option>
                        <option value="6th Sem">6th Sem</option>
                        <option value="7th Sem">7th Sem</option>
                        <option value="8th Sem">8th Sem</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Year of Study
                      </label>
                      <select
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        <option value="2nd Yr">2nd Yr</option>
                        <option value="3rd Yr">3rd Yr</option>
                        <option value="4th Yr">4th Yr</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Attainment Scheme
                    </label>
                    <select
                      value={newScheme}
                      onChange={(e) => setNewScheme(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                    >
                      {INITIAL_SCHEMES.map((scheme) => (
                        <option key={scheme.id} value={scheme.id}>
                          {scheme.scheme_name} (Threshold: {scheme.threshold_percent}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-xs"
                    >
                      Save & Configure
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
