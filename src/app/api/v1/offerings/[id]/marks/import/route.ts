import { NextRequest, NextResponse } from "next/server";
import { offeringStore, isValidUuid, normalizeComponentKey } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";
import { getDbClient } from "@/lib/supabase/admin";
import { TEMPLATE_SCHEMA_VERSION } from "@/lib/excel/templateGenerator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json(
      { error: `Invalid offering ID "${id}": must be a valid RFC 4122 UUID.` },
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
    const {
      rows,
      columnMapping,
      maxMarks,
      isOutcomeXTemplate = false,
      templateMetadata,
      commit = false,
      confirmOverwrite = false,
    } = body;

    // 1. Validate Input Payload
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No student rows provided for marks import." },
        { status: 400 }
      );
    }

    if (!columnMapping || typeof columnMapping !== "object") {
      return NextResponse.json(
        { error: "Column mapping configuration is required." },
        { status: 400 }
      );
    }

    const rollColIdx = columnMapping["roll_no"];
    const nameColIdx = columnMapping["student_name"];

    if (rollColIdx === undefined || rollColIdx === null || rollColIdx < 0) {
      return NextResponse.json(
        { error: "Column mapping must specify the index for 'roll_no'." },
        { status: 400 }
      );
    }

    // 2. Cross-Offering Template Isolation Check
    if (templateMetadata?.offering_id) {
      const templateOfferingId = String(templateMetadata.offering_id).trim();
      if (isValidUuid(templateOfferingId) && templateOfferingId !== id) {
        return NextResponse.json(
          {
            error: `Course Offering Mismatch: This template was generated for offering "${templateOfferingId}", but you are importing into offering "${id}". Cross-offering imports are strictly prohibited to prevent data contamination.`,
            code: "CROSS_OFFERING_MISMATCH",
          },
          { status: 400 }
        );
      }
    }

    const db = await getDbClient();

    // 3. Query Offering Scheme & Cohort Capacity
    const { data: offeringRecord } = await db
      .from("course_offerings")
      .select(`
        id,
        attainment_scheme_id,
        attainment_schemes (
          id,
          scheme_name
        ),
        courses (
          course_code,
          course_name
        )
      `)
      .eq("id", id)
      .maybeSingle();

    const schemeName = (offeringRecord?.attainment_schemes as any)?.scheme_name || "";
    const is30_20 = schemeName.includes("30") || offeringRecord?.attainment_scheme_id?.includes("2");
    const maxCapacity = is30_20 ? 65 : 81;

    // 4. Authoritative Enrolled Students Map from Database
    const { data: dbEnrollments, error: enrErr } = await db
      .from("enrollments")
      .select(`
        id,
        roll_no,
        student_id,
        status,
        students (
          id,
          student_name
        )
      `)
      .eq("course_offering_id", id);

    if (enrErr) {
      throw new Error(`Database error querying course roster: ${enrErr.message}`);
    }

    const enrolledByRoll = new Map<string, { enrollment_id: string; student_id: string; student_name: string; roll_no: string }>();
    for (const enr of dbEnrollments || []) {
      const cleanRoll = String(enr.roll_no).trim().toLowerCase();
      enrolledByRoll.set(cleanRoll, {
        enrollment_id: enr.id,
        student_id: enr.student_id,
        student_name: (enr.students as any)?.student_name || `Student ${enr.roll_no}`,
        roll_no: enr.roll_no,
      });
    }

    // 5. Authoritative Assessment Components from Database
    const { data: dbComps, error: compErr } = await db
      .from("assessment_components")
      .select("id, component_name, max_marks, category, sort_order")
      .eq("course_offering_id", id)
      .order("sort_order", { ascending: true });

    if (compErr) {
      throw new Error(`Database error querying assessment components: ${compErr.message}`);
    }

    // Fallback if offering components not seeded yet in DB
    let componentsToUse = dbComps && dbComps.length > 0 ? dbComps : [];
    if (componentsToUse.length === 0) {
      const marksData = await offeringStore.getMarks(id);
      componentsToUse = marksData.components;
    }

    // Build Component Lookup: normalized key and id -> { id, max_marks, name, normKey }
    const compMap = new Map<string, { id: string; max_marks: number; name: string; normKey: string }>();
    for (const comp of componentsToUse) {
      const norm = normalizeComponentKey(comp.component_name);
      const entry = {
        id: comp.id,
        max_marks: Number(comp.max_marks || (maxMarks?.[norm] ?? 10)),
        name: comp.component_name,
        normKey: norm,
      };
      compMap.set(norm, entry);
      compMap.set(comp.id, entry);
      compMap.set(comp.component_name.toLowerCase().trim(), entry);
    }

    // 6. Query Existing Persisted Marks for Overwrite Detection
    const enrollmentIds = (dbEnrollments || []).map((e) => e.id);
    const existingMarksMap = new Map<string, { marks_obtained: number | null; status: string }>(); // `${enrollment_id}_${comp_id}` -> record

    if (enrollmentIds.length > 0) {
      const { data: dbMarks } = await db
        .from("student_marks")
        .select("enrollment_id, assessment_component_id, marks_obtained, status")
        .in("enrollment_id", enrollmentIds);

      for (const m of dbMarks || []) {
        existingMarksMap.set(`${m.enrollment_id}_${m.assessment_component_id}`, {
          marks_obtained: m.marks_obtained !== null ? Number(m.marks_obtained) : null,
          status: m.status || "PRESENT",
        });
      }
    }

    // 7. Full Evaluation of All Rows (Never truncated to 15)
    const seenRolls = new Set<string>();
    const rowErrors: Array<{
      row: number;
      roll_no: string;
      student_name?: string;
      component?: string;
      message: string;
      severity: "error" | "warning";
    }> = [];

    const validRecords: Array<{
      enrollment_id: string;
      student_id: string;
      roll_no: string;
      student_name: string;
      marks: Record<string, number | string | null>;
      statuses: Record<string, string>;
    }> = [];

    let newMarksCount = 0;
    let unchangedMarksCount = 0;
    let changedMarksCount = 0;
    const overwritesDetail: Array<{
      roll_no: string;
      student_name: string;
      component: string;
      old_value: any;
      new_value: any;
    }> = [];

    // Capacity validation
    if (rows.length > maxCapacity) {
      rowErrors.push({
        row: 0,
        roll_no: "COHORT_LIMIT",
        message: `Import cohort size (${rows.length}) exceeds maximum template capacity of ${maxCapacity} students for ${schemeName}. Please split cohort into sections.`,
        severity: "error",
      });
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const row = rows[i];
      const rawRoll = String(row[rollColIdx] ?? "").trim();

      // Check empty roll
      if (!rawRoll) {
        rowErrors.push({
          row: rowNum,
          roll_no: "MISSING",
          message: "Row has an empty or missing roll number.",
          severity: "error",
        });
        continue;
      }

      const rollLower = rawRoll.toLowerCase();

      // Check duplicate roll in uploaded file
      if (seenRolls.has(rollLower)) {
        rowErrors.push({
          row: rowNum,
          roll_no: rawRoll,
          message: `Duplicate student roll number "${rawRoll}" found in import file.`,
          severity: "error",
        });
        continue;
      }
      seenRolls.add(rollLower);

      // Check enrollment existence in this offering
      const enrolled = enrolledByRoll.get(rollLower);
      if (!enrolled) {
        rowErrors.push({
          row: rowNum,
          roll_no: rawRoll,
          message: `Student with Roll "${rawRoll}" is not enrolled in this course offering. Cross-offering or un-enrolled students cannot be imported.`,
          severity: "error",
        });
        continue;
      }

      const rawName = nameColIdx !== undefined && row[nameColIdx] !== undefined
        ? String(row[nameColIdx]).trim()
        : enrolled.student_name;

      const parsedMarks: Record<string, number | string | null> = {};
      const parsedStatuses: Record<string, string> = {};
      let rowHasCriticalError = false;

      // Process mapped assessment components
      for (const [compKey, colIdxRaw] of Object.entries(columnMapping)) {
        if (compKey === "roll_no" || compKey === "student_name") continue;

        const colIdx = Number(colIdxRaw);
        if (isNaN(colIdx) || colIdx < 0 || colIdx >= row.length) continue;

        const comp = compMap.get(compKey) || compMap.get(normalizeComponentKey(compKey));
        if (!comp) {
          rowErrors.push({
            row: rowNum,
            roll_no: rawRoll,
            student_name: enrolled.student_name,
            component: compKey,
            message: `Assessment component "${compKey}" is not configured for this course offering.`,
            severity: "error",
          });
          rowHasCriticalError = true;
          continue;
        }

        const cellVal = row[colIdx];
        const maxAllowed = comp.max_marks;

        // Missing / blank values
        if (cellVal === undefined || cellVal === null || String(cellVal).trim() === "" || String(cellVal).trim() === "-" || String(cellVal).trim().toUpperCase() === "NA" || String(cellVal).trim().toUpperCase() === "NULL") {
          parsedMarks[comp.normKey] = null;
          parsedStatuses[comp.normKey] = "NOT_ENTERED";

          // If mark previously existed in database, check status
          const existing = existingMarksMap.get(`${enrolled.enrollment_id}_${comp.id}`);
          if (existing && existing.status !== "NOT_ENTERED" && existing.marks_obtained !== null) {
            unchangedMarksCount++; // Blank in upload retains existing mark or indicates no change
          }
          continue;
        }

        const strVal = String(cellVal).trim().toUpperCase();

        // Absent & Exempt handling
        if (strVal === "A" || strVal === "AB" || strVal === "ABSENT") {
          parsedMarks[comp.normKey] = "A";
          parsedStatuses[comp.normKey] = "ABSENT";
        } else if (strVal === "E" || strVal === "EX" || strVal === "EXEMPT") {
          parsedMarks[comp.normKey] = "E";
          parsedStatuses[comp.normKey] = "EXEMPT";
        } else {
          // Numeric mark
          const num = parseFloat(strVal);
          if (isNaN(num)) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              student_name: enrolled.student_name,
              component: comp.name,
              message: `Invalid non-numeric mark "${cellVal}" entered for component "${comp.name}". Must be numeric, 'A' (Absent), or 'E' (Exempt).`,
              severity: "error",
            });
            rowHasCriticalError = true;
            parsedMarks[comp.normKey] = null;
            parsedStatuses[comp.normKey] = "ERROR";
            continue;
          } else if (num < 0) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              student_name: enrolled.student_name,
              component: comp.name,
              message: `Negative mark ${num} for component "${comp.name}" is not permitted.`,
              severity: "error",
            });
            rowHasCriticalError = true;
            parsedMarks[comp.normKey] = null;
            parsedStatuses[comp.normKey] = "ERROR";
            continue;
          } else if (num > maxAllowed) {
            rowErrors.push({
              row: rowNum,
              roll_no: rawRoll,
              student_name: enrolled.student_name,
              component: comp.name,
              message: `Mark ${num} exceeds maximum allowed limit of ${maxAllowed} for component "${comp.name}".`,
              severity: "error",
            });
            rowHasCriticalError = true;
            parsedMarks[comp.normKey] = num;
            parsedStatuses[comp.normKey] = "OUT_OF_BOUNDS";
            continue;
          } else {
            parsedMarks[comp.normKey] = num;
            parsedStatuses[comp.normKey] = "PRESENT";
          }
        }

        // Compare against existing database mark to track new vs unchanged vs changed marks
        const existing = existingMarksMap.get(`${enrolled.enrollment_id}_${comp.id}`);
        const newStatus = parsedStatuses[comp.normKey];
        const newMarkVal = parsedMarks[comp.normKey];

        if (!existing || existing.status === "NOT_ENTERED" || (existing.marks_obtained === null && existing.status !== "ABSENT" && existing.status !== "EXEMPT")) {
          newMarksCount++;
        } else {
          const oldValDisplay = existing.status === "ABSENT" ? "A" : existing.status === "EXEMPT" ? "E" : existing.marks_obtained;
          const newValDisplay = newStatus === "ABSENT" ? "A" : newStatus === "EXEMPT" ? "E" : newMarkVal;

          if (String(oldValDisplay) === String(newValDisplay)) {
            unchangedMarksCount++;
          } else {
            changedMarksCount++;
            overwritesDetail.push({
              roll_no: rawRoll,
              student_name: enrolled.student_name,
              component: comp.name,
              old_value: oldValDisplay,
              new_value: newValDisplay,
            });
          }
        }
      }

      if (!rowHasCriticalError) {
        validRecords.push({
          enrollment_id: enrolled.enrollment_id,
          student_id: enrolled.student_id,
          roll_no: rawRoll,
          student_name: rawName || enrolled.student_name,
          marks: parsedMarks,
          statuses: parsedStatuses,
        });
      }
    }

    const hasCriticalErrors = rowErrors.some((e) => e.severity === "error");

    // 8. If commit is requested, enforce overwrite confirmation and persistence
    let savedCount = 0;

    if (commit) {
      if (hasCriticalErrors) {
        return NextResponse.json(
          {
            error: `Cannot import marks: ${rowErrors.filter((e) => e.severity === "error").length} critical validation error(s) must be corrected first.`,
            validation_messages: rowErrors,
            code: "CRITICAL_VALIDATION_ERRORS",
          },
          { status: 400 }
        );
      }

      // Check overwrite confirmation requirement
      if (changedMarksCount > 0 && !confirmOverwrite) {
        return NextResponse.json(
          {
            success: false,
            requires_overwrite_confirmation: true,
            message: `This import will overwrite ${changedMarksCount} existing mark(s) already saved in the database. Please confirm the overwrite to proceed.`,
            changed_marks_count: changedMarksCount,
            overwrites_detail: overwritesDetail.slice(0, 100),
            total_overwrites: overwritesDetail.length,
          },
          { status: 409 }
        );
      }

      // Persist all valid student marks to Supabase student_marks
      const rowsToUpsert: Array<{
        enrollment_id: string;
        assessment_component_id: string;
        marks_obtained: number | null;
        status: string;
        updated_at: string;
      }> = [];

      for (const record of validRecords) {
        for (const [key, val] of Object.entries(record.marks)) {
          const comp = compMap.get(key);
          if (!comp) continue;

          const status = record.statuses[key] || "PRESENT";
          const marksObtained = typeof val === "number" ? val : null;

          rowsToUpsert.push({
            enrollment_id: record.enrollment_id,
            assessment_component_id: comp.id,
            marks_obtained: marksObtained,
            status,
            updated_at: new Date().toISOString(),
          });
        }
      }

      if (rowsToUpsert.length > 0) {
        // Chunk upserts in batches of 200
        const chunkSize = 200;
        for (let i = 0; i < rowsToUpsert.length; i += chunkSize) {
          const chunk = rowsToUpsert.slice(i, i + chunkSize);
          const { error: upErr } = await db
            .from("student_marks")
            .upsert(chunk, { onConflict: "enrollment_id,assessment_component_id" });

          if (upErr) {
            throw new Error(`Failed to persist marks transactionally: ${upErr.message}`);
          }
        }
        savedCount = rowsToUpsert.length;
      }

      // Write audit log entry
      try {
        await db.from("audit_logs").insert({
          profile_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : null,
          action: "MARKS_IMPORTED",
          resource_type: "student_marks",
          resource_id: id,
          payload: {
            offering_id: id,
            user_email: authCtx.user.email,
            is_outcomex_template: isOutcomeXTemplate,
            total_rows_evaluated: rows.length,
            valid_students_count: validRecords.length,
            records_saved: savedCount,
            new_marks_count: newMarksCount,
            changed_marks_count: changedMarksCount,
            unchanged_marks_count: unchangedMarksCount,
            overwrites_confirmed: confirmOverwrite,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {}
    }

    // 9. Return Comprehensive Response
    return NextResponse.json({
      success: !hasCriticalErrors,
      offering_id: id,
      is_outcomex_template: isOutcomeXTemplate,
      total_rows_evaluated: rows.length,
      valid_rows_count: validRecords.length,
      invalid_rows_count: rows.length - validRecords.length,
      has_critical_errors: hasCriticalErrors,
      errors_count: rowErrors.filter((e) => e.severity === "error").length,
      warnings_count: rowErrors.filter((e) => e.severity === "warning").length,
      new_marks_count: newMarksCount,
      unchanged_marks_count: unchangedMarksCount,
      changed_marks_count: changedMarksCount,
      overwrites_detail: overwritesDetail.slice(0, 100),
      total_overwrites: overwritesDetail.length,
      validation_messages: rowErrors,
      saved_count: savedCount,
      preview_data: validRecords.slice(0, 15),
      all_valid_records: validRecords, // Complete un-truncated cohort for client confirmation
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process marks import" },
      { status: 500 }
    );
  }
}
