import { NextRequest, NextResponse } from "next/server";
import { REFERENCE_STUDENTS } from "@/lib/data/referenceStudents";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { rows, columnMapping, maxMarks } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided for marks import." },
        { status: 400 }
      );
    }

    if (!columnMapping || typeof columnMapping !== "object") {
      return NextResponse.json(
        { error: "Column mapping configuration is required." },
        { status: 400 }
      );
    }

    const defaultMaxMarks: Record<string, number> = {
      mt1_co1: 10,
      mt1_co2: 10,
      mt1_co3: 10,
      mt2_co4: 10,
      mt2_co5: 10,
      mt2_co6: 10,
      ese_co1: 10,
      ese_co2: 12,
      ese_co3: 12,
      ese_co4: 10,
      ese_co5: 8,
      ese_co6: 8,
      ta: 10,
      ...(maxMarks || {}),
    };

    const enrolledRolls = new Set(REFERENCE_STUDENTS.map((s) => s.roll_no.trim()));
    const seenRolls = new Set<string>();

    const rowErrors: Array<{ row: number; roll_no: string; message: string; severity: "error" | "warning" }> = [];
    const validRecords: Array<{
      roll_no: string;
      student_name: string;
      marks: Record<string, number | null>;
      statuses: Record<string, string>;
    }> = [];

    const rollColIdx = columnMapping["roll_no"];
    const nameColIdx = columnMapping["student_name"];

    if (rollColIdx === undefined) {
      return NextResponse.json(
        { error: "Column mapping must specify the index for 'roll_no'." },
        { status: 400 }
      );
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const row = rows[i];
      const rawRoll = String(row[rollColIdx] ?? "").trim();
      const rawName = nameColIdx !== undefined ? String(row[nameColIdx] ?? "").trim() : "";

      if (!rawRoll) {
        rowErrors.push({
          row: rowNum,
          roll_no: "EMPTY",
          message: "Row has missing or empty roll number.",
          severity: "error",
        });
        continue;
      }

      // Check duplicates in file
      if (seenRolls.has(rawRoll)) {
        rowErrors.push({
          row: rowNum,
          roll_no: rawRoll,
          message: `Duplicate roll number ${rawRoll} found in file.`,
          severity: "error",
        });
        continue;
      }
      seenRolls.add(rawRoll);

      // Check if enrolled
      if (!enrolledRolls.has(rawRoll)) {
        rowErrors.push({
          row: rowNum,
          roll_no: rawRoll,
          message: `Student with Roll ${rawRoll} is not found in the course roster.`,
          severity: "warning",
        });
      }

      const parsedMarks: Record<string, number | null> = {};
      const parsedStatuses: Record<string, string> = {};

      for (const [compKey, colIdx] of Object.entries(columnMapping)) {
        if (compKey === "roll_no" || compKey === "student_name") continue;

        const cellValue = String(row[colIdx as number] ?? "").trim().toUpperCase();
        const maxAllowed = defaultMaxMarks[compKey] ?? 10;

        if (cellValue === "" || cellValue === "-" || cellValue === "NA") {
          parsedMarks[compKey] = null;
          parsedStatuses[compKey] = "NOT_ENTERED";
        } else if (cellValue === "A" || cellValue === "AB" || cellValue === "ABSENT") {
          parsedMarks[compKey] = null;
          parsedStatuses[compKey] = "ABSENT";
        } else if (cellValue === "E" || cellValue === "EX" || cellValue === "EXEMPT") {
          parsedMarks[compKey] = null;
          parsedStatuses[compKey] = "EXEMPT";
        } else {
          const num = Number(cellValue);
          if (isNaN(num)) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              message: `Invalid non-numeric mark "${cellValue}" for assessment "${compKey}".`,
              severity: "error",
            });
            parsedMarks[compKey] = null;
            parsedStatuses[compKey] = "ERROR";
          } else if (num < 0) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              message: `Negative mark ${num} for assessment "${compKey}" is not permitted.`,
              severity: "error",
            });
            parsedMarks[compKey] = null;
            parsedStatuses[compKey] = "ERROR";
          } else if (num > maxAllowed) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              message: `Mark ${num} exceeds maximum allowed of ${maxAllowed} for "${compKey}".`,
              severity: "error",
            });
            parsedMarks[compKey] = num;
            parsedStatuses[compKey] = "OUT_OF_BOUNDS";
          } else {
            parsedMarks[compKey] = num;
            parsedStatuses[compKey] = "PRESENT";
          }
        }
      }

      validRecords.push({
        roll_no: rawRoll,
        student_name: rawName,
        marks: parsedMarks,
        statuses: parsedStatuses,
      });
    }

    const hasCriticalErrors = rowErrors.some((e) => e.severity === "error");

    // Record audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit/auditLogger");
      logAuditEvent({
        offering_id: id,
        user_email: request.headers.get("x-user-email") || "faculty@pce.edu.in",
        action: "MARKS_IMPORTED",
        resource_type: "student_marks",
        resource_id: `imp-${Date.now()}`,
        payload: {
          total_rows: rows.length,
          valid_count: validRecords.length,
          errors_count: rowErrors.filter((e) => e.severity === "error").length,
          warnings_count: rowErrors.filter((e) => e.severity === "warning").length,
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: !hasCriticalErrors,
      offering_id: id,
      total_rows_evaluated: rows.length,
      valid_rows_count: validRecords.length,
      has_critical_errors: hasCriticalErrors,
      errors_count: rowErrors.filter((e) => e.severity === "error").length,
      warnings_count: rowErrors.filter((e) => e.severity === "warning").length,
      validation_messages: rowErrors,
      preview_data: validRecords.slice(0, 15),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process marks import validation" },
      { status: 500 }
    );
  }
}
