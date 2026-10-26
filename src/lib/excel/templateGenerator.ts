import ExcelJS from "exceljs";
import crypto from "crypto";
import { getDbClient } from "@/lib/supabase/admin";
import { isValidUuid, normalizeComponentKey, offeringStore } from "@/lib/domain/offeringStore";
import { INITIAL_OFFERING, INITIAL_COURSE, INITIAL_ASSESSMENTS, INITIAL_30_20_ASSESSMENTS, INITIAL_SCHEMES } from "@/lib/data/initialData";

export const TEMPLATE_SCHEMA_VERSION = "outcomeX-marks-template-v1.0";

export interface TemplateComponentMetadata {
  id: string;
  key: string;
  name: string;
  max_marks: number;
  category: string;
  co_code: string;
  col_idx: number; // 1-based index in Marks_Entry sheet
}

export interface TemplateGenerationResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  offeringId: string;
  courseCode: string;
  courseName: string;
  section: string;
  schemeName: string;
  studentsCount: number;
  components: TemplateComponentMetadata[];
}

/**
 * Generates an official, schema-verified marks import template for a specific course offering.
 * Dynamically binds the actual enrolled students and configured assessment components.
 * Protects student identities and column definitions from accidental modification.
 */
export async function generateMarksTemplate(
  offeringId: string,
  options?: { format?: "xlsx" | "csv"; prefillExistingMarks?: boolean }
): Promise<TemplateGenerationResult> {
  if (!isValidUuid(offeringId)) {
    throw new Error(`Invalid course offering ID "${offeringId}": must be a valid RFC 4122 UUID.`);
  }

  const format = options?.format || "xlsx";
  const db = await getDbClient();

  // 1. Fetch offering and course context
  const { data: offering, error: offErr } = await db
    .from("course_offerings")
    .select(`
      id,
      section,
      academic_year_id,
      attainment_scheme_id,
      courses (
        id,
        course_code,
        course_name,
        semester,
        year_of_study
      ),
      attainment_schemes (
        id,
        scheme_name
      )
    `)
    .eq("id", offeringId)
    .maybeSingle();

  if (offErr) {
    throw new Error(`Database error fetching offering details: ${offErr.message}`);
  }

  const courseData: any = offering?.courses || INITIAL_COURSE;
  const courseCode = courseData.course_code || INITIAL_COURSE.course_code;
  const courseName = courseData.course_name || INITIAL_COURSE.course_name;
  const section = offering?.section || "A";

  const rawSchemeData: any = offering?.attainment_schemes;
  let rawSchemeName: string = (Array.isArray(rawSchemeData) ? rawSchemeData[0]?.scheme_name : rawSchemeData?.scheme_name) || "";

  if (!rawSchemeName && offering?.attainment_scheme_id) {
    const { data: sch } = await db
      .from("attainment_schemes")
      .select("scheme_name")
      .eq("id", offering.attainment_scheme_id)
      .maybeSingle();
    if (sch?.scheme_name) rawSchemeName = sch.scheme_name;
  }

  if (!rawSchemeName && (offeringId === "f0000000-0000-0000-0000-000000000002" || offeringId.endsWith("0002") || String(offering?.attainment_scheme_id || "").includes("30000000") || String(offering?.attainment_scheme_id || "").includes("2"))) {
    rawSchemeName = "Autonomous 30/20 Scheme";
  }

  const is30_20 = rawSchemeName.includes("30") ||
    String(offering?.attainment_scheme_id || "").includes("30000000") ||
    String(offering?.attainment_scheme_id || "").includes("30") ||
    offeringId === "f0000000-0000-0000-0000-000000000002" ||
    offeringId.endsWith("0002");

  const schemeName = rawSchemeName || (is30_20 ? "Autonomous 30/20 Scheme" : "Autonomous 60/40 Scheme");

  // 2. Fetch enrolled students from canonical database roster
  const roster = await offeringStore.getRoster(offeringId);

  // 3. Fetch configured assessment components for this offering with their CO mappings
  const { data: dbComps } = await db
    .from("assessment_components")
    .select(`
      id,
      component_name,
      max_marks,
      category,
      sort_order,
      assessment_component_co_mappings (
        course_outcome_id,
        weight,
        course_outcomes (
          id,
          co_code
        )
      )
    `)
    .eq("course_offering_id", offeringId)
    .order("sort_order", { ascending: true });

  let rawComponents: any[] = [];
  if (dbComps && dbComps.length > 0) {
    rawComponents = dbComps;
  } else if (offeringId === INITIAL_OFFERING.id || offeringId.startsWith("f0000000")) {
    rawComponents = is30_20 ? INITIAL_30_20_ASSESSMENTS : INITIAL_ASSESSMENTS;
  } else {
    throw new Error(
      `Assessment configuration is incomplete for course offering "${offeringId}". No assessment components have been configured. Please configure assessment components in Course Setup before downloading the template.`
    );
  }

  const components: TemplateComponentMetadata[] = rawComponents.map((comp, idx) => {
    const key = normalizeComponentKey(comp.component_name);
    const mappings = comp.assessment_component_co_mappings || [];
    const primaryMapping = Array.isArray(mappings) ? mappings[0] : mappings;
    const coCode = primaryMapping?.course_outcomes?.co_code ||
      comp.course_outcomes?.co_code ||
      (key.match(/co\d+/i) ? key.match(/co\d+/i)![0].toUpperCase() : "-");

    return {
      id: comp.id,
      key,
      name: comp.component_name,
      max_marks: Number(comp.max_marks),
      category: comp.category || "ASSESSMENT",
      co_code: coCode,
      col_idx: idx + 3, // Col 1 = Roll, Col 2 = Name, Col 3+ = Components
    };
  });

  // 4. Fetch existing marks to optionally pre-fill for faculty convenience
  const existingMarksByRoll = new Map<string, Record<string, any>>();
  if (options?.prefillExistingMarks !== false && roster.length > 0) {
    try {
      const marksData = await offeringStore.getMarks(offeringId);
      for (const rec of marksData.marks) {
        existingMarksByRoll.set(rec.roll_no.trim().toLowerCase(), rec.marks || {});
      }
    } catch {}
  }

  // Calculate checksum for template integrity
  const checksumPayload = `${TEMPLATE_SCHEMA_VERSION}:${offeringId}:${components.map((c) => `${c.id}:${c.max_marks}`).join(",")}`;
  const checksum = crypto.createHash("sha256").update(checksumPayload).digest("hex");

  // Format safe filename
  const cleanCode = courseCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `OutcomeX_Template_${cleanCode}_Sec${section}_${is30_20 ? "30_20" : "60_40"}.${format}`;

  if (format === "csv") {
    // Generate CSV Template with schema metadata comment
    const lines: string[] = [];
    lines.push(`# ${TEMPLATE_SCHEMA_VERSION} | Offering ID: ${offeringId} | Course: ${courseCode} (${courseName}) | Section: ${section} | Scheme: ${schemeName}`);
    lines.push(`# Checksum: ${checksum} | Enrolled: ${roster.length} students | Do not alter Roll No or column headers`);

    // CSV Column Headers
    const headers = ["Roll No", "Student Name", ...components.map((c) => `${c.name} [Max ${c.max_marks}]`)];
    lines.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

    // Student rows
    for (const student of roster) {
      const existing = existingMarksByRoll.get(student.roll_no.trim().toLowerCase()) || {};
      const rowVals = [
        student.roll_no,
        student.student_name,
        ...components.map((c) => {
          const val = existing[c.key] ?? existing[c.id];
          return val === null || val === undefined ? "" : String(val);
        }),
      ];
      lines.push(rowVals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }

    const csvBuffer = Buffer.from(lines.join("\r\n"), "utf-8");
    return {
      buffer: csvBuffer,
      filename,
      mimeType: "text/csv; charset=utf-8",
      offeringId,
      courseCode,
      courseName,
      section,
      schemeName,
      studentsCount: roster.length,
      components,
    };
  }

  // Generate ExcelJS Workbook (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OutcomeX OBE Platform";
  workbook.lastModifiedBy = "OutcomeX Template Service";
  workbook.created = new Date();
  workbook.modified = new Date();

  // --------------------------------------------------------------------------
  // Sheet 1: Marks_Entry
  // --------------------------------------------------------------------------
  const sheet = workbook.addWorksheet("Marks_Entry", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 7 }], // Freeze Roll No, Name, and 7 Header rows
  });

  // Category Color Palette
  const categoryFill: Record<string, { bg: string; fg: string }> = {
    MID_TERM_1: { bg: "E0F2FE", fg: "0369A1" }, // Sky-100 / Sky-700
    MID_TERM_2: { bg: "EEF2FF", fg: "4338CA" }, // Indigo-100 / Indigo-700
    TEACHER_ASSESSMENT: { bg: "FEF3C7", fg: "B45309" }, // Amber-100 / Amber-700
    END_SEM: { bg: "ECFDF5", fg: "047857" }, // Emerald-100 / Emerald-700
  };

  const defaultCategory = { bg: "F1F5F9", fg: "334155" };

  // Row 1: Title Banner
  sheet.mergeCells(1, 1, 1, components.length + 2);
  const row1Cell = sheet.getCell("A1");
  row1Cell.value = "OUTCOMEX — STUDENT MARKS IMPORT TEMPLATE";
  row1Cell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  row1Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } }; // Slate-900
  row1Cell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  // Row 2: Course & Offering Metadata
  sheet.mergeCells(2, 1, 2, components.length + 2);
  const row2Cell = sheet.getCell("A2");
  row2Cell.value = `Course: ${courseCode} - ${courseName}  |  Section: ${section}  |  Scheme: ${schemeName}  |  Cohort Size: ${roster.length} Enrolled Students`;
  row2Cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFE2E8F0" } };
  row2Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } }; // Slate-800
  row2Cell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 22;

  // Row 3: Template Schema Version & Offering ID (Machine recognized & verified)
  sheet.mergeCells(3, 1, 3, components.length + 2);
  const row3Cell = sheet.getCell("A3");
  row3Cell.value = `Template Schema: ${TEMPLATE_SCHEMA_VERSION}  |  Offering ID: ${offeringId}  |  Checksum: ${checksum.slice(0, 16)}  (DO NOT ALTER IDENTIFIER COLUMNS)`;
  row3Cell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF94A3B8" } };
  row3Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } }; // Slate-700
  row3Cell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(3).height = 20;

  // Row 4: Component Category Groups (Merged where adjacent)
  const row4 = sheet.getRow(4);
  sheet.mergeCells(4, 1, 4, 2);
  const idGroupCell = sheet.getCell("A4");
  idGroupCell.value = "STUDENT IDENTIFIERS";
  idGroupCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  idGroupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  idGroupCell.alignment = { horizontal: "center", vertical: "middle" };

  components.forEach((c) => {
    const colIdx = c.col_idx;
    const catStyle = categoryFill[c.category] || defaultCategory;
    const cell = sheet.getRow(4).getCell(colIdx);
    cell.value = c.category.replace(/_/g, " ");
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: `FF${catStyle.fg}` } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${catStyle.bg}` } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  row4.height = 20;

  // Row 5: Course Outcome Mappings
  const row5 = sheet.getRow(5);
  sheet.getCell("A5").value = "Outcome Mapping:";
  sheet.getCell("B5").value = "-";
  sheet.getCell("A5").font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
  sheet.getCell("B5").font = { name: "Arial", size: 9, color: { argb: "FF94A3B8" } };
  sheet.getCell("A5").alignment = { horizontal: "right", vertical: "middle" };
  sheet.getCell("B5").alignment = { horizontal: "center", vertical: "middle" };

  components.forEach((c) => {
    const cell = sheet.getRow(5).getCell(c.col_idx);
    cell.value = c.co_code;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  row5.height = 20;

  // Row 6: Assessment Component Names
  const row6 = sheet.getRow(6);
  sheet.getCell("A6").value = "Roll No *";
  sheet.getCell("B6").value = "Student Name";
  sheet.getCell("A6").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
  sheet.getCell("B6").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
  sheet.getCell("A6").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("B6").alignment = { horizontal: "left", vertical: "middle" };

  components.forEach((c) => {
    const cell = sheet.getRow(6).getCell(c.col_idx);
    cell.value = c.name;
    cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  row6.height = 26;

  // Row 7: Max Marks Row
  const row7 = sheet.getRow(7);
  sheet.getCell("A7").value = "MAX MARKS:";
  sheet.getCell("B7").value = "(Allowed range: 0 to Max, or 'A'/'E')";
  sheet.getCell("A7").font = { name: "Arial", size: 9, bold: true, color: { argb: "FF2563EB" } };
  sheet.getCell("B7").font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
  sheet.getCell("A7").alignment = { horizontal: "right", vertical: "middle" };
  sheet.getCell("B7").alignment = { horizontal: "left", vertical: "middle" };

  components.forEach((c) => {
    const cell = sheet.getRow(7).getCell(c.col_idx);
    cell.value = `Max: ${c.max_marks}`;
    cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF1E40AF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  row7.height = 22;

  // Border styling for headers
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  for (let r = 4; r <= 7; r++) {
    for (let c = 1; c <= components.length + 2; c++) {
      sheet.getRow(r).getCell(c).border = thinBorder;
    }
  }

  // Rows 8+: Student Data Rows
  const startRow = 8;
  const rowsToRender = roster.length > 0 ? roster : [
    { roll_no: "101", student_name: "Sample Student (Enroll students in Roster)" },
  ];

  rowsToRender.forEach((student, sIdx) => {
    const rowIdx = startRow + sIdx;
    const row = sheet.getRow(rowIdx);
    row.height = 20;

    // Col A: Roll Number (Stable Identifier - LOCKED)
    const rollCell = row.getCell(1);
    const numRoll = parseFloat(student.roll_no);
    rollCell.value = !isNaN(numRoll) && /^\d+$/.test(student.roll_no.trim()) ? numRoll : student.roll_no.trim();
    rollCell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
    rollCell.alignment = { horizontal: "center", vertical: "middle" };
    rollCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    rollCell.border = thinBorder;
    rollCell.protection = { locked: true };

    // Col B: Student Name (Display field - LOCKED)
    const nameCell = row.getCell(2);
    nameCell.value = student.student_name.trim();
    nameCell.font = { name: "Arial", size: 9.5, color: { argb: "FF1E293B" } };
    nameCell.alignment = { horizontal: "left", vertical: "middle" };
    nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    nameCell.border = thinBorder;
    nameCell.protection = { locked: true };

    // Cols C+: Marks Entry Cells (UNLOCKED for faculty input!)
    const existing = existingMarksByRoll.get(student.roll_no.trim().toLowerCase()) || {};
    components.forEach((c) => {
      const cell = row.getCell(c.col_idx);
      const savedVal = existing[c.key] ?? existing[c.id];

      if (savedVal !== null && savedVal !== undefined && String(savedVal).trim() !== "") {
        if (typeof savedVal === "number") {
          cell.value = savedVal;
        } else {
          const str = String(savedVal).trim().toUpperCase();
          if (str === "A" || str === "AB" || str === "ABSENT") {
            cell.value = "A";
          } else if (str === "E" || str === "EX" || str === "EXEMPT") {
            cell.value = "E";
          } else {
            const num = parseFloat(str);
            cell.value = isNaN(num) ? str : num;
          }
        }
      } else {
        cell.value = null;
      }

      cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = thinBorder;
      // UNLOCKED: Faculty can edit marks freely while headers and roll numbers are protected
      cell.protection = { locked: false };
    });
  });

  // Set Column Widths
  sheet.getColumn(1).width = 16; // Roll No
  sheet.getColumn(2).width = 30; // Student Name
  components.forEach((c) => {
    sheet.getColumn(c.col_idx).width = 15; // Assessment columns
  });

  // Enable Worksheet Protection
  // Locks Roll Numbers, Names, and Headers, but permits selecting and editing marks cells
  await sheet.protect("OutcomeX_Template_Protect_2026", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: true,
    autoFilter: true,
  });

  // --------------------------------------------------------------------------
  // Sheet 2: Instructions
  // --------------------------------------------------------------------------
  const instrSheet = workbook.addWorksheet("Instructions");
  instrSheet.views = [{ showGridLines: true }];

  instrSheet.getColumn(1).width = 6;
  instrSheet.getColumn(2).width = 80;

  const instrTitle = instrSheet.getCell("B2");
  instrTitle.value = "OUTCOMEX MARKS IMPORT GUIDELINES";
  instrTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };

  const guidelines = [
    {
      title: "1. Dedicated Assessment Columns",
      body: "Enter marks only in the assessment columns (Columns C onwards). Columns A (Roll No) and B (Student Name) are locked identifiers.",
    },
    {
      title: "2. Permitted Value Formats",
      body: "• Numbers: Any score between 0 and the column's Maximum Marks shown in Row 7 (e.g., 8.5).\n• Absent Students: Enter 'A', 'AB', or 'ABSENT' (will NOT be converted to 0).\n• Exempted Students: Enter 'E', 'EX', or 'EXEMPT'.\n• Missing Marks: Leave the cell blank/empty (will remain NOT_ENTERED in the gradebook).\n• Zero Marks: Enter 0 or 0.0 (indicates the student took the exam and scored 0).",
    },
    {
      title: "3. Maximum Marks Constraints",
      body: `All marks must adhere to the configured maximums:\n${components.map((c) => `   - ${c.name}: Max ${c.max_marks} marks (${c.co_code})`).join("\n")}`,
    },
    {
      title: "4. No Manual Column Mapping Required",
      body: "Because this template was generated directly by OutcomeX for this offering, the system automatically detects all column mappings and identifiers when you upload this file. You do not need to perform manual mapping.",
    },
    {
      title: "5. Safe Overwrite Protection",
      body: "If any student already has a mark recorded in the database, OutcomeX will highlight the proposed change during validation and require explicit confirmation before overwriting.",
    },
    {
      title: "6. Course Offering Isolation",
      body: `This template is bound specifically to ${courseCode} (Section ${section}, ${schemeName}). It cannot be uploaded into another course offering or semester.`,
    },
  ];

  let currentInstrRow = 4;
  guidelines.forEach((g) => {
    const tCell = instrSheet.getCell(`B${currentInstrRow}`);
    tCell.value = g.title;
    tCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1E40AF" } };
    currentInstrRow++;

    const bCell = instrSheet.getCell(`B${currentInstrRow}`);
    bCell.value = g.body;
    bCell.font = { name: "Arial", size: 9.5, color: { argb: "FF334155" } };
    bCell.alignment = { wrapText: true };
    currentInstrRow += 2;
  });

  // --------------------------------------------------------------------------
  // Sheet 3: Template_Metadata (Hidden & Schema-Protected)
  // --------------------------------------------------------------------------
  const metaSheet = workbook.addWorksheet("Template_Metadata");
  metaSheet.state = "hidden"; // Hidden from normal spreadsheet UI

  const metaData = [
    ["schema_version", TEMPLATE_SCHEMA_VERSION],
    ["offering_id", offeringId],
    ["course_code", courseCode],
    ["course_name", courseName],
    ["section", section],
    ["scheme_name", schemeName],
    ["scheme_type", is30_20 ? "30_20" : "60_40"],
    ["student_count", String(roster.length)],
    ["components_count", String(components.length)],
    ["components_schema", JSON.stringify(components)],
    ["checksum", checksum],
    ["generated_at", new Date().toISOString()],
  ];

  metaData.forEach((row, rIdx) => {
    metaSheet.getRow(rIdx + 1).getCell(1).value = row[0];
    metaSheet.getRow(rIdx + 1).getCell(2).value = row[1];
  });

  // Generate buffer in memory
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  return {
    buffer: fileBuffer,
    filename,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    offeringId,
    courseCode,
    courseName,
    section,
    schemeName,
    studentsCount: roster.length,
    components,
  };
}
