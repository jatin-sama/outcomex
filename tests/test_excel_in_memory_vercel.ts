import { generateExcelReport } from "../src/lib/excel/excelGenerator";
import assert from "assert";

async function main() {
  console.log("=== Running In-Memory Vercel Excel Generation Test ===");

  const courseData = {
    course_code: "25UCS623T_TEST",
    course_name: "In-Memory Test Course",
    department: "CSE",
    year_semester: "3rd Yr / 5th Sem",
    academic_year: "2025-26",
    po_results: [
      { po_code: "PO1", achieved_attainment: 3.0 },
      { po_code: "PO2", achieved_attainment: 2.85 },
    ],
  };

  // 1. Test 60/40 In-Memory Generation
  const students60 = [
    { roll_no: "8001", student_name: "Alice Memory", marks: { mt1_co1: 9, mt2_co4: 8, ese_co1: 7, ta: 9 } },
    { roll_no: "8002", student_name: "Bob Memory", marks: { mt1_co1: 8, mt2_co4: 7, ese_co1: 6, ta: 8 } },
  ];

  const res60 = await generateExcelReport("60_40", courseData, students60);
  assert.strictEqual(res60.success, true, "60/40 generation should succeed");
  assert.ok(Buffer.isBuffer(res60.buffer), "Result should contain Buffer");
  assert.ok(res60.buffer.length > 20000, "Buffer should be valid .xlsx size");
  assert.strictEqual(res60.buffer[0], 0x50, "Magic byte 0 should be 'P'");
  assert.strictEqual(res60.buffer[1], 0x4b, "Magic byte 1 should be 'K'");
  assert.ok(res60.sha256 && res60.sha256.length === 64, "SHA-256 checksum should be 64 hex characters");
  console.log("[PASS] 1. 60/40 In-Memory Generation succeeded without exports directory");

  // 2. Test 30/20 In-Memory Generation
  const students30 = [
    { roll_no: "3001", student_name: "Charlie Memory", marks: { mt1_co1: 5, mt2_co3: 4, ese_co1: 8, ta: 9 } },
  ];

  const res30 = await generateExcelReport("30_20", courseData, students30);
  assert.strictEqual(res30.success, true, "30/20 generation should succeed");
  assert.ok(res30.buffer.length > 20000, "30/20 buffer should be valid size");
  assert.strictEqual(res30.buffer[0], 0x50);
  assert.strictEqual(res30.buffer[1], 0x4b);
  assert.ok(res30.repaired_formulas && res30.repaired_formulas.length > 0, "30/20 repairs should be logged");
  console.log("[PASS] 2. 30/20 In-Memory Generation succeeded with repairs preserved");

  // 3. Test Capacity Limit on 30/20 (Max 65 students)
  let cap30Caught = false;
  try {
    const over30 = Array.from({ length: 66 }, (_, i) => ({
      roll_no: String(3000 + i),
      student_name: `Student ${i}`,
      marks: {},
    }));
    await generateExcelReport("30_20", courseData, over30);
  } catch (err: any) {
    cap30Caught = err.message.includes("exceeds master 30/20 template capacity of 65");
  }
  assert.strictEqual(cap30Caught, true, "Should enforce 30/20 capacity limit of 65");
  console.log("[PASS] 3. 30/20 Cohort capacity limit (65) properly enforced");

  // 4. Test Capacity Limit on 60/40 (Max 81 students)
  let cap60Caught = false;
  try {
    const over60 = Array.from({ length: 82 }, (_, i) => ({
      roll_no: String(8000 + i),
      student_name: `Student ${i}`,
      marks: {},
    }));
    await generateExcelReport("60_40", courseData, over60);
  } catch (err: any) {
    cap60Caught = err.message.includes("exceeds master 60/40 template capacity of 81");
  }
  assert.strictEqual(cap60Caught, true, "Should enforce 60/40 capacity limit of 81");
  console.log("[PASS] 4. 60/40 Cohort capacity limit (81) properly enforced");

  // 5. Test Empty Cohort Error
  let emptyCaught = false;
  try {
    await generateExcelReport("60_40", courseData, []);
  } catch (err: any) {
    emptyCaught = err.message.includes("No student records provided");
  }
  assert.strictEqual(emptyCaught, true, "Should reject empty student list");
  console.log("[PASS] 5. Empty student cohort rejected cleanly without mock data fallback");

  console.log("\nALL IN-MEMORY VERCEL EXCEL GENERATION TESTS PASSED!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
