/**
 * OutcomeX — QA Independent Verification Engine Test Suite
 * Tests AttainmentEngine using independently computed expected results.
 */

import assert from "node:assert";
import { AttainmentEngine } from "../src/lib/engine/attainmentEngine.ts";

console.log("=== STARTING INDEPENDENT ENGINE AUDIT ===");

let passedCount = 0;
let failedCount = 0;
const testResults = [];

function test(name, fn) {
  try {
    fn();
    passedCount++;
    testResults.push({ name, status: "PASS" });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failedCount++;
    testResults.push({ name, status: "FAIL", error: err.message, stack: err.stack });
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

// ----------------------------------------------------------------------------
// 1. Boundary & Rubric Levels (Independent Calculation)
// ----------------------------------------------------------------------------
test("1.1 Rubric Levels: Level 3 boundary (>= 55.0%)", () => {
  const engine = new AttainmentEngine();
  // Independently calculated: 55.0 -> 3, 55.001 -> 3, 100 -> 3
  assert.strictEqual(engine.evaluateAttainmentLevel(55.0), 3);
  assert.strictEqual(engine.evaluateAttainmentLevel(55.001), 3);
  assert.strictEqual(engine.evaluateAttainmentLevel(100.0), 3);
});

test("1.2 Rubric Levels: Level 2 boundary (>= 45.0% and < 55.0%)", () => {
  const engine = new AttainmentEngine();
  // Independently calculated: 54.99 -> 2, 45.0 -> 2, 50.0 -> 2
  assert.strictEqual(engine.evaluateAttainmentLevel(54.99), 2);
  assert.strictEqual(engine.evaluateAttainmentLevel(54.999), 2);
  assert.strictEqual(engine.evaluateAttainmentLevel(45.0), 2);
  assert.strictEqual(engine.evaluateAttainmentLevel(50.0), 2);
});

test("1.3 Rubric Levels: Level 1 boundary (< 45.0%)", () => {
  const engine = new AttainmentEngine();
  // Independently calculated: 44.99 -> 1, 0 -> 1, -5 -> 1, NaN -> 1
  assert.strictEqual(engine.evaluateAttainmentLevel(44.99), 1);
  assert.strictEqual(engine.evaluateAttainmentLevel(44.999), 1);
  assert.strictEqual(engine.evaluateAttainmentLevel(0.0), 1);
  assert.strictEqual(engine.evaluateAttainmentLevel(-10.0), 1);
  assert.strictEqual(engine.evaluateAttainmentLevel(NaN), 1);
});

// ----------------------------------------------------------------------------
// 2. Component Threshold Attainment (Student 45% Threshold)
// ----------------------------------------------------------------------------
test("2.1 Student qualification threshold: exactly 45% mark", () => {
  const engine = new AttainmentEngine();
  // Max mark = 10, threshold = 45% -> 4.5 marks
  // Student A: 4.5 -> attained
  // Student B: 4.49 -> not attained
  const students = [
    { student_id: "s1", roll_no: "101", student_name: "A", marks: { q1: 4.5 } },
    { student_id: "s2", roll_no: "102", student_name: "B", marks: { q1: 4.49 } },
  ];
  const components = [
    { key: "q1", label: "Q1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" }
  ];

  const res = engine.calculate(students, components, ["CO1"], [], {});
  const compRes = res.component_results[0];

  assert.strictEqual(compRes.threshold_mark, 4.5);
  assert.strictEqual(compRes.attained_count, 1);
  assert.strictEqual(compRes.total_eligible, 2);
  assert.strictEqual(compRes.attainment_percent, 50.0);
  assert.strictEqual(compRes.attainment_level, 2); // 50% is Level 2
});

test("2.2 Component attainment on 12-mark question (45% of 12 = 5.4)", () => {
  const engine = new AttainmentEngine();
  // 45% of 12 = 5.4
  // Students: 6.0 (pass), 5.4 (pass), 5.3 (fail), 0 (fail)
  // Total = 4, attained = 2 -> 50% -> Level 2
  const students = [
    { student_id: "s1", roll_no: "101", student_name: "A", marks: { q1: 6.0 } },
    { student_id: "s2", roll_no: "102", student_name: "B", marks: { q1: 5.4 } },
    { student_id: "s3", roll_no: "103", student_name: "C", marks: { q1: 5.3 } },
    { student_id: "s4", roll_no: "104", student_name: "D", marks: { q1: 0 } },
  ];
  const components = [
    { key: "q1", label: "ESE CO2", category: "END_SEM", max_marks: 12, co_code: "CO2" }
  ];

  const res = engine.calculate(students, components, ["CO2"], [], {});
  const comp = res.component_results[0];

  assert.strictEqual(comp.threshold_mark, 5.4);
  assert.strictEqual(comp.attained_count, 2);
  assert.strictEqual(comp.attainment_percent, 50.0);
  assert.strictEqual(comp.attainment_level, 2);
});

// ----------------------------------------------------------------------------
// 3. Weighting Formulas: 40% IAM + 60% ESE
// ----------------------------------------------------------------------------
test("3.1 Weighting formula: Student combined CO percentage", () => {
  const engine = new AttainmentEngine();
  // Student 1:
  // MT1 CO1 (out of 10) = 8.0 -> 80%
  // TA (out of 10) = 10.0 -> 100%
  // Internal IAM = (80 + 100) / 2 = 90%
  // ESE CO1 (out of 10) = 9.0 -> 90%
  // Combined = 90% * 0.40 + 90% * 0.60 = 36% + 54% = 90.0%
  const students = [
    {
      student_id: "s1",
      roll_no: "102",
      student_name: "Student 1",
      marks: { mt1_co1: 8.0, ta: 10.0, ese_co1: 9.0 }
    }
  ];
  const components = [
    { key: "mt1_co1", label: "MT1 CO1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" },
    { key: "ta", label: "TA", category: "TEACHER_ASSESSMENT", max_marks: 10 },
    { key: "ese_co1", label: "ESE CO1", category: "END_SEM", max_marks: 10, co_code: "CO1" },
  ];

  const res = engine.calculate(students, components, ["CO1"], [], {});
  const studentCO = res.student_results[0].co_percentages["CO1"];

  // Independently calculated: 90.00
  assert.strictEqual(studentCO, 90.0);
});

// ----------------------------------------------------------------------------
// 4. Weighting Formulas: 80% Direct + 20% Indirect
// ----------------------------------------------------------------------------
test("4.1 Direct and Indirect CO weighting", () => {
  const engine = new AttainmentEngine();
  // 10 students: 6 score >= 45% -> 60% attainment -> Direct Level 3
  // Indirect attainment survey = 2.5
  // Final CO = 3 * 0.8 + 2.5 * 0.2 = 2.4 + 0.5 = 2.90
  const students = Array.from({ length: 10 }, (_, i) => ({
    student_id: `s${i}`,
    roll_no: `${100 + i}`,
    student_name: `Student ${i}`,
    marks: {
      mt1_co1: i < 6 ? 8.0 : 2.0, // 6 pass, 4 fail
      ta: 8.0,
      ese_co1: i < 6 ? 8.0 : 2.0,
    }
  }));

  const components = [
    { key: "mt1_co1", label: "MT1 CO1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" },
    { key: "ta", label: "TA", category: "TEACHER_ASSESSMENT", max_marks: 10 },
    { key: "ese_co1", label: "ESE CO1", category: "END_SEM", max_marks: 10, co_code: "CO1" },
  ];

  const res = engine.calculate(students, components, ["CO1"], [], {}, { CO1: 2.5 });
  const coRes = res.co_results[0];

  assert.strictEqual(coRes.direct_level, 3);
  assert.strictEqual(coRes.indirect_level, 2.5);
  // Independently calculated: 3 * 0.8 + 2.5 * 0.2 = 2.90
  assert.strictEqual(coRes.final_attainment, 2.9);
});

// ----------------------------------------------------------------------------
// 5. PO/PSO Mapping Aggregation
// ----------------------------------------------------------------------------
test("5.1 PO Aggregation: Weighted Average method", () => {
  // PO1 mapped to CO1 (strength 3) and CO2 (strength 2)
  // Final CO1 = 3.0, Final CO2 = 2.0
  // Independently calculated: (3*3.0 + 2*2.0) / (3 + 2) = (9 + 4) / 5 = 13 / 5 = 2.60
  const engine = new AttainmentEngine({ po_aggregation_method: "WEIGHTED_AVERAGE" });
  const students = [
    { student_id: "s1", roll_no: "101", student_name: "A", marks: { c1: 8, c2: 1, ese1: 8, ese2: 1, ta: 1 } }
  ];
  // For CO1: MT1=80%, TA=10% -> IAM=(80+10)/2=45%. ESE=80%. Combined=45*0.4 + 80*0.6 = 18+48 = 66% >= 45% -> Attained (100% -> Level 3)
  // For CO2: MT1=10%, TA=10% -> IAM=10%. ESE=10%. Combined=10% < 45% -> Not Attained (0% -> Level 1)
  // Final CO1 = 3 * 0.8 + 3 * 0.2 = 3.0
  // Final CO2 = 1 * 0.8 + 3 * 0.2 = 1.4
  // PO1 = (3 * 3.0 + 2 * 1.40) / 5 = 11.8 / 5 = 2.36
  const components = [
    { key: "c1", label: "C1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" },
    { key: "c2", label: "C2", category: "MID_TERM_1", max_marks: 10, co_code: "CO2" },
    { key: "ese1", label: "E1", category: "END_SEM", max_marks: 10, co_code: "CO1" },
    { key: "ese2", label: "E2", category: "END_SEM", max_marks: 10, co_code: "CO2" },
    { key: "ta", label: "TA", category: "TEACHER_ASSESSMENT", max_marks: 10 },
  ];
  const mappings = {
    CO1: { PO1: 3 },
    CO2: { PO1: 2 }
  };
  const poList = [{ po_code: "PO1", po_type: "PO" }];

  // Student 1 has CO1=80% (pass -> level 3), CO2=40% (fail -> level 1)
  // Direct CO1 = 3, Direct CO2 = 1
  // Final CO1 = 3 * 0.8 + 3 * 0.2 = 3.0
  // Final CO2 = 1 * 0.8 + 3 * 0.2 = 0.8 + 0.6 = 1.40
  // PO1 = (3 * 3.0 + 2 * 1.40) / 5 = (9 + 2.8) / 5 = 11.8 / 5 = 2.36
  const res = engine.calculate(students, components, ["CO1", "CO2"], poList, mappings);
  const poRes = res.po_results[0];

  assert.strictEqual(poRes.achieved_attainment, 2.36);
  assert.strictEqual(poRes.is_mapped, true);
});

test("5.2 PO Aggregation: Mapping Average method (Reference sheet 60/40 behavior)", () => {
  // PO1 mapped to CO1 (strength 3) and CO2 (strength 2)
  // Mapping average = (3 + 2) / 2 = 2.50
  const engine = new AttainmentEngine({ po_aggregation_method: "MAPPING_AVERAGE" });
  const students = [
    { student_id: "s1", roll_no: "101", student_name: "A", marks: { c1: 8, ese1: 8, ta: 8 } }
  ];
  const components = [
    { key: "c1", label: "C1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" },
    { key: "ese1", label: "E1", category: "END_SEM", max_marks: 10, co_code: "CO1" },
    { key: "ta", label: "TA", category: "TEACHER_ASSESSMENT", max_marks: 10 },
  ];
  const mappings = {
    CO1: { PO1: 3, PO2: 2 },
  };
  const poList = [
    { po_code: "PO1", po_type: "PO" },
    { po_code: "PO_UNMAPPED", po_type: "PO" }
  ];

  const res = engine.calculate(students, components, ["CO1"], poList, mappings);
  assert.strictEqual(res.po_results[0].achieved_attainment, 3.0); // Single mapped CO with strength 3 -> 3.0
  assert.strictEqual(res.po_results[1].achieved_attainment, null); // Unmapped -> null
  assert.strictEqual(res.po_results[1].is_mapped, false);
});

// ----------------------------------------------------------------------------
// 6. Missing Marks, Absences, Exemptions, and Zero Eligible
// ----------------------------------------------------------------------------
test("6.1 Handling absent strings ('A', 'ABSENT', null, undefined)", () => {
  const engine = new AttainmentEngine();
  const students = [
    { student_id: "s1", roll_no: "101", student_name: "Present", marks: { q1: 8.0 } },
    { student_id: "s2", roll_no: "102", student_name: "Absent", marks: { q1: "A" } },
    { student_id: "s3", roll_no: "103", student_name: "Null", marks: { q1: null } },
    { student_id: "s4", roll_no: "104", student_name: "Undefined", marks: {} },
  ];
  const components = [
    { key: "q1", label: "Q1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" }
  ];

  const res = engine.calculate(students, components, ["CO1"], [], {});
  const comp = res.component_results[0];

  // Only student 1 scores >= 4.5
  assert.strictEqual(comp.attained_count, 1);
  assert.strictEqual(comp.total_eligible, 4);
  assert.strictEqual(comp.attainment_percent, 25.0);
  assert.strictEqual(comp.attainment_level, 1);
});

test("6.2 Zero eligible students handling (empty student list)", () => {
  const engine = new AttainmentEngine();
  const components = [
    { key: "q1", label: "Q1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" }
  ];

  // Must not throw or crash on divide-by-zero
  try {
    const res = engine.calculate([], components, ["CO1"], [], {});
    assert.strictEqual(res.total_students_enrolled, 0);
    assert.strictEqual(res.component_results[0].attainment_percent, 0.0);
    assert.strictEqual(res.component_results[0].attainment_level, 1);
  } catch (err) {
    assert.fail(`Threw error on zero students: ${err.message}`);
  }
});

// ----------------------------------------------------------------------------
// 7. Edge Cases: Zero max marks and division-by-zero protections
// ----------------------------------------------------------------------------
test("7.1 Component with max_marks = 0 handling", () => {
  const engine = new AttainmentEngine();
  const students = [
    { student_id: "s1", roll_no: "101", student_name: "A", marks: { q0: 0 } }
  ];
  const components = [
    { key: "q0", label: "ZeroMax", category: "MID_TERM_1", max_marks: 0, co_code: "CO1" }
  ];

  // Should handle zero max marks without NaN or crash
  const res = engine.calculate(students, components, ["CO1"], [], {});
  assert.strictEqual(res.component_results[0].threshold_mark, 0);
});

test("7.2 Unmapped PO handling with empty mappings", () => {
  const engine = new AttainmentEngine();
  const students = [
    { student_id: "s1", roll_no: "101", student_name: "A", marks: { q1: 10 } }
  ];
  const components = [
    { key: "q1", label: "Q1", category: "MID_TERM_1", max_marks: 10, co_code: "CO1" }
  ];
  const poList = [{ po_code: "PO12", po_type: "PO" }];

  const res = engine.calculate(students, components, ["CO1"], poList, {});
  assert.strictEqual(res.po_results[0].is_mapped, false);
  assert.strictEqual(res.po_results[0].achieved_attainment, null);
  assert.strictEqual(res.po_results[0].mapped_cos_count, 0);
});

console.log("\n=== SUMMARY ===");
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);
if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("ALL INDEPENDENT QA ENGINE TESTS PASSED SUCCESSFULLY.");
}
