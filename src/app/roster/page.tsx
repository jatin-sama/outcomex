"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Upload,
  UserCheck,
  UserX,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { REFERENCE_STUDENTS, ReferenceStudent } from "@/lib/data/referenceStudents";
import { INITIAL_OFFERING, INITIAL_COURSE } from "@/lib/data/initialData";

export default function StudentRosterPage() {
  const [offeringId, setOfferingId] = useState<string>(INITIAL_OFFERING.id);
  const [roster, setRoster] = useState<ReferenceStudent[]>(REFERENCE_STUDENTS);

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

  // Load roster from canonical store / database via API
  useEffect(() => {
    if (!offeringId) return;
    fetch(`/api/v1/offerings/${offeringId}/roster`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.roster && Array.isArray(data.roster)) {
          setRoster(data.roster);
        }
      })
      .catch(() => {});
  }, [offeringId]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Single student form
  const [newRoll, setNewRoll] = useState("");
  const [newName, setNewName] = useState("");

  // Bulk paste form
  const [bulkText, setBulkText] = useState("");

  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Filtered roster
  const filteredRoster = roster.filter((student) => {
    const matchesSearch =
      student.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || student.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const enrolledCount = roster.filter((s) => s.status === "ENROLLED").length;
  const droppedCount = roster.filter((s) => s.status === "DROPPED").length;
  const detainedCount = roster.filter((s) => s.status === "DETAINED").length;

  // Add single student via API
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoll.trim() || !newName.trim()) return;

    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roll_no: newRoll.trim(), student_name: newName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add student");
      }

      const updated = [...roster, ...data.added];
      setRoster(updated);
      localStorage.setItem("outcomeX_roster", JSON.stringify(updated));
      setIsAddModalOpen(false);
      setNewRoll("");
      setNewName("");
      setNotification({ type: "success", text: `Student ${newRoll} added successfully!` });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    }
  };

  // Bulk add students from paste text
  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    const lines = bulkText.split("\n").filter((l) => l.trim().length > 0);
    const studentsToImport: Array<{ roll_no: string; student_name: string }> = [];

    for (const line of lines) {
      const parts = line.split(/[\t,;]/).map((p) => p.trim());
      if (parts.length >= 2) {
        studentsToImport.push({
          roll_no: parts[0],
          student_name: parts.slice(1).join(" "),
        });
      }
    }

    if (studentsToImport.length === 0) {
      setNotification({ type: "error", text: "Could not parse valid records. Format: Roll<Tab>Name" });
      return;
    }

    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: studentsToImport }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to import roster");
      }

      const updated = [...roster, ...data.added];
      setRoster(updated);
      localStorage.setItem("outcomeX_roster", JSON.stringify(updated));
      setIsBulkModalOpen(false);
      setBulkText("");
      setNotification({
        type: "success",
        text: `Successfully imported ${data.added_count} student(s)! ${
          data.skipped_duplicates?.length ? `(${data.skipped_duplicates.length} duplicates skipped)` : ""
        }`,
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    }
  };

  // Change student status
  const handleStatusChange = async (studentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      const updated = roster.map((s) => (s.id === studentId ? { ...s, status: newStatus as any } : s));
      setRoster(updated);
      localStorage.setItem("outcomeX_roster", JSON.stringify(updated));
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    }
  };

  // Delete student
  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to remove this student from the course offering?")) return;

    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/roster?student_id=${studentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete student");

      const updated = roster.filter((s) => s.id !== studentId);
      setRoster(updated);
      localStorage.setItem("outcomeX_roster", JSON.stringify(updated));
      setNotification({ type: "success", text: "Student removed from roster." });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/roster" />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Courses Catalog
              </Link>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Student Roster Management
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {INITIAL_COURSE.course_code} • {INITIAL_COURSE.course_name} (Section {INITIAL_OFFERING.section})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={`/marks?offeringId=${offeringId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 px-3.5 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Go to Marks Entry
              </Link>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                Add Student
              </button>

              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Paste / Bulk Import
              </button>
            </div>
          </div>

          {/* Notification banner */}
          {notification && (
            <div
              className={`rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                notification.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              )}
              <span>{notification.text}</span>
            </div>
          )}

          {/* Metrics summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500">Total Enrolled</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{roster.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500">Active Students</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{enrolledCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500">Dropped Out</p>
              <p className="text-2xl font-bold text-slate-400 mt-1">{droppedCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500">Detained</p>
              <p className="text-2xl font-bold text-rose-500 mt-1">{detainedCount}</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by roll number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
              >
                <option value="ALL">All ({roster.length})</option>
                <option value="ENROLLED">Enrolled ({enrolledCount})</option>
                <option value="DROPPED">Dropped ({droppedCount})</option>
                <option value="DETAINED">Detained ({detainedCount})</option>
              </select>
            </div>
          </div>

          {/* Roster Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-xs font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4 w-16">#</th>
                    <th className="py-3 px-4 w-28">Roll No</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 w-36">Enrollment Status</th>
                    <th className="py-3 px-4 w-20 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredRoster.map((student, idx) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-mono">
                        {student.roll_no}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {student.student_name}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={student.status}
                          onChange={(e) => handleStatusChange(student.id, e.target.value)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border ${
                            student.status === "ENROLLED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                              : student.status === "DROPPED"
                              ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                          }`}
                        >
                          <option value="ENROLLED">Enrolled</option>
                          <option value="DROPPED">Dropped</option>
                          <option value="DETAINED">Detained</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredRoster.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                No students found matching your search.
              </div>
            )}
          </div>

          {/* Add Single Student Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Student to Offering</h3>
                  <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddSingle} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 102"
                      value={newRoll}
                      onChange={(e) => setNewRoll(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Full Student Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BHAIRAVI SANJAY BHENDARKAR"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-xs"
                    >
                      Add Student
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Bulk Paste / Import Modal */}
          {isBulkModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Paste Roster from Excel / CSV
                  </h3>
                  <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleBulkAdd} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Paste rows (Format: Roll Number &lt;Tab or Comma&gt; Student Name)
                    </label>
                    <textarea
                      rows={8}
                      required
                      placeholder={"102\tBHAIRAVI SANJAY BHENDARKAR\n103\tRUTUJA DINESH BUDHBAWARE\n104\tGUNJAN RAJU CHATARE"}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      className="w-full font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Copy directly from Excel columns A (Roll) and B (Name) and paste here. Duplicate roll numbers will be automatically detected and safely skipped.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsBulkModalOpen(false)}
                      className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-xs"
                    >
                      Process & Import Roster
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
