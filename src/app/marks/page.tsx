"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  FileSpreadsheet,
  Upload,
  Save,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Check,
  FileCheck,
  Users,
} from "lucide-react";
import { REFERENCE_MARKS, StudentMarksRecord } from "@/lib/data/referenceMarks";
import { INITIAL_OFFERING, INITIAL_COURSE } from "@/lib/data/initialData";

// Assessment columns configuration
const ASSESSMENT_COLS = [
  { key: "mt1_co1", label: "MT1 CO1", group: "Mid Term-I", max: 10 },
  { key: "mt1_co2", label: "MT1 CO2", group: "Mid Term-I", max: 10 },
  { key: "mt1_co3", label: "MT1 CO3", group: "Mid Term-I", max: 10 },
  { key: "mt2_co4", label: "MT2 CO4", group: "Mid Term-II", max: 10 },
  { key: "mt2_co5", label: "MT2 CO5", group: "Mid Term-II", max: 10 },
  { key: "mt2_co6", label: "MT2 CO6", group: "Mid Term-II", max: 10 },
  { key: "ta", label: "TA", group: "Teacher Assessment", max: 10 },
  { key: "ese_co1", label: "ESE CO1", group: "End Semester", max: 10 },
  { key: "ese_co2", label: "ESE CO2", group: "End Semester", max: 12 },
  { key: "ese_co3", label: "ESE CO3", group: "End Semester", max: 12 },
  { key: "ese_co4", label: "ESE CO4", group: "End Semester", max: 10 },
  { key: "ese_co5", label: "ESE CO5", group: "End Semester", max: 8 },
  { key: "ese_co6", label: "ESE CO6", group: "End Semester", max: 8 },
];

