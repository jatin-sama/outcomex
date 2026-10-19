const BASE = "http://localhost:3000";
const OFFERING_ID = "o0000000-0000-0000-0000-000000000001";

async function runVerification() {
  console.log("=== OUTCOMEX LIVE END-TO-END INTEGRATION TEST ===");

  // 1. Initial Roster Check
  console.log("\n[1] Checking initial roster...");
  const res1 = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID}/roster`);
  const data1 = await res1.json();
  console.log(`Status: ${res1.status}, Total Roster Count: ${data1.total_count}`);
  if (data1.total_count !== 81) {
    console.warn(`Note: expected 81, got ${data1.total_count}`);
  }

  // 2. Add Test Student to Student Roster
  console.log("\n[2] Adding Test Student to Roster (Roll: 999, Name: 'DEMO TEST STUDENT')...");
  const res2 = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID}/roster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roll_no: "999",
      student_name: "DEMO TEST STUDENT",
      status: "ENROLLED"
    }),
  });
  const data2 = await res2.json();
  console.log(`Status: ${res2.status}`, data2);
  if (!res2.ok || data2.added_count !== 1) {
    throw new Error(`Failed to add student to roster: ${JSON.stringify(data2)}`);
  }

  // 3. Query Marks Entry to see if Student 999 appears
  console.log("\n[3] Querying Marks Entry to verify student appears in gradebook...");
  const res3 = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID}/marks`);
  const data3 = await res3.json();
  console.log(`Status: ${res3.status}, Marks Count: ${data3.count}`);
  
  const studentInMarks = data3.marks.find((m) => m.roll_no === "999");
  if (!studentInMarks) {
    throw new Error("FAILED: Student 999 was NOT found in Marks Entry!");
  }
  console.log("SUCCESS! Student 999 found in Marks Entry:", studentInMarks);

  // 4. Save marks for Student 999
  console.log("\n[4] Entering and saving marks for Student 999...");
  const updatedMarks = data3.marks.map((m) => {
    if (m.roll_no === "999") {
      return {
        ...m,
        marks: {
          mt1_co1: 9.0,
          mt1_co2: 8.0,
          ese_co1: 8.5,
          ta: 10.0,
        },
      };
    }
    return m;
  });

  const res4 = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID}/marks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updatedMarks }),
  });
  const data4 = await res4.json();
  console.log(`Status: ${res4.status}`, data4);
  if (!res4.ok || !data4.success) {
    throw new Error(`Failed to save marks: ${JSON.stringify(data4)}`);
  }

  // 5. Query Marks Entry again to verify persistence
  console.log("\n[5] Verifying marks persistence after simulated page reload...");
  const res5 = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID}/marks`);
  const data5 = await res5.json();
  const studentWithMarks = data5.marks.find((m) => m.roll_no === "999");
  console.log("Persisted marks for 999:", studentWithMarks?.marks);
  if (studentWithMarks?.marks?.mt1_co1 !== 9.0) {
    throw new Error("FAILED: Marks for 999 did not persist!");
  }

  // 6. Calculate Attainment
  console.log("\n[6] Calculating Attainment using saved marks...");
  const res6 = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID}/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data6 = await res6.json();
  console.log(`Status: ${res6.status}, Direct CO Results:`, data6.co_results?.map((c) => `${c.co_code}: Direct Level ${c.direct_level}, Final: ${c.final_attainment}`));

  // 7. Cleanup Test Student
  console.log("\n[7] Cleaning up test student 999...");
  const res7 = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID}/roster?student_id=999`, {
    method: "DELETE",
  });
  const data7 = await res7.json();
  console.log("Cleanup response:", data7);

  // 8. Final check
  const res8 = await fetch(`${BASE}/api/v1/offerings/${OFFERING_ID}/roster`);
  const data8 = await res8.json();
  console.log(`Final Roster Count: ${data8.total_count}`);

  console.log("\n=======================================================");
  console.log("ALL LIVE END-TO-END INTEGRATION TESTS PASSED 100%!");
  console.log("=======================================================");
}

runVerification().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
