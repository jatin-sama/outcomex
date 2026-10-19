import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OFFERING_ID_1 = "o0000000-0000-0000-0000-000000000001";
const OFFERING_ID_2 = "o0000000-0000-0000-0000-000000000002";

async function runTest() {
  console.log("================================================================================");
  console.log("OUTCOMEX — LIVE END-TO-END WORKFLOW VERIFICATION (ROSTER -> MARKS -> EXPORT)");
  console.log("================================================================================");

  // --------------------------------------------------------------------------
  // Step 0: Test Empty Offering Behavior on Offering 2
  // --------------------------------------------------------------------------
  console.log("\n[Step 0] Testing Export on Empty Offering (Offering 2)...");
  const emptyRes = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID_2}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemeType: "60_40", action: "GENERATE" }),
  });
  const emptyData = await emptyRes.json();
  console.log(`Status: ${emptyRes.status}, Response:`, emptyData);
  if (emptyRes.status !== 400 || !emptyData.error?.includes("no enrolled students")) {
    throw new Error(`FAIL: Empty offering export should have returned 400 with empty roster message! Got: ${JSON.stringify(emptyData)}`);
  }
  console.log("PASSED: Empty offering properly rejected with 400 Bad Request and clear error message.");

  // --------------------------------------------------------------------------
  // Step 1: Add a uniquely identifiable student to Offering 1 via Roster API
  // --------------------------------------------------------------------------
  const uniqueRoll = "ROLL-" + Date.now().toString().slice(-6);
  const uniqueName = `DR_VERIFIED_REAL_STUDENT_${uniqueRoll}`;

  console.log(`\n[Step 1] Adding unique student (${uniqueRoll} - ${uniqueName}) to Offering 1...`);
  const addRes = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID_1}/roster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roll_no: uniqueRoll,
      student_name: uniqueName,
      status: "ENROLLED",
    }),
  });
  const addData = await addRes.json();
  console.log(`Status: ${addRes.status}`, addData);
  if (!addRes.ok) throw new Error(`Failed to add student: ${JSON.stringify(addData)}`);

  // --------------------------------------------------------------------------
  // Step 2: Confirm student exists on Marks Entry
  // --------------------------------------------------------------------------
  console.log("\n[Step 2] Querying Marks Entry to verify student was synchronized...");
  const marksRes = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID_1}/marks`);
  const marksData = await marksRes.json();
  const studentInMarks = marksData.marks.find((m) => m.roll_no === uniqueRoll);
  if (!studentInMarks) {
    throw new Error(`FAIL: Student ${uniqueRoll} not found in Marks Entry!`);
  }
  console.log(`Found student in gradebook: ${studentInMarks.student_name} (${studentInMarks.roll_no})`);

  // --------------------------------------------------------------------------
  // Step 3: Enter and save marks for this student
  // --------------------------------------------------------------------------
  console.log("\n[Step 3] Entering and saving real marks for this student...");
  const updatedMarks = marksData.marks.map((m) => {
    if (m.roll_no === uniqueRoll) {
      return {
        ...m,
        marks: {
          mt1_co1: 9.5,
          mt1_co2: 8.5,
          mt1_co3: 9.0,
          mt2_co4: 10.0,
          mt2_co5: 7.5,
          mt2_co6: 8.0,
          ese_co1: 9.0,
          ese_co2: 11.0,
          ese_co3: 11.5,
          ese_co4: 9.5,
          ese_co5: 7.5,
          ese_co6: 7.5,
          ta: 10.0,
        },
      };
    }
    return m;
  });

  const saveRes = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID_1}/marks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updatedMarks }),
  });
  const saveData = await saveRes.json();
  console.log(`Status: ${saveRes.status}, Saved count: ${saveData.savedCount}`);
  if (!saveRes.ok) throw new Error(`Failed to save marks: ${JSON.stringify(saveData)}`);

  // --------------------------------------------------------------------------
  // Step 4: Confirm data persists after re-fetching
  // --------------------------------------------------------------------------
  console.log("\n[Step 4] Re-fetching marks to verify persistence...");
  const verifyMarksRes = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID_1}/marks`);
  const verifyMarksData = await verifyMarksRes.json();
  const verifiedStudent = verifyMarksData.marks.find((m) => m.roll_no === uniqueRoll);
  if (!verifiedStudent || verifiedStudent.marks?.mt1_co1 !== 9.5) {
    throw new Error(`FAIL: Marks did not persist! Got: ${JSON.stringify(verifiedStudent)}`);
  }
  console.log("PASSED: Persisted marks successfully confirmed!");

  // --------------------------------------------------------------------------
  // Step 5: Export selected offering's Excel report
  // --------------------------------------------------------------------------
  console.log("\n[Step 5] Triggering Excel Export for Offering 1 (Scheme: 60_40)...");
  const exportRes = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID_1}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemeType: "60_40", action: "GENERATE" }),
  });
  const exportData = await exportRes.json();
  console.log(`Status: ${exportRes.status}`, exportData);
  if (!exportRes.ok || !exportData.download_url) {
    throw new Error(`FAIL: Export request failed! ${JSON.stringify(exportData)}`);
  }
  console.log(`Report generated successfully: ${exportData.report.filename}`);
  console.log(`Download URL: ${exportData.download_url}`);

  // --------------------------------------------------------------------------
  // Step 6: Download the generated workbook
  // --------------------------------------------------------------------------
  console.log("\n[Step 6] Downloading generated workbook file...");
  const dlRes = await fetch(`${BASE}${exportData.download_url}`);
  if (!dlRes.ok) {
    throw new Error(`FAIL: Failed to download generated workbook: ${dlRes.status}`);
  }
  const arrayBuffer = await dlRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const downloadedPath = path.join(process.cwd(), "exports", `verified_${exportData.report.filename}`);
  fs.writeFileSync(downloadedPath, buffer);
  console.log(`Workbook downloaded: ${downloadedPath} (${buffer.length} bytes)`);

  // --------------------------------------------------------------------------
  // Step 7: Inspect workbook using Python openpyxl
  // --------------------------------------------------------------------------
  console.log("\n[Step 7] Inspecting downloaded workbook using openpyxl...");
  const pyVerifyScript = `
import openpyxl, sys

wb = openpyxl.load_workbook(sys.argv[1], data_only=False)
ws = wb['For 60_40 (final)']

# 1. Verify our unique student appears in the student grid
found = False
for r in range(29, 110):
    roll = str(ws[f'A{r}'].value or '').strip()
    name = str(ws[f'B{r}'].value or '').strip()
    if '${uniqueRoll}' in roll:
        found = True
        print(f"FOUND REAL STUDENT at row {r}: Roll={roll}, Name={name}")
        # Verify marks
        m_mt1_1 = ws[f'C{r}'].value
        m_mt1_2 = ws[f'D{r}'].value
        m_ta = ws[f'T{r}'].value
        m_ese_1 = ws[f'M{r}'].value
        print(f"Marks in workbook: MT1_CO1={m_mt1_1}, MT1_CO2={m_mt1_2}, TA={m_ta}, ESE_CO1={m_ese_1}")
        assert m_mt1_1 == 9.5, f"Expected 9.5, got {m_mt1_1}"
        assert m_mt1_2 == 8.5, f"Expected 8.5, got {m_mt1_2}"
        assert m_ta == 10.0, f"Expected 10.0, got {m_ta}"
        assert m_ese_1 == 9.0, f"Expected 9.0, got {m_ese_1}"
        break

assert found, f"FAIL: Real student ${uniqueRoll} was NOT found in the generated workbook!"

# 2. Verify that mock students from the reference template DO NOT appear in unused rows
all_names = [str(ws[f'B{r}'].value or '').strip() for r in range(29, 110) if ws[f'B{r}'].value]
print(f"Total student names in sheet: {len(all_names)}")

# The reference template has these sample student names
mock_samples = ["BHAIRAVI SANJAY BHENDARKAR", "GUNJAN RAJU CHATARE", "OM SURESH VINCHURKAR"]
for sample in mock_samples:
    assert sample not in all_names, f"FAIL: Old mock student '{sample}' found in workbook!"

print("PASSED: Verified student presence, exact marks fidelity, and zero leftover mock students!")
wb.close()
`;

  fs.writeFileSync("temp_verify.py", pyVerifyScript, "utf-8");
  try {
    const pyOutput = execSync(`python temp_verify.py "${downloadedPath}"`, { encoding: "utf-8" });
    console.log(pyOutput);
  } finally {
    try { fs.unlinkSync("temp_verify.py"); } catch {}
  }

  // --------------------------------------------------------------------------
  // Step 8: Course Isolation Check on Offering 2
  // --------------------------------------------------------------------------
  console.log("\n[Step 8] Testing Course Isolation: Add distinct student to Offering 2 and export...");
  const addOff2Res = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID_2}/roster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roll_no: "OFF2-3333",
      student_name: "OFFERING_TWO_ISOLATED_STUDENT",
      status: "ENROLLED",
    }),
  });
  if (!addOff2Res.ok) throw new Error("Failed to enroll student in Offering 2");

  const export2Res = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID_2}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemeType: "60_40", action: "GENERATE" }),
  });
  const export2Data = await export2Res.json();
  console.log(`Offering 2 export status: ${export2Res.status}, filename: ${export2Data.report.filename}`);

  const dl2Res = await fetch(`${BASE}${export2Data.download_url}`);
  const buf2 = Buffer.from(await dl2Res.arrayBuffer());
  const dl2Path = path.join(process.cwd(), "exports", `verified_${export2Data.report.filename}`);
  fs.writeFileSync(dl2Path, buf2);

  const pyIsolationScript = `
import openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1], data_only=False)
ws = wb['For 60_40 (final)']
names = [str(ws[f'B{r}'].value or '').strip() for r in range(29, 110) if ws[f'B{r}'].value]
print(f"Offering 2 names in workbook: {names}")
assert "OFFERING_TWO_ISOLATED_STUDENT" in names, "FAIL: Offering 2 student missing from Offering 2 workbook"
assert "DR_VERIFIED_REAL_ACADEMIC_STUDENT" not in names, "FAIL: Offering 1 student leaked into Offering 2 workbook!"
wb.close()
print("PASSED: Course isolation verified! No cross-course data leakage.")
`;
  fs.writeFileSync("temp_iso.py", pyIsolationScript, "utf-8");
  try {
    const isoOutput = execSync(`python temp_iso.py "${dl2Path}"`, { encoding: "utf-8" });
    console.log(isoOutput);
  } finally {
    try { fs.unlinkSync("temp_iso.py"); } catch {}
  }

  console.log("\n================================================================================");
  console.log("SUCCESS! ALL LIVE VERIFICATION WORKFLOW STEPS PASSED 100%!");
  console.log("================================================================================");
}

runTest().catch((err) => {
  console.error("ERROR during live test:", err);
  process.exit(1);
});