export default function MarksPage() {
  const [offeringId, setOfferingId] = useState<string>(INITIAL_OFFERING.id);
  const [courses, setCourses] = useState<any[]>([]);

  const [mode, setMode] = useState<"editor" | "import">("editor");

  // Grid State
  const [marksData, setMarksData] = useState<StudentMarksRecord[]>([]);

  // Load courses for offering selector
  useEffect(() => {
    fetch("/api/v1/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.courses && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
          const stored = typeof window !== "undefined" ? localStorage.getItem("outcomeX_active_offering_id") : null;
          const param = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("offeringId") : null;
          const activeId = param || stored;
          const exists = activeId && data.courses.some((c: any) => (c.offering?.id || c.id) === activeId);
          if (!exists) {
            const firstOffId = data.courses[0].offering?.id || data.courses[0].id;
            if (firstOffId) {
              setOfferingId(firstOffId);
              if (typeof window !== "undefined") {
                localStorage.setItem("outcomeX_active_offering_id", firstOffId);
              }
            }
          }
        }
      })
      .catch(() => {});
  }, []);

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

  const loadMarks = (targetOfferingId: string) => {
    if (!targetOfferingId) return;
    fetch(`/api/v1/offerings/${targetOfferingId}/marks`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.marks && Array.isArray(data.marks)) {
          setMarksData(data.marks);
        }
      })
      .catch(() => {});
  };

  // Load marks from canonical store / database via API
  useEffect(() => {
    loadMarks(offeringId);
  }, [offeringId]);

  const currentCourse = courses.find((c) => (c.offering?.id || c.id) === offeringId) || {
    course_code: INITIAL_COURSE.course_code,
    course_name: INITIAL_COURSE.course_name,
    offering: INITIAL_OFFERING,
  };

  const handleSelectOffering = (newOfferingId: string) => {
    setOfferingId(newOfferingId);
    if (typeof window !== "undefined") {
      localStorage.setItem("outcomeX_active_offering_id", newOfferingId);
      const url = new URL(window.location.href);
      url.searchParams.set("offeringId", newOfferingId);
      window.history.replaceState({}, "", url.toString());
    }
    loadMarks(newOfferingId);
  };


  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Import Wizard State
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileContent, setFileContent] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [validationReport, setValidationReport] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Cell editing
  const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
    const updated = [...marksData];
    const target = updated[rowIndex];

    if (!target.marks) target.marks = {};

    if (value.trim() === "") {
      target.marks[colKey] = null;
    } else {
      const num = Number(value);
      target.marks[colKey] = isNaN(num) ? (value.toUpperCase() as any) : num;
    }

    setMarksData(updated);
    setHasUnsavedChanges(true);
  };

  // Keyboard navigation & Paste handler
  const handlePaste = (e: React.ClipboardEvent, startRow: number, startColKey: string) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData("text");
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r\n|\n|\r/).filter((r) => r.length > 0);
    const updated = [...marksData];
    const startColIdx = ASSESSMENT_COLS.findIndex((c) => c.key === startColKey);

    rows.forEach((rowStr, rOffset) => {
      const targetRowIdx = startRow + rOffset;
      if (targetRowIdx >= updated.length) return;

      const cells = rowStr.split("\t");
      cells.forEach((valStr, cOffset) => {
        const targetColIdx = startColIdx + cOffset;
        if (targetColIdx >= ASSESSMENT_COLS.length) return;

        const col = ASSESSMENT_COLS[targetColIdx];
        const trimmed = valStr.trim();
        const num = Number(trimmed);

        if (!updated[targetRowIdx].marks) updated[targetRowIdx].marks = {};
        updated[targetRowIdx].marks[col.key] = trimmed === "" ? null : isNaN(num) ? trimmed : num;
      });
    });

    setMarksData(updated);
    setHasUnsavedChanges(true);
    setSaveStatus("Pasted data from clipboard (Unsaved)");
  };

  // Save marks to API
  const handleSaveMarks = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/marks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedMarks: marksData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save marks");

      setHasUnsavedChanges(false);
      try {
        localStorage.setItem("outcomeX_marks", JSON.stringify(marksData));
      } catch {}
      setSaveStatus(
        data.has_validation_warnings
          ? `Saved with ${data.validation_warnings.length} warning(s)`
          : "All marks saved successfully"
      );
    } catch (err: any) {
      setSaveStatus(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered marks
  const filteredMarks = marksData.filter(
    (record) =>
      record.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.student_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // File Upload Handler (Parses CSV or Excel preview)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
      const rows = lines.map((line) => line.split(/[\t,]/).map((c) => c.trim().replace(/^"|"$/g, "")));

      setFileContent(rows);

      // Auto-detect column mapping
      const headers = rows[0] || [];
      const mapping: Record<string, number> = {};

      headers.forEach((h, idx) => {
        const lower = h.toLowerCase();
        if (lower.includes("roll")) mapping["roll_no"] = idx;
        else if (lower.includes("name") || lower.includes("student")) mapping["student_name"] = idx;
        else if (lower.includes("mt1") && lower.includes("co1")) mapping["mt1_co1"] = idx;
        else if (lower.includes("mt1") && lower.includes("co2")) mapping["mt1_co2"] = idx;
        else if (lower.includes("mt1") && lower.includes("co3")) mapping["mt1_co3"] = idx;
        else if (lower.includes("mt2") && lower.includes("co4")) mapping["mt2_co4"] = idx;
        else if (lower.includes("mt2") && lower.includes("co5")) mapping["mt2_co5"] = idx;
        else if (lower.includes("mt2") && lower.includes("co6")) mapping["mt2_co6"] = idx;
        else if (lower.includes("ta") || lower.includes("teacher")) mapping["ta"] = idx;
        else if (lower.includes("ese") && lower.includes("co1")) mapping["ese_co1"] = idx;
        else if (lower.includes("ese") && lower.includes("co2")) mapping["ese_co2"] = idx;
        else if (lower.includes("ese") && lower.includes("co3")) mapping["ese_co3"] = idx;
        else if (lower.includes("ese") && lower.includes("co4")) mapping["ese_co4"] = idx;
        else if (lower.includes("ese") && lower.includes("co5")) mapping["ese_co5"] = idx;
        else if (lower.includes("ese") && lower.includes("co6")) mapping["ese_co6"] = idx;
      });

      // Default fallback if roll_no not found
      if (mapping["roll_no"] === undefined && headers.length > 0) mapping["roll_no"] = 0;
      if (mapping["student_name"] === undefined && headers.length > 1) mapping["student_name"] = 1;

      setColumnMapping(mapping);
      setImportStep(2);
    };

    reader.readAsText(file);
  };

  // Run validation
  const handleValidateImport = async () => {
    setIsValidating(true);
    try {
      const rowsToValidate = fileContent.slice(1);
      const res = await fetch(`/api/v1/offerings/${offeringId}/marks/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsToValidate,
          columnMapping,
        }),
      });
      const data = await res.json();
      setValidationReport(data);
      setImportStep(3);
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Confirm import
  const handleConfirmImport = () => {
    if (!validationReport || !validationReport.preview_data) return;

    const importedRecords: StudentMarksRecord[] = validationReport.preview_data.map(
      (p: any, idx: number) => ({
        student_id: `s-imp-${idx}`,
        roll_no: p.roll_no,
        student_name: p.student_name,
        marks: p.marks,
      })
    );

    setMarksData(importedRecords);
    try {
      localStorage.setItem("outcomeX_marks", JSON.stringify(importedRecords));
    } catch {}
    setMode("editor");
    setHasUnsavedChanges(true);
    setSaveStatus(`Imported ${importedRecords.length} records. Review and click Save.`);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/marks" />

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
                Student Marks Gradebook
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/80 px-2.5 py-0.5 rounded-lg">
                  {currentCourse.course_code}
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-200 font-bold">
                  {currentCourse.course_name}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-xs text-slate-500">
                  {marksData.length} Enrolled Students (Sec {currentCourse.offering?.section || "A"})
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Offering Selector Dropdown */}
              {courses.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs shadow-xs">
                  <span className="font-semibold text-slate-500">Course:</span>
                  <select
                    value={offeringId}
                    onChange={(e) => handleSelectOffering(e.target.value)}
                    className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    {courses.map((c) => {
                      const offId = c.offering?.id || c.id;
                      return (
                        <option key={offId} value={offId} className="dark:bg-slate-900">
                          {c.course_code} - {c.course_name} (Sec {c.offering?.section || "A"})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <Link
                href={`/roster?offeringId=${offeringId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span>Manage Roster ({marksData.length})</span>
              </Link>

              {/* Mode Switcher */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setMode("editor")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === "editor"
                      ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Spreadsheet Editor
                </button>


                <button
                  onClick={() => setMode("import")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === "import"
                      ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Import Wizard (.xlsx / .csv)
                </button>
              </div>
            </div>
          </div>

          {/* SPREADSHEET EDITOR MODE */}
          {mode === "editor" && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter student or roll..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <span className="text-xs text-slate-500">
                    Showing <strong>{filteredMarks.length}</strong> of {marksData.length} students
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Indicator */}
                  <span className="text-xs font-medium text-slate-500">
                    {saveStatus || (hasUnsavedChanges ? "⚠️ Unsaved changes" : "✓ Up to date")}
                  </span>

                  <button
                    onClick={handleSaveMarks}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? "Saving..." : "Save Gradebook"}
                  </button>
                </div>
              </div>

              {/* Data Table with Sticky Columns & Max Marks Row */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-xs">
                      {/* Component Groups */}
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase">
                        <th className="py-2 px-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 w-20 border-r border-slate-200 dark:border-slate-700">
                          Roll No
                        </th>
                        <th className="py-2 px-4 sticky left-20 z-30 bg-slate-100 dark:bg-slate-800 w-56 border-r border-slate-200 dark:border-slate-700">
                          Student Name
                        </th>
                        <th colSpan={3} className="py-2 px-2 text-center bg-sky-50 dark:bg-sky-950/40 border-r border-slate-200 dark:border-slate-700 text-sky-800 dark:text-sky-300">
                          Mid Term-I (Max: 30)
                        </th>
                        <th colSpan={3} className="py-2 px-2 text-center bg-indigo-50 dark:bg-indigo-950/40 border-r border-slate-200 dark:border-slate-700 text-indigo-800 dark:text-indigo-300">
                          Mid Term-II (Max: 30)
                        </th>
                        <th className="py-2 px-2 text-center bg-amber-50 dark:bg-amber-950/40 border-r border-slate-200 dark:border-slate-700 text-amber-800 dark:text-amber-300">
                          TA (10)
                        </th>
                        <th colSpan={6} className="py-2 px-2 text-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                          End Semester Exam (Max: 60)
                        </th>
                      </tr>

                      {/* Component Column Headers & Max Marks */}
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        <th className="py-2 px-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                          Max:
                        </th>
                        <th className="py-2 px-4 sticky left-20 z-30 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 text-slate-400 font-normal">
                          (Click cell or paste Excel data)
                        </th>
                        {ASSESSMENT_COLS.map((col) => (
                          <th key={col.key} className="py-2 px-2 text-center min-w-[70px] border-r border-slate-200 dark:border-slate-700/60 font-mono">
                            <div>{col.label}</div>
                            <div className="text-[10px] text-slate-400 font-normal">({col.max}m)</div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      {filteredMarks.map((record, rIdx) => (
                        <tr key={record.student_id || rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          {/* Sticky Roll No */}
                          <td className="py-1.5 px-3 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                            {record.roll_no}
                          </td>

                          {/* Sticky Name */}
                          <td className="py-1.5 px-4 sticky left-20 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-sans font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {record.student_name}
                          </td>

                          {/* Editable Assessment Cells */}
                          {ASSESSMENT_COLS.map((col) => {
                            const val = record.marks?.[col.key];
                            const isExceeding = typeof val === "number" && val > col.max;
                            const isMissing = val === null || val === undefined;

                            return (
                              <td key={col.key} className="p-0 border-r border-slate-200 dark:border-slate-800/60">
                                <input
                                  type="text"
                                  value={val === null || val === undefined ? "" : String(val)}
                                  onChange={(e) => handleCellChange(rIdx, col.key, e.target.value)}
                                  onPaste={(e) => handlePaste(e, rIdx, col.key)}
                                  className={`w-full py-1.5 px-2 text-center text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                                    isExceeding
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 font-bold"
                                      : isMissing
                                      ? "bg-amber-50/40 dark:bg-amber-950/20 text-slate-400 placeholder:text-slate-300"
                                      : "bg-transparent text-slate-900 dark:text-white"
                                  }`}
                                  placeholder="-"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {marksData.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center space-y-4 bg-white/60 dark:bg-slate-900/60 mt-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      No Students Enrolled in this Course Offering
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      The gradebook is driven by the student roster. Enroll students in Student Roster to start entering assessment marks.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/roster?offeringId=${offeringId}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 transition-colors"
                    >
                      <Users className="h-4 w-4" />
                      Open Student Roster to Enroll Students
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MARKS IMPORT WIZARD MODE */}
          {mode === "import" && (
            <div className="space-y-6">
              {/* Stepper Header */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
                {[
                  { step: 1, label: "1. Upload File" },
                  { step: 2, label: "2. Map Columns" },
                  { step: 3, label: "3. Validation Report" },
                  { step: 4, label: "4. Confirm & Commit" },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`rounded-xl py-2.5 px-3 border transition-all ${
                      importStep === s.step
                        ? "border-sky-600 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold"
                        : importStep > s.step
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-800 text-slate-400"
                    }`}
                  >
                    {s.label}
                  </div>
                ))}
              </div>

              {/* Step 1: Upload */}
              {importStep === 1 && (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Upload Marks Workbook or CSV
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports .xlsx, .xls, and .csv files. Macros will not be executed.
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="block mx-auto text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Step 2: Map Columns */}
              {importStep === 2 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Review Source Column Mappings</h3>
                      <p className="text-xs text-slate-500">
                        File: {fileName} ({fileContent.length - 1} data rows detected)
                      </p>
                    </div>

                    <button
                      onClick={handleValidateImport}
                      disabled={isValidating}
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-xs"
                    >
                      {isValidating ? "Validating..." : "Run Validation Check →"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Roll Number Column (Required)
                      </label>
                      <select
                        value={columnMapping["roll_no"] ?? ""}
                        onChange={(e) => setColumnMapping({ ...columnMapping, roll_no: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 font-medium"
                      >
                        {fileContent[0]?.map((header, idx) => (
                          <option key={idx} value={idx}>
                            Column {idx + 1}: {header || `(Col ${idx + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Student Name Column
                      </label>
                      <select
                        value={columnMapping["student_name"] ?? ""}
                        onChange={(e) => setColumnMapping({ ...columnMapping, student_name: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 font-medium"
                      >
                        <option value="">-- Optional / Skip --</option>
                        {fileContent[0]?.map((header, idx) => (
                          <option key={idx} value={idx}>
                            Column {idx + 1}: {header || `(Col ${idx + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {ASSESSMENT_COLS.map((col) => (
                      <div key={col.key}>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {col.label} ({col.max}m)
                        </label>
                        <select
                          value={columnMapping[col.key] ?? ""}
                          onChange={(e) => setColumnMapping({ ...columnMapping, [col.key]: Number(e.target.value) })}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 font-medium"
                        >
                          <option value="">-- Unmapped --</option>
                          {fileContent[0]?.map((header, idx) => (
                            <option key={idx} value={idx}>
                              Column {idx + 1}: {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Validation Report */}
              {importStep === 3 && validationReport && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Validation Summary</h3>
                      <p className="text-xs text-slate-500">
                        {validationReport.valid_rows_count} valid records, {validationReport.errors_count} errors, {validationReport.warnings_count} warnings.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setImportStep(2)}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-semibold"
                      >
                        ← Modify Mappings
                      </button>

                      <button
                        onClick={handleConfirmImport}
                        disabled={validationReport.has_critical_errors}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-xs disabled:opacity-40"
                      >
                        Confirm & Import to Gradebook
                      </button>
                    </div>
                  </div>

                  {/* Warning / Error Log */}
                  {validationReport.validation_messages?.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-2 max-h-60 overflow-y-auto text-xs">
                      {validationReport.validation_messages.map((msg: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-amber-900 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                          <span>
                            <strong>Row {msg.row} (Roll {msg.roll_no}):</strong> {msg.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto text-xs">
                    <table className="w-full text-left font-mono">
                      <thead className="bg-slate-50 dark:bg-slate-800 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Roll No</th>
                          <th className="p-2">Student Name</th>
                          {ASSESSMENT_COLS.slice(0, 7).map((c) => (
                            <th key={c.key} className="p-2 text-center">{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validationReport.preview_data?.map((r: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold">{r.roll_no}</td>
                            <td className="p-2 font-sans">{r.student_name}</td>
                            {ASSESSMENT_COLS.slice(0, 7).map((c) => (
                              <td key={c.key} className="p-2 text-center">
                                {r.marks?.[c.key] ?? "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
