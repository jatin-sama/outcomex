/**
 * OutcomeX — Excel Template & Marks File Parser Helper
 * 
 * Accurately detects header rows without false-matching offering context rows
 * (e.g. "Cohort Size: 65 Enrolled Students" matching "roll"), strips metadata banners,
 * and extracts clean student data rows.
 */

export function parseExcelRows(rows: string[][]): {
  headerRowIdx: number;
  headers: string[];
  dataRows: string[][];
} {
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    const isHeaderRow = row.some((c) => {
      const clean = String(c ?? "").trim().toLowerCase();
      return (
        clean === "roll no" ||
        clean === "roll no *" ||
        clean === "roll no." ||
        clean === "roll_no" ||
        clean === "roll" ||
        clean === "roll number" ||
        clean === "roll #" ||
        clean === "roll#" ||
        (clean.startsWith("roll") && !clean.includes("enrolled") && clean.length <= 15)
      );
    });
    if (isHeaderRow) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
  }

  const headers = rows[headerRowIdx] || [];
  let dataRows = rows.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== ""));

  // If template has max marks in row immediately following headers, filter it out
  if (
    dataRows.length > 0 &&
    dataRows[0].some((c) => {
      const cl = String(c ?? "").trim().toLowerCase();
      return cl.startsWith("max marks") || cl.startsWith("max:") || cl.includes("allowed range");
    })
  ) {
    dataRows = dataRows.slice(1);
  }

  // Filter out any metadata or non-data banner rows
  dataRows = dataRows.filter((r) => {
    if (!r || r.length === 0 || !r.some((c) => c !== "")) return false;
    const rowStr = r.map((c) => String(c ?? "").trim().toLowerCase()).join(" ");
    const firstCol = String(r[0] ?? "").trim().toLowerCase();
    const secondCol = String(r[1] ?? "").trim().toLowerCase();
    if (
      rowStr.includes("template schema") ||
      rowStr.includes("outcomex marks entry") ||
      rowStr.includes("allowed range") ||
      rowStr.includes("outcome mapping:") ||
      firstCol.startsWith("outcomex") ||
      firstCol.startsWith("course:") ||
      firstCol.startsWith("student identifiers") ||
      firstCol.startsWith("outcome mapping") ||
      firstCol.startsWith("roll no") ||
      firstCol.startsWith("max marks") ||
      firstCol.startsWith("max:") ||
      firstCol.includes("allowed range") ||
      secondCol.includes("allowed range") ||
      firstCol === "-" ||
      firstCol === "teacher assessment" ||
      firstCol.startsWith("teacher assessment (") ||
      firstCol.startsWith("mid_term") ||
      firstCol.startsWith("mid term") ||
      firstCol.startsWith("end_sem") ||
      firstCol.startsWith("end sem")
    ) {
      return false;
    }
    return true;
  });

  return { headerRowIdx, headers, dataRows };
}
