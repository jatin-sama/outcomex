import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const REFERENCE_WORKBOOK_PATH = path.join(
  process.cwd(),
  "reference",
  "Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx"
);

export interface CourseMetadata {
  course_code: string;
  course_name: string;
  department: string;
  year_semester: string;
  academic_year: string;
  section?: string;
  po_results?: Array<{ po_code: string; achieved_attainment: number | null }>;
}

export interface StudentMarksRecord {
  roll_no: string;
  student_name: string;
  marks: Record<string, number | string | null | undefined>;
}

export interface GenerateResult {
  success: boolean;
  filename: string;
  outputPath: string;
  file_size_bytes: number;
  sha256: string;
  repaired_formulas?: string[];
}

export async function generateExcelReport(
  schemeType: "60_40" | "30_20" | string,
  courseData: CourseMetadata,
  studentRecords: StudentMarksRecord[],
  outputPath: string
): Promise<GenerateResult> {
  if (!studentRecords || studentRecords.length === 0) {
    throw new Error("Cannot generate report: No student records provided for offering.");
  }

  if (!fs.existsSync(REFERENCE_WORKBOOK_PATH)) {
    throw new Error(`Reference workbook template not found at ${REFERENCE_WORKBOOK_PATH}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(REFERENCE_WORKBOOK_PATH);

  const sheetName = schemeType.includes("30") ? "For 30_20 (Final)" : "For 60_40 (final)";
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    throw new Error(`Worksheet '${sheetName}' not found in template workbook.`);
  }

  // 1. Populate Course Header Metadata
  if (courseData.department) {
    worksheet.getCell("O3").value = courseData.department;
  }
  if (courseData.year_semester) {
    worksheet.getCell("R3").value = `Year / Semester :${courseData.year_semester}`;
  }
  if (courseData.course_name) {
    worksheet.getCell("O4").value = courseData.course_name;
  }
  if (courseData.course_code) {
    worksheet.getCell("O5").value = courseData.course_code;
  }
  if (courseData.academic_year) {
    worksheet.getCell("R5").value = `Year of Study : ${courseData.academic_year}`;
  }

  let repairedFormulas: string[] | undefined = undefined;

  if (schemeType.includes("30")) {
    // ------------------------------------------------------------------------
    // 30/20 Scheme Specific Repairs & Population
    // ------------------------------------------------------------------------
    repairedFormulas = ["Y7:AB7", "Y4:AB5", "G27:H27", "G94:H94"];

    // Fix ERR-03: Header mislabels
    worksheet.getCell("G27").value = "CO3";
    worksheet.getCell("H27").value = "CO4";
    worksheet.getCell("G94").value = { formula: "G27" };
    worksheet.getCell("H94").value = { formula: "H27" };

    // Fix ERR-02: Typos in Y4:AB5 referencing row 97 instead of 98
    worksheet.getCell("Y4").value = { formula: 'IF($C$94="CO1",$C$98,IF($D$94="CO1",$D$98,IF($E$94="CO1",$E$98,"")))' };
    worksheet.getCell("Z4").value = { formula: 'IF($C$94="CO2",$C$98,IF($D$94="CO2",$D$98,IF($E$94="CO2",$E$98,"")))' };
    worksheet.getCell("AA4").value = { formula: 'IF($C$94="CO3",$C$98,IF($D$94="CO3",$D$98,IF($E$94="CO3",$E$98,"")))' };
    worksheet.getCell("AB4").value = { formula: 'IF($C$94="CO4",$C$98,IF($D$94="CO4",$D$98,IF($E$94="CO4",$E$98,"")))' };

    worksheet.getCell("Y5").value = { formula: 'IF($G$94="CO1",$G$98,IF($H$94="CO1",$H$98,IF($I$94="CO1",$I$98,"")))' };
    worksheet.getCell("Z5").value = { formula: 'IF($G$94="CO2",$G$98,IF($H$94="CO2",$H$98,IF($I$94="CO2",$I$98,"")))' };
    worksheet.getCell("AA5").value = { formula: 'IF($G$94="CO3",$G$98,IF($H$94="CO3",$H$98,IF($I$94="CO3",$I$98,"")))' };
    worksheet.getCell("AB5").value = { formula: 'IF($G$94="CO4",$G$98,IF($H$94="CO4",$H$98,IF($I$94="CO4",$I$98,"")))' };

    // Fix ERR-01: Broken #REF! formulas in Y7:AB7
    worksheet.getCell("Y7").value = { formula: 'IF($K$94="CO1",$K$98,IF($L$94="CO1",$L$98,IF($M$94="CO1",$M$98,IF($N$94="CO1",$N$98,""))))' };
    worksheet.getCell("Z7").value = { formula: 'IF($K$94="CO2",$K$98,IF($L$94="CO2",$L$98,IF($M$94="CO2",$M$98,IF($N$94="CO2",$N$98,""))))' };
    worksheet.getCell("AA7").value = { formula: 'IF($K$94="CO3",$K$98,IF($L$94="CO3",$L$98,IF($M$94="CO3",$M$98,IF($N$94="CO3",$N$98,""))))' };
    worksheet.getCell("AB7").value = { formula: 'IF($K$94="CO4",$K$98,IF($L$94="CO4",$L$98,IF($M$94="CO4",$M$98,IF($N$94="CO4",$N$98,""))))' };

    const compToCol: Record<string, string> = {
      mt1_co1: "C",
      mt1_co2: "D",
      mt2_co3: "G",
      mt2_co4: "H",
      ese_co1: "K",
      ese_co2: "L",
      ese_co3: "M",
      ese_co4: "N",
      ta: "P",
    };

    const startRow = 29;
    const cohortSize = studentRecords.length;

    for (let i = 0; i < studentRecords.length; i++) {
      const r = startRow + i;
      if (r > 93) break; // 30/20 default student range ends at row 93

      const student = studentRecords[i];
      const rollStr = String(student.roll_no || "").trim();
      const numRoll = parseFloat(rollStr);
      worksheet.getCell(`A${r}`).value = !isNaN(numRoll) && /^\d+(\.\d+)?$/.test(rollStr) ? numRoll : rollStr;
      worksheet.getCell(`B${r}`).value = String(student.student_name || "").trim();

      const marks = student.marks || {};
      for (const [compKey, colLetter] of Object.entries(compToCol)) {
        const val = marks[compKey];
        const cell = worksheet.getCell(`${colLetter}${r}`);
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          if (typeof val === "number") {
            cell.value = val;
          } else {
            const strVal = String(val).trim().toUpperCase();
            if (strVal === "A" || strVal === "AB" || strVal === "ABSENT") {
              cell.value = strVal === "A" ? "A" : "AB";
            } else {
              const parsed = parseFloat(strVal);
              cell.value = isNaN(parsed) ? strVal : parsed;
            }
          }
        } else {
          cell.value = null;
        }
      }
    }

    // Clear unused template student rows from startRow + cohortSize to 93
    for (let r = startRow + cohortSize; r <= 93; r++) {
      for (let c = 1; c <= 26; c++) {
        worksheet.getRow(r).getCell(c).value = null;
      }
      worksheet.getCell(`AA${r}`).value = null;
      worksheet.getCell(`AB${r}`).value = null;
    }
  } else {
    // ------------------------------------------------------------------------
    // 60/40 Scheme Specific Population
    // ------------------------------------------------------------------------
    const compToCol: Record<string, string> = {
      mt1_co1: "C",
      mt1_co2: "D",
      mt1_co3: "E",
      mt2_co4: "H",
      mt2_co5: "I",
      mt2_co6: "J",
      ese_co1: "M",
      ese_co2: "N",
      ese_co3: "O",
      ese_co4: "P",
      ese_co5: "Q",
      ese_co6: "R",
      ta: "T",
    };

    const startRow = 29;
    const cohortSize = studentRecords.length;

    for (let i = 0; i < studentRecords.length; i++) {
      const r = startRow + i;
      if (r > 109) break; // 60/40 student range ends at row 109

      const student = studentRecords[i];
      const rollStr = String(student.roll_no || "").trim();
      const numRoll = parseFloat(rollStr);
      worksheet.getCell(`A${r}`).value = !isNaN(numRoll) && /^\d+(\.\d+)?$/.test(rollStr) ? numRoll : rollStr;
      worksheet.getCell(`B${r}`).value = String(student.student_name || "").trim();

      const marks = student.marks || {};
      for (const [compKey, colLetter] of Object.entries(compToCol)) {
        const val = marks[compKey];
        const cell = worksheet.getCell(`${colLetter}${r}`);
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          if (typeof val === "number") {
            cell.value = val;
          } else {
            const strVal = String(val).trim().toUpperCase();
            if (strVal === "A" || strVal === "AB" || strVal === "ABSENT") {
              cell.value = strVal === "A" ? "A" : "AB";
            } else {
              const parsed = parseFloat(strVal);
              cell.value = isNaN(parsed) ? strVal : parsed;
            }
          }
        } else {
          cell.value = null;
        }
      }
    }

    // Clear unused template student rows from startRow + cohortSize to 109
    for (let r = startRow + cohortSize; r <= 109; r++) {
      for (let c = 1; c <= 26; c++) {
        worksheet.getRow(r).getCell(c).value = null;
      }
      worksheet.getCell(`AA${r}`).value = null;
      worksheet.getCell(`AB${r}`).value = null;
    }

    // Populate PO row 21 values if available
    if (courseData.po_results && Array.isArray(courseData.po_results)) {
      const poCols: Record<string, string> = {
        PO1: "O", PO2: "P", PO3: "Q", PO4: "R", PO5: "S", PO6: "T",
        PO7: "U", PO8: "V", PO9: "W", PO10: "X", PO11: "Y", PO12: "Z",
        "PSO 1": "AA", "PSO 2": "AB",
      };
      for (const poItem of courseData.po_results) {
        const col = poCols[poItem.po_code];
        if (col && poItem.achieved_attainment !== null && poItem.achieved_attainment !== undefined) {
          worksheet.getCell(`${col}21`).value = Number(poItem.achieved_attainment);
        }
      }
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save workbook to output destination
  await workbook.xlsx.writeFile(outputPath);

  const stats = fs.statSync(outputPath);
  const fileBuffer = fs.readFileSync(outputPath);
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  return {
    success: true,
    filename: path.basename(outputPath),
    outputPath,
    file_size_bytes: stats.size,
    sha256,
    repaired_formulas: repairedFormulas,
  };
}
