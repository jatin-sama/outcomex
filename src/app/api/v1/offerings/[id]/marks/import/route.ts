import { NextRequest, NextResponse } from "next/server";
import { offeringStore, isValidUuid, normalizeComponentKey } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";
import { getDbClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json(
      { error: `Invalid offering ID "${id}": must be a valid UUID.` },
      { status: 400 }
    );
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to import marks." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized to import marks for this offering." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { rows, columnMapping, maxMarks, commit = false } = body;

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

    const db = await getDbClient();

    // 1. Fetch configured assessment components for this offering
    const { data: dbComps } = await db
      .from("assessment_components")
      .select("id, component_name, max_marks")
      .eq("course_offering_id", id);

    const compMaxMarks: Record<string, number> = {
      mt1_co1: 10,
      mt1_co2: 10,
      mt1_co3: 10,
      mt2_co4: 10,
      mt2_co5: 10,
      mt2_co6: 10,
      ta: 10,
      ese_co1: 10,
      ese_co2: 12,
      ese_co3: 12,
      ese_co4: 10,
      ese_co5: 8,
      ese_co6: 8,
      ...(maxMarks || {}),
    };

    if (dbComps && dbComps.length > 0) {
      for (const comp of dbComps) {
        const normKey = normalizeComponentKey(comp.component_name);
        compMaxMarks[normKey] = Number(comp.max_marks);
        compMaxMarks[comp.id] = Number(comp.max_marks);
      }
    }

    // 2. Fetch enrolled students for this offering
    const roster = await offeringStore.getRoster(id);
    const enrolledRollMap = new Map<string, string>(); // roll_no (lowercase) -> student_name
    for (const st of roster) {
      enrolledRollMap.set(st.roll_no.trim().toLowerCase(), st.student_name);
    }

    const seenRolls = new Set<string>();
    const rowErrors: Array<{ row: number; roll_no: string; message: string; severity: "error" | "warning" }> = [];
    const validRecords: Array<{
      roll_no: string;
      student_name: string;
      marks: Record<string, number | string | null>;
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
      const enrolledName = enrolledRollMap.get(rawRoll.toLowerCase());
      const rawName = nameColIdx !== undefined && row[nameColIdx] !== undefined
        ? String(row[nameColIdx]).trim()
        : enrolledName || "";

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
      if (seenRolls.has(rawRoll.toLowerCase())) {
        rowErrors.push({
          row: rowNum,
          roll_no: rawRoll,
          message: `Duplicate roll number ${rawRoll} found in import file.`,
          severity: "error",
        });
        continue;
      }
      seenRolls.add(rawRoll.toLowerCase());

      // Check if enrolled
      if (!enrolledName) {
        rowErrors.push({
          row: rowNum,
          roll_no: rawRoll,
          message: `Student with Roll ${rawRoll} is not enrolled in the course offering roster.`,
          severity: "warning",
        });
      }

      const parsedMarks: Record<string, number | string | null> = {};
      const parsedStatuses: Record<string, string> = {};

      for (const [compKey, colIdxRaw] of Object.entries(columnMapping)) {
        if (compKey === "roll_no" || compKey === "student_name") continue;

        const colIdx = Number(colIdxRaw);
        if (isNaN(colIdx) || colIdx < 0 || colIdx >= row.length) continue;

        const cellVal = row[colIdx];
        const maxAllowed = compMaxMarks[compKey] ?? 10;

        if (cellVal === undefined || cellVal === null || String(cellVal).trim() === "") {
          parsedMarks[compKey] = null;
          parsedStatuses[compKey] = "NOT_ENTERED";
          continue;
        }

        const strVal = String(cellVal).trim().toUpperCase();

        if (strVal === "A" || strVal === "AB" || strVal === "ABSENT") {
          parsedMarks[compKey] = "A";
          parsedStatuses[compKey] = "ABSENT";
        } else if (strVal === "E" || strVal === "EX" || strVal === "EXEMPT") {
          parsedMarks[compKey] = "E";
          parsedStatuses[compKey] = "EXEMPT";
        } else {
          const num = parseFloat(strVal);
          if (isNaN(num)) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              message: `Invalid non-numeric mark "${cellVal}" for component "${compKey}".`,
              severity: "error",
            });
            parsedMarks[compKey] = null;
            parsedStatuses[compKey] = "ERROR";
          } else if (num < 0) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              message: `Negative mark ${num} for component "${compKey}" is not permitted.`,
              severity: "error",
            });
            parsedMarks[compKey] = null;
            parsedStatuses[compKey] = "ERROR";
          } else if (num > maxAllowed) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              message: `Mark ${num} exceeds maximum allowed of ${maxAllowed} for component "${compKey}".`,
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
        student_name: rawName || enrolledName || `Student ${rawRoll}`,
        marks: parsedMarks,
        statuses: parsedStatuses,
      });
    }

    const hasCriticalErrors = rowErrors.some((e) => e.severity === "error");

    // 3. If commit is requested and no critical errors exist, persist ALL valid records into database
    let savedCount = 0;
    if (commit && !hasCriticalErrors && validRecords.length > 0) {
      const recordsToSave = validRecords.map((r) => ({
        student_id: r.roll_no,
        roll_no: r.roll_no,
        student_name: r.student_name,
        marks: r.marks,
      }));

      const saveResult = await offeringStore.saveMarks(id, recordsToSave);
      savedCount = saveResult.savedCount;

      // Log audit entry
      try {
        await db.from("audit_logs").insert({
          profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
          action: "MARKS_IMPORTED",
          resource_type: "student_marks",
          resource_id: id,
          payload: {
            offering_id: id,
            user_email: authCtx.user.email,
            total_rows: rows.length,
            valid_count: validRecords.length,
            saved_count: savedCount,
            warnings_count: rowErrors.filter((e) => e.severity === "warning").length,
          },
        });
      } catch {}
    }

    return NextResponse.json({
      success: !hasCriticalErrors,
      offering_id: id,
      total_rows_evaluated: rows.length,
      valid_rows_count: validRecords.length,
      saved_count: savedCount,
      has_critical_errors: hasCriticalErrors,
      errors_count: rowErrors.filter((e) => e.severity === "error").length,
      warnings_count: rowErrors.filter((e) => e.severity === "warning").length,
      validation_messages: rowErrors,
      all_valid_records: validRecords, // Return complete dataset so UI can commit all rows
      preview_data: validRecords.slice(0, 15),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process marks import" },
      { status: 500 }
    );
  }
}
