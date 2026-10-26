"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  FileSpreadsheet,
  Upload,
  Download,
  Save,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  Search,
  RefreshCw,
  Check,
  FileCheck,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  HelpCircle,
} from "lucide-react";
import { INITIAL_OFFERING, INITIAL_COURSE, INITIAL_ASSESSMENTS } from "@/lib/data/initialData";
import { normalizeComponentKey } from "@/lib/utils";

interface DynamicComponent {
  id: string;
  key: string;
  name: string;
  max: number;
  category: string;
  coCode: string;
}

interface ValidationReport {
  success: boolean;
  offering_id: string;
  is_outcomex_template: boolean;
  total_rows_evaluated: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  has_critical_errors: boolean;
  errors_count: number;
  warnings_count: number;
  new_marks_count: number;
  unchanged_marks_count: number;
  changed_marks_count: number;
  overwrites_detail: Array<{
    roll_no: string;
    student_name: string;
    component: string;
    old_value: any;
    new_value: any;
  }>;
  total_overwrites: number;
  validation_messages: Array<{
    row: number;
    roll_no: string;
    student_name?: string;
    component?: string;
    message: string;
    severity: "error" | "warning";
  }>;
  preview_data: any[];
  all_valid_records: any[];
  saved_count?: number;
}

export default function MarksPage() {
  const [offeringId, setOfferingId] = useState<string>(INITIAL_OFFERING.id);
  const [courses, setCourses] = useState<any[]>([]);
  const [mode, setMode] = useState<"editor" | "import">("editor");
  const [offeringDetails, setOfferingDetails] = useState<any>(null);
  const [isLoadingOffering, setIsLoadingOffering] = useState(false);

  // Grid State
  const [marksData, setMarksData] = useState<any[]>([]);
  const [components, setComponents] = useState<DynamicComponent[]>([]);
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);

  // Editor Toolbar State
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Import Wizard 4-Stage Flow State: 1 = Download, 2 = Upload, 3 = Review Validation, 4 = Confirm Import
  const [importStage, setImportStage] = useState<1 | 2 | 3 | 4>(1);
  const [fileContent, setFileContent] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [isOutcomeXTemplate, setIsOutcomeXTemplate] = useState(false);
  const [templateMetadata, setTemplateMetadata] = useState<any>(null);
  const [templateMismatchError, setTemplateMismatchError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [confirmOverwrites, setConfirmOverwrites] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

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
          const exists = activeId && data.courses.some((c: any) => c.offering?.id === activeId);
          if (!exists) {
            const firstOffId = data.courses.find((c: any) => c.offering?.id)?.offering?.id;
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

  // Load authoritative offering configuration (scheme, COs, components, roster)
  const loadOfferingDetails = async (targetOfferingId: string) => {
    if (!targetOfferingId) return;
    setIsLoadingOffering(true);
    try {
      const res = await fetch(`/api/v1/offerings/${targetOfferingId}`);
      if (res.ok) {
        const data = await res.json();
        setOfferingDetails(data);
      }
    } catch {}
    setIsLoadingOffering(false);
  };

  // Load marks and configured assessment components from API
  const loadMarks = async (targetOfferingId: string) => {
    if (!targetOfferingId) return;
    setIsLoadingMarks(true);
    try {
      const res = await fetch(`/api/v1/offerings/${targetOfferingId}/marks`);
      if (res.ok) {
        const data = await res.json();
        if (data?.marks && Array.isArray(data.marks)) {
          setMarksData(data.marks);
        }
        if (data?.components && Array.isArray(data.components) && data.components.length > 0) {
          const dynamicComps: DynamicComponent[] = data.components.map((c: any) => ({
            id: c.id,
            key: normalizeComponentKey(c.component_name),
            name: c.component_name,
            max: Number(c.max_marks || 10),
            category: c.category || "ASSESSMENT",
            coCode: c.course_outcomes?.co_code || (normalizeComponentKey(c.component_name).match(/co\d+/i)?.[0]?.toUpperCase() || "-"),
          }));
          setComponents(dynamicComps);
        } else {
          // Fallback
          setComponents(
            INITIAL_ASSESSMENTS.map((c) => ({
              id: c.id,
              key: normalizeComponentKey(c.component_name),
              name: c.component_name,
              max: Number(c.max_marks),
              category: c.category,
              coCode: normalizeComponentKey(c.component_name).match(/co\d+/i)?.[0]?.toUpperCase() || "-",
            }))
          );
        }
      }
    } catch {}
    setIsLoadingMarks(false);
  };

  useEffect(() => {
    loadOfferingDetails(offeringId);
    loadMarks(offeringId);
  }, [offeringId]);

  const currentCourse = courses.find((c) => c.offering?.id === offeringId) || {
    course_code: offeringDetails?.course?.course_code || INITIAL_COURSE.course_code,
    course_name: offeringDetails?.course?.course_name || INITIAL_COURSE.course_name,
    offering: offeringDetails ? { id: offeringId, section: offeringDetails.section, attainment_scheme_id: offeringDetails.scheme?.id } : INITIAL_OFFERING,
    schemeName: offeringDetails?.scheme?.scheme_name || "Autonomous 60/40 Scheme",
    cosCount: offeringDetails?.cos_count || 6,
  };

  // Read-only Accreditation Scheme derived directly from authoritative offering configuration
  const schemeName = offeringDetails?.scheme?.scheme_name || currentCourse.schemeName || "Autonomous 60/40 Scheme";
  const cosCount = offeringDetails?.cos_count || currentCourse.cosCount || (schemeName.includes("30") ? 4 : 6);
  const enrolledStudentsCount = offeringDetails?.students_count ?? marksData.length;
  const isConfigComplete = offeringDetails ? offeringDetails.is_configuration_complete : components.length > 0;
  const configurationErrors: string[] = offeringDetails?.configuration_errors || [];

  const handleSelectOffering = (newOfferingId: string) => {
    setOfferingId(newOfferingId);
    if (typeof window !== "undefined") {
      localStorage.setItem("outcomeX_active_offering_id", newOfferingId);
      const url = new URL(window.location.href);
      url.searchParams.set("offeringId", newOfferingId);
      window.history.replaceState({}, "", url.toString());
    }
    // Reset import wizard on offering switch
    setImportStage(1);
    setFileContent([]);
    setFileName("");
    setValidationReport(null);
    setTemplateMismatchError(null);
    setConfirmOverwrites(false);
    loadOfferingDetails(newOfferingId);
    loadMarks(newOfferingId);
  };

  // Cell editing in Spreadsheet Editor
  const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
    const updated = [...marksData];
    const target = updated[rowIndex];
    if (!target.marks) target.marks = {};

    const trimmed = value.trim();
    if (trimmed === "") {
      target.marks[colKey] = null;
    } else {
      const upper = trimmed.toUpperCase();
      if (upper === "A" || upper === "AB" || upper === "ABSENT") {
        target.marks[colKey] = "A";
      } else if (upper === "E" || upper === "EX" || upper === "EXEMPT") {
        target.marks[colKey] = "E";
      } else {
        const num = Number(trimmed);
        target.marks[colKey] = isNaN(num) ? upper : num;
      }
    }

    setMarksData(updated);
    setHasUnsavedChanges(true);
  };

  // Keyboard navigation & Paste handler for Spreadsheet Editor
  const handlePaste = (e: React.ClipboardEvent, startRow: number, startColKey: string) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData("text");
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r\n|\n|\r/).filter((r) => r.length > 0);
    const updated = [...marksData];
    const startColIdx = components.findIndex((c) => c.key === startColKey);
    if (startColIdx === -1) return;

    rows.forEach((rowStr, rOffset) => {
      const targetRowIdx = startRow + rOffset;
      if (targetRowIdx >= updated.length) return;

      const cells = rowStr.split("\t");
      cells.forEach((valStr, cOffset) => {
        const targetColIdx = startColIdx + cOffset;
        if (targetColIdx >= components.length) return;

        const col = components[targetColIdx];
        const trimmed = valStr.trim();
        if (!updated[targetRowIdx].marks) updated[targetRowIdx].marks = {};

        if (trimmed === "") {
          updated[targetRowIdx].marks[col.key] = null;
        } else {
          const upper = trimmed.toUpperCase();
          if (upper === "A" || upper === "AB" || upper === "ABSENT") {
            updated[targetRowIdx].marks[col.key] = "A";
          } else if (upper === "E" || upper === "EX" || upper === "EXEMPT") {
            updated[targetRowIdx].marks[col.key] = "E";
          } else {
            const num = Number(trimmed);
            updated[targetRowIdx].marks[col.key] = isNaN(num) ? upper : num;
          }
        }
      });
    });

    setMarksData(updated);
    setHasUnsavedChanges(true);
    setSaveStatus("Pasted data from clipboard (Unsaved)");
  };

  // Save marks to API from spreadsheet editor
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
      setSaveStatus(
        data.has_validation_warnings
          ? `Saved with ${data.validation_warnings.length} warning(s)`
          : "All marks saved successfully"
      );
      await loadMarks(offeringId);
    } catch (err: any) {
      setSaveStatus(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Download Generated Template Action (.xlsx or .csv)
  const handleDownloadTemplate = async (format: "xlsx" | "csv" = "xlsx") => {
    setIsDownloadingTemplate(true);
    try {
      const url = `/api/v1/offerings/${offeringId}/marks/template?format=${format}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to download template");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Extract filename from Content-Disposition if present
      const disposition = res.headers.get("Content-Disposition");
      let downloadFilename = `OutcomeX_Template_${currentCourse.course_code}_Sec${currentCourse.offering?.section || "A"}.${format}`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) downloadFilename = match[1];
      }

      link.setAttribute("download", downloadFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Error downloading template: ${err.message}`);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // File Upload Handler with Auto-Detection of OutcomeX Template
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setTemplateMismatchError(null);
    setValidationReport(null);

    try {
      let rows: string[][] = [];
      let detectedOfferingId: string | null = null;
      let isRecognizedTemplate = false;
      let detectedMeta: any = null;

      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        // Check for Template_Metadata sheet (Hidden sheet in OutcomeX templates)
        const metaSheet = workbook.getWorksheet("Template_Metadata");
        if (metaSheet) {
          detectedMeta = {};
          metaSheet.eachRow({ includeEmpty: false }, (row) => {
            const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
            if (vals[0] && vals[1]) {
              detectedMeta[String(vals[0]).trim()] = String(vals[1]).trim();
            }
          });

          if (detectedMeta["schema_version"] === "outcomeX-marks-template-v1.0") {
            isRecognizedTemplate = true;
            detectedOfferingId = detectedMeta["offering_id"];
          }
        }

        // Target primary marks entry worksheet
        const worksheet = workbook.getWorksheet("Marks_Entry") || workbook.worksheets[0];
        if (!worksheet) throw new Error("No worksheets found in uploaded Excel file.");

        // Read all rows
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const rowVals: string[] = [];
          const values = Array.isArray(row.values) ? row.values.slice(1) : [];
          for (const val of values) {
            if (val === null || val === undefined) {
              rowVals.push("");
            } else if (typeof val === "object" && val !== null && "result" in (val as any)) {
              rowVals.push(String((val as any).result ?? "").trim());
            } else {
              rowVals.push(String(val).trim());
            }
          }
          if (rowVals.some((c) => c !== "")) {
            rows.push(rowVals);
          }
        });

        // Fallback detection from Header row 3 if metadata sheet was not preserved
        if (!isRecognizedTemplate && rows.length >= 3) {
          const row3Text = rows.slice(0, 4).map((r) => r.join(" ")).join(" ");
          if (row3Text.includes("outcomeX-marks-template-v1.0")) {
            isRecognizedTemplate = true;
            const match = row3Text.match(/Offering ID:\s*([0-9a-fA-F-]+)/);
            if (match && match[1]) detectedOfferingId = match[1];
          }
        }
      } else {
        // Parse CSV
        const text = await file.text();
        const rawLines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);

        // Check for OutcomeX header comment in CSV
        for (const line of rawLines) {
          if (line.startsWith("#") && line.includes("outcomeX-marks-template-v1.0")) {
            isRecognizedTemplate = true;
            const match = line.match(/Offering ID:\s*([0-9a-fA-F-]+)/);
            if (match && match[1]) detectedOfferingId = match[1];
          }
        }

        const dataLines = rawLines.filter((l) => !l.startsWith("#"));
        rows = dataLines.map((line) =>
          line.split(/[\t,]/).map((c) => c.trim().replace(/^"|"$/g, ""))
        );
      }

      if (rows.length < 2) {
        throw new Error("The uploaded file does not contain enough data rows.");
      }

      // Check Cross-Offering Isolation
      if (detectedOfferingId && detectedOfferingId !== offeringId) {
        setTemplateMismatchError(
          `This template was generated for Course Offering ID "${detectedOfferingId}", but you currently have Offering ID "${offeringId}" selected (${currentCourse.course_code}). Importing across different course offerings is blocked to protect academic records.`
        );
        return;
      }

      setFileContent(rows);
      setIsOutcomeXTemplate(isRecognizedTemplate);
      setTemplateMetadata(detectedMeta || (detectedOfferingId ? { offering_id: detectedOfferingId } : null));

      // Automated Column Mapping
      let dataRows: string[][] = [];
      const mapping: Record<string, number> = {};

      if (isRecognizedTemplate) {
        // Find row containing "Roll No" in the first 8 rows
        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const rStr = rows[r].join(" ").toLowerCase();
          if (rStr.includes("roll")) {
            headerRowIdx = r;
            break;
          }
        }

        const headers = rows[headerRowIdx] || [];
        dataRows = rows.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== ""));

        // If template has max marks in row immediately following headers, filter it
        if (dataRows[0] && dataRows[0].some((c) => String(c).toLowerCase().includes("max"))) {
          dataRows = dataRows.slice(1);
        }

        // Map standard columns
        headers.forEach((h, idx) => {
          const lower = h.toLowerCase().trim();
          if (lower.includes("roll")) mapping["roll_no"] = idx;
          else if (lower.includes("name") || lower.includes("student")) mapping["student_name"] = idx;
          else {
            const matchedComp = components.find(
              (c) =>
                c.name.toLowerCase() === lower ||
                lower.includes(c.key) ||
                lower.includes(c.name.toLowerCase()) ||
                (c.coCode !== "-" && lower.includes(c.coCode.toLowerCase()) && lower.includes(c.category.slice(0, 3).toLowerCase()))
            );
            if (matchedComp) {
              mapping[matchedComp.key] = idx;
            }
          }
        });

        // Set mapping and immediately auto-run validation (Skips manual mapping!)
        setColumnMapping(mapping);
        runValidation(dataRows, mapping, true, detectedMeta);
      } else {
        // External file: Auto-detect mapping and proceed to Review Step
        const headers = rows[0] || [];
        dataRows = rows.slice(1);

        headers.forEach((h, idx) => {
          const lower = h.toLowerCase().trim();
          if (lower.includes("roll")) mapping["roll_no"] = idx;
          else if (lower.includes("name") || lower.includes("student")) mapping["student_name"] = idx;
          else {
            const matchedComp = components.find(
              (c) =>
                lower.includes(c.key) ||
                lower.includes(c.name.toLowerCase()) ||
                (c.coCode !== "-" && lower.includes(c.coCode.toLowerCase()))
            );
            if (matchedComp) {
              mapping[matchedComp.key] = idx;
            }
          }
        });

        if (mapping["roll_no"] === undefined && headers.length > 0) mapping["roll_no"] = 0;
        if (mapping["student_name"] === undefined && headers.length > 1) mapping["student_name"] = 1;

        setColumnMapping(mapping);
        runValidation(dataRows, mapping, false, null);
      }
    } catch (err: any) {
      alert(`Error reading file: ${err.message}`);
    }
  };

  // Run Server Validation
  const runValidation = async (
    rowsToValidate: string[][],
    mappingToUse: Record<string, number>,
    isTemplate: boolean,
    meta: any
  ) => {
    setIsValidating(true);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/marks/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsToValidate,
          columnMapping: mappingToUse,
          isOutcomeXTemplate: isTemplate,
          templateMetadata: meta,
          commit: false,
        }),
      });

      const report: ValidationReport = await res.json();
      setValidationReport(report);
      setPreviewPage(1);
      setImportStage(3); // Advance directly to Stage 3: Review Validation
    } catch (err: any) {
      alert(`Validation request failed: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Confirm and Commit Import to Database
  const handleConfirmCommit = async () => {
    if (!validationReport || validationReport.has_critical_errors) return;

    if (validationReport.changed_marks_count > 0 && !confirmOverwrites) {
      alert("Please check the confirmation box to confirm overwriting existing marks.");
      return;
    }

    setIsCommitting(true);
    try {
      // Find data rows
      let dataRows = fileContent.slice(1);
      if (isOutcomeXTemplate) {
        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(fileContent.length, 10); r++) {
          if (fileContent[r].join(" ").toLowerCase().includes("roll")) {
            headerRowIdx = r;
            break;
          }
        }
        dataRows = fileContent.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== ""));
        if (dataRows[0] && dataRows[0].some((c) => String(c).toLowerCase().includes("max"))) {
          dataRows = dataRows.slice(1);
        }
      }

      const res = await fetch(`/api/v1/offerings/${offeringId}/marks/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: dataRows,
          columnMapping,
          isOutcomeXTemplate,
          templateMetadata,
          commit: true,
          confirmOverwrite: confirmOverwrites,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit imported marks.");
      }

      // Transition to Stage 4: Success
      setValidationReport((prev) => (prev ? { ...prev, saved_count: data.saved_count } : data));
      setImportStage(4);

      // Reload fresh persisted marks from canonical database
      await loadMarks(offeringId);
      setHasUnsavedChanges(false);
      setSaveStatus(`Persisted marks for ${data.valid_rows_count} students to database.`);
    } catch (err: any) {
      alert(`Import commit failed: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Download Validation Error Report as CSV
  const handleDownloadErrorReport = () => {
    if (!validationReport?.validation_messages || validationReport.validation_messages.length === 0) return;

    const headers = ["Row", "Roll No", "Student Name", "Component", "Severity", "Message"];
    const lines = [headers.join(",")];

    validationReport.validation_messages.forEach((msg) => {
      lines.push(
        [
          msg.row,
          `"${(msg.roll_no || "").replace(/"/g, '""')}"`,
          `"${(msg.student_name || "").replace(/"/g, '""')}"`,
          `"${(msg.component || "").replace(/"/g, '""')}"`,
          msg.severity.toUpperCase(),
          `"${msg.message.replace(/"/g, '""')}"`,
        ].join(",")
      );
    });

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `OutcomeX_Marks_Errors_${currentCourse.course_code}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered marks for editor
  const filteredMarks = useMemo(() => {
    return marksData.filter(
      (record) =>
        record.roll_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.student_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [marksData, searchQuery]);

  // Group dynamic components by category for table headers
  const componentGroups = useMemo(() => {
    const groups: Array<{ category: string; count: number; comps: DynamicComponent[] }> = [];
    components.forEach((c) => {
      let g = groups.find((grp) => grp.category === c.category);
      if (!g) {
        g = { category: c.category, count: 0, comps: [] };
        groups.push(g);
      }
      g.count++;
      g.comps.push(c);
    });
    return groups;
  }, [components]);

  // Pagination for Preview Table (15 rows per page)
  const PREVIEW_PAGE_SIZE = 15;
  const paginatedPreviewRows = useMemo(() => {
    if (!validationReport?.all_valid_records) return [];
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return validationReport.all_valid_records.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [validationReport, previewPage]);

  const totalPreviewPages = useMemo(() => {
    if (!validationReport?.all_valid_records) return 1;
    return Math.ceil(validationReport.all_valid_records.length / PREVIEW_PAGE_SIZE) || 1;
  }, [validationReport]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/marks" />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
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
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                  {schemeName}
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
                    {courses.filter((c) => c.offering?.id).map((c) => {
                      const offId = c.offering.id;
                      return (
                        <option key={offId} value={offId} className="dark:bg-slate-900">
                          {c.course_code} - {c.course_name} (Sec {c.offering?.section || "A"})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setMode("editor")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === "editor"
                      ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Spreadsheet Editor
                </button>

                <button
                  onClick={() => {
                    setMode("import");
                    if (importStage === 4) setImportStage(1);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === "import"
                      ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Import Workflow
                </button>
              </div>
            </div>
          </div>

          {/* SPREADSHEET EDITOR MODE */}
          {mode === "editor" && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter student or roll number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <span className="text-xs text-slate-500">
                    Showing <strong>{filteredMarks.length}</strong> of {marksData.length} students
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Download Template Shortcut */}
                  <button
                    onClick={() => handleDownloadTemplate("xlsx")}
                    disabled={isDownloadingTemplate || !isConfigComplete}
                    title="Download dynamic Excel template for this course offering"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Download Excel Template</span>
                  </button>

                  <button
                    onClick={() => setMode("import")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/60 px-3.5 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors shadow-xs"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Import File</span>
                  </button>

                  <span className="text-xs font-medium text-slate-500 pl-1">
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

              {/* Dynamic Assessment Data Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-xs">
                      {/* Dynamic Component Category Groups */}
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase">
                        <th className="py-2 px-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 w-24 border-r border-slate-200 dark:border-slate-700">
                          Roll No
                        </th>
                        <th className="py-2 px-4 sticky left-24 z-30 bg-slate-100 dark:bg-slate-800 w-56 border-r border-slate-200 dark:border-slate-700">
                          Student Name
                        </th>
                        {componentGroups.map((grp, gIdx) => (
                          <th
                            key={gIdx}
                            colSpan={grp.count}
                            className={`py-2 px-2 text-center border-r border-slate-200 dark:border-slate-700 ${
                              grp.category.includes("MID_TERM_1")
                                ? "bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300"
                                : grp.category.includes("MID_TERM_2")
                                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300"
                                : grp.category.includes("TEACHER")
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                            }`}
                          >
                            {grp.category.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>

                      {/* Component Column Headers & Max Marks */}
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        <th className="py-2 px-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                          Max:
                        </th>
                        <th className="py-2 px-4 sticky left-24 z-30 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 text-slate-400 font-normal">
                          (Click cell or paste Excel data)
                        </th>
                        {components.map((col) => (
                          <th key={col.id || col.key} className="py-2 px-2 text-center min-w-[75px] border-r border-slate-200 dark:border-slate-700/60 font-mono">
                            <div className="truncate" title={col.name}>{col.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              ({col.max}m • {col.coCode})
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      {filteredMarks.map((record, rIdx) => (
                        <tr key={record.student_id || record.enrollment_id || rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          {/* Sticky Roll No */}
                          <td className="py-1.5 px-3 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                            {record.roll_no}
                          </td>

                          {/* Sticky Name */}
                          <td className="py-1.5 px-4 sticky left-24 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 font-sans font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {record.student_name}
                          </td>

                          {/* Editable Assessment Cells */}
                          {components.map((col) => {
                            const val = record.marks?.[col.key] ?? record.marks?.[col.id];
                            const isExceeding = typeof val === "number" && val > col.max;
                            const isMissing = val === null || val === undefined;

                            return (
                              <td key={col.id || col.key} className="p-0 border-r border-slate-200 dark:border-slate-800/60">
                                <input
                                  type="text"
                                  value={val === null || val === undefined ? "" : String(val)}
                                  onChange={(e) => handleCellChange(rIdx, col.key, e.target.value)}
                                  onPaste={(e) => handlePaste(e, rIdx, col.key)}
                                  className={`w-full py-1.5 px-2 text-center text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                                    isExceeding
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 font-bold"
                                      : isMissing
                                      ? "bg-amber-50/30 dark:bg-amber-950/10 text-slate-400 placeholder:text-slate-300"
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

              {marksData.length === 0 && !isLoadingMarks && (
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

          {/* MARKS IMPORT WORKFLOW (4-STAGE COMPACT FLOW) */}
          {mode === "import" && (
            <div className="space-y-6">
              {/* Stepper Header */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs font-semibold">
                {[
                  { stage: 1, label: "1. Download Template" },
                  { stage: 2, label: "2. Upload File" },
                  { stage: 3, label: "3. Review Validation" },
                  { stage: 4, label: "4. Confirm Import" },
                ].map((s) => (
                  <button
                    key={s.stage}
                    onClick={() => {
                      if (s.stage < importStage || (s.stage === 2 && fileContent.length > 0)) {
                        setImportStage(s.stage as any);
                      }
                    }}
                    className={`rounded-xl py-3 px-3 border transition-all text-center ${
                      importStage === s.stage
                        ? "border-sky-600 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold shadow-xs"
                        : importStage > s.stage
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                        : "border-slate-200 dark:border-slate-800 text-slate-400 bg-white/40 dark:bg-slate-900/40 cursor-default"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Template Mismatch Warning Banner */}
              {templateMismatchError && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-xs">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Course Offering Isolation Warning</p>
                    <p>{templateMismatchError}</p>
                    <button
                      onClick={() => {
                        setTemplateMismatchError(null);
                        setFileContent([]);
                        setFileName("");
                      }}
                      className="mt-2 text-xs font-bold underline hover:no-underline text-rose-700 dark:text-rose-300"
                    >
                      Clear File and Choose Another
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 1: DOWNLOAD TEMPLATE */}
              {importStage === 1 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xs space-y-6">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 mb-3">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Zero-Mapping Preserved Accuracy
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Download Dynamic Marks Template
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      OutcomeX generates a customized spreadsheet using the database configuration for{" "}
                      <strong>{currentCourse.course_code}</strong>. The template includes all{" "}
                      <strong>{marksData.length} enrolled students</strong>, correct assessment components, maximum
                      marks, and CO mappings. Student roll numbers and definitions are protected from accidental
                      alteration.
                    </p>
                  </div>

                  {/* Offering Context Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl text-xs border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-slate-400 block font-medium">Course Code & Name</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{currentCourse.course_code}</span>
                      <span className="block text-slate-500 text-[11px] truncate">{currentCourse.course_name}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Accreditation Scheme (Read-Only)</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">{schemeName}</span>
                      <span className="block text-slate-500 text-[11px]">
                        {cosCount} Configured COs • Max cohort: {schemeName.includes("30") ? 65 : 81}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Enrolled Cohort</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{enrolledStudentsCount} Students</span>
                      <span className="block text-slate-500 text-[11px]">Section {currentCourse.offering?.section || "A"}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Assessment Components</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{components.length} Components</span>
                      <span className="block text-slate-500 text-[11px]">Bound to Configured Max & COs</span>
                    </div>
                  </div>

                  {/* Actionable Error when Assessment Configuration is Incomplete */}
                  {!isConfigComplete && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1.5 flex-1">
                        <p className="font-bold">Assessment Configuration Incomplete for this Offering</p>
                        <p>
                          {configurationErrors.length > 0
                            ? configurationErrors.join(" ")
                            : "Assessment components, maximum marks, and course outcome mappings must be configured before downloading the marks template."}
                        </p>
                        <div className="pt-1">
                          <Link
                            href={`/courses/${currentCourse.id || currentCourse.course_code}/setup`}
                            className="inline-flex items-center gap-1.5 font-bold text-sky-700 dark:text-sky-300 underline hover:no-underline"
                          >
                            Open Course Setup to Configure Assessments →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => handleDownloadTemplate("xlsx")}
                      disabled={isDownloadingTemplate || !isConfigComplete}
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-5 py-3 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="h-4 w-4" />
                      {isDownloadingTemplate ? "Generating Excel Template..." : "Download Excel Template"}
                    </button>

                    <button
                      onClick={() => handleDownloadTemplate("csv")}
                      disabled={isDownloadingTemplate || !isConfigComplete}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      Download CSV Template
                    </button>

                    <button
                      onClick={() => setImportStage(2)}
                      className="inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 ml-auto"
                    >
                      Already filled the template? Skip to Upload →
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 2: UPLOAD FILE */}
              {importStage === 2 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600">
                      <Upload className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Upload Completed Marks File
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Upload your filled OutcomeX template or supported external spreadsheet (.xlsx, .xls, .csv).
                        OutcomeX templates will be recognized automatically with zero manual mapping.
                      </p>
                    </div>

                    <div className="pt-2">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="block mx-auto text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Automatic schema recognition • Preserved student integrity • Max marks bounds checking</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={() => setImportStage(1)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      ← Back to Download Template
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 3: REVIEW VALIDATION */}
              {importStage === 3 && validationReport && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
                  {/* Top Bar with Template Recognition Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Import Validation Review
                        </h3>
                        {validationReport.is_outcomex_template ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            OutcomeX Template Recognized (Zero-Mapping)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            External Spreadsheet
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        File: <strong>{fileName}</strong> • Offering: <strong>{currentCourse.course_code}</strong> ({schemeName})
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setImportStage(2);
                          setFileContent([]);
                          setFileName("");
                          setValidationReport(null);
                        }}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                      >
                        ← Upload Different File
                      </button>

                      <button
                        onClick={handleConfirmCommit}
                        disabled={
                          isCommitting ||
                          validationReport.has_critical_errors ||
                          (validationReport.changed_marks_count > 0 && !confirmOverwrites)
                        }
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-40 transition-colors"
                      >
                        {isCommitting ? "Committing to Database..." : "Confirm & Import to Gradebook"}
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block font-medium">Evaluated Rows</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {validationReport.total_rows_evaluated}
                      </span>
                    </div>

                    <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-emerald-700 dark:text-emerald-300 block font-medium">Valid Students</span>
                      <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                        {validationReport.valid_rows_count}
                      </span>
                    </div>

                    <div className={`rounded-xl p-3 border ${
                      validationReport.has_critical_errors
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                    }`}>
                      <span className={`block font-medium ${validationReport.has_critical_errors ? "text-rose-700 dark:text-rose-300" : "text-slate-400"}`}>
                        Errors Found
                      </span>
                      <span className={`text-lg font-bold ${validationReport.has_critical_errors ? "text-rose-800 dark:text-rose-200" : "text-slate-700 dark:text-slate-300"}`}>
                        {validationReport.errors_count}
                      </span>
                    </div>

                    <div className="rounded-xl p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                      <span className="text-sky-700 dark:text-sky-300 block font-medium">New Marks</span>
                      <span className="text-lg font-bold text-sky-800 dark:text-sky-200">
                        {validationReport.new_marks_count}
                      </span>
                    </div>

                    <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block font-medium">Unchanged</span>
                      <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                        {validationReport.unchanged_marks_count}
                      </span>
                    </div>

                    <div className={`rounded-xl p-3 border ${
                      validationReport.changed_marks_count > 0
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                    }`}>
                      <span className={`block font-medium ${validationReport.changed_marks_count > 0 ? "text-amber-800 dark:text-amber-300 font-bold" : "text-slate-400"}`}>
                        Overwrites
                      </span>
                      <span className={`text-lg font-bold ${validationReport.changed_marks_count > 0 ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>
                        {validationReport.changed_marks_count}
                      </span>
                    </div>
                  </div>

                  {/* Overwrite Confirmation Box (Mandatory Safety Check) */}
                  {validationReport.changed_marks_count > 0 && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-5 space-y-3 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                            Explicit Overwrite Confirmation Required
                          </h4>
                          <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                            This import will overwrite <strong>{validationReport.changed_marks_count} existing mark(s)</strong> already
                            persisted in the database. Review the modifications below before continuing.
                          </p>
                        </div>
                      </div>

                      {/* Overwrite Detail Table */}
                      <div className="max-h-44 overflow-y-auto rounded-xl border border-amber-200 dark:border-amber-800/60 bg-white dark:bg-slate-900 text-xs font-mono">
                        <table className="w-full text-left">
                          <thead className="bg-amber-100/60 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 sticky top-0">
                            <tr>
                              <th className="p-2">Roll No</th>
                              <th className="p-2">Student Name</th>
                              <th className="p-2">Component</th>
                              <th className="p-2 text-center text-rose-600">Current Saved Mark</th>
                              <th className="p-2 text-center text-emerald-600">Proposed New Mark</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                            {validationReport.overwrites_detail.map((ow, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-2 font-mono font-bold">{ow.roll_no}</td>
                                <td className="p-2">{ow.student_name}</td>
                                <td className="p-2 font-mono">{ow.component}</td>
                                <td className="p-2 text-center font-mono font-bold text-rose-700 bg-rose-50/40">
                                  {ow.old_value ?? "NOT_ENTERED"}
                                </td>
                                <td className="p-2 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                                  {ow.new_value ?? "NOT_ENTERED"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <label className="flex items-center gap-2 pt-1 text-xs font-bold text-amber-950 dark:text-amber-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmOverwrites}
                          onChange={(e) => setConfirmOverwrites(e.target.checked)}
                          className="h-4 w-4 rounded border-amber-400 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <span>
                          I have reviewed the proposed changes and confirm that I want to overwrite these {validationReport.changed_marks_count} existing mark(s).
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Validation Error / Warning Log & Error Report Download */}
                  {validationReport.validation_messages.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Validation Messages ({validationReport.validation_messages.length})
                        </span>
                        <button
                          onClick={handleDownloadErrorReport}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Error Report (.csv)
                        </button>
                      </div>

                      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 p-4 space-y-2 max-h-56 overflow-y-auto text-xs">
                        {validationReport.validation_messages.map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-rose-900 dark:text-rose-200">
                            {msg.severity === "error" ? (
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                            )}
                            <div>
                              <span className="font-bold">
                                Row {msg.row} (Roll: {msg.roll_no}
                                {msg.student_name ? ` - ${msg.student_name}` : ""}):
                              </span>{" "}
                              <span>{msg.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validated Dataset Preview (With Pagination — commits ALL validated rows) */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Cohort Marks Preview ({validationReport.valid_rows_count} Students Validated)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Displaying page {previewPage} of {totalPreviewPages} • <strong>All {validationReport.valid_rows_count} validated student records</strong> will be saved upon confirmation.
                        </p>
                      </div>

                      {/* Pagination Controls */}
                      {totalPreviewPages > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                            disabled={previewPage === 1}
                            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-xs font-mono">
                            {previewPage} / {totalPreviewPages}
                          </span>
                          <button
                            onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                            disabled={previewPage === totalPreviewPages}
                            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto text-xs">
                      <table className="w-full text-left font-mono">
                        <thead className="bg-slate-50 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-700">Roll No</th>
                            <th className="p-2 border-r border-slate-200 dark:border-slate-700">Student Name</th>
                            {components.map((c) => (
                              <th key={c.key} className="p-2 text-center border-r border-slate-200 dark:border-slate-700 min-w-[70px]">
                                {c.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {paginatedPreviewRows.map((r, idx) => (
                            <tr key={r.roll_no || idx} className="hover:bg-slate-50/50">
                              <td className="p-2 font-bold border-r border-slate-200 dark:border-slate-800">{r.roll_no}</td>
                              <td className="p-2 font-sans border-r border-slate-200 dark:border-slate-800 truncate max-w-xs">{r.student_name}</td>
                              {components.map((c) => {
                                const val = r.marks?.[c.key];
                                return (
                                  <td key={c.key} className="p-2 text-center border-r border-slate-200 dark:border-slate-800">
                                    {val === null || val === undefined ? (
                                      <span className="text-slate-300">-</span>
                                    ) : (
                                      val
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 4: CONFIRMATION SUCCESS */}
              {importStage === 4 && (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-10 text-center space-y-5 shadow-xs">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Import Completed Successfully!
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      All valid marks for <strong>{currentCourse.course_code}</strong> have been persisted transactionally into the canonical Supabase database.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl text-xs border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-slate-400 block font-medium">Records Persisted</span>
                      <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                        {validationReport?.saved_count || validationReport?.valid_rows_count} Records
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">New Marks</span>
                      <span className="text-base font-bold text-sky-700 dark:text-sky-400">
                        {validationReport?.new_marks_count || 0} Added
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Updated Marks</span>
                      <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                        {validationReport?.changed_marks_count || 0} Overwritten
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                    <button
                      onClick={() => setMode("editor")}
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors"
                    >
                      View Live Gradebook Editor →
                    </button>

                    <button
                      onClick={() => {
                        setImportStage(1);
                        setFileContent([]);
                        setFileName("");
                        setValidationReport(null);
                      }}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    >
                      Import Another File
                    </button>
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
