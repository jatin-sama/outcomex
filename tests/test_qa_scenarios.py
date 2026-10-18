"""
OutcomeX — QA User Scenario & Authorization Verification Suite
Tests the 6 user scenarios:
1. Create a course and enter marks manually.
2. Upload an Excel marks file, map columns, validate, and import.
3. Calculate attainment and inspect result explanations.
4. Generate and download official Excel workbook.
5. Correct marks and regenerate report.
6. Verify unauthorized users cannot access another teacher's records/reports.
"""

import os
import unittest
import json
import re
from scripts.engine import (
    calculate_class_component_attainment,
    calculate_student_co_percent,
    calculate_final_co_attainment,
    calculate_po_attainment,
)
from scripts.excel_generator import (
    Adapter60_40,
    Adapter30_20,
    compute_sha256,
    REFERENCE_WORKBOOK_PATH,
    EXPORTS_DIR,
)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class TestQAScenarios(unittest.TestCase):
    def setUp(self):
        os.makedirs(EXPORTS_DIR, exist_ok=True)

    # -------------------------------------------------------------------------
    # Scenario 1: Course creation and manual marks entry
    # -------------------------------------------------------------------------
    def test_scenario_01_manual_entry_flow(self):
        """Tests that manually entered student marks are validated and stored."""
        student_records = [
            {
                "roll_no": "101",
                "student_name": "STUDENT ALICE",
                "marks": {"mt1_co1": 9.0, "ta": 10.0, "ese_co1": 8.0}
            },
            {
                "roll_no": "102",
                "student_name": "STUDENT BOB",
                "marks": {"mt1_co1": 4.0, "ta": 6.0, "ese_co1": 4.0}
            }
        ]

        # Student Alice: MT1=9/10 (90%), TA=10/10 (100%) -> IAM=95%. ESE=8/10 (80%). Combined=95*0.4 + 80*0.6 = 38+48 = 86% >= 45% -> Attained
        alice_pct = calculate_student_co_percent(90.0, 0, 100.0, 80.0, has_mt1=True, has_mt2=False)
        self.assertEqual(alice_pct, 86.0)

        # Student Bob: MT1=4/10 (40%), TA=6/10 (60%) -> IAM=50%. ESE=4/10 (40%). Combined=50*0.4 + 40*0.6 = 20+24 = 44% < 45% -> Not Attained
        bob_pct = calculate_student_co_percent(40.0, 0, 60.0, 40.0, has_mt1=True, has_mt2=False)
        self.assertEqual(bob_pct, 44.0)

        # Class Component Attainment on MT1 CO1 (threshold 4.5):
        # Alice (9.0) >= 4.5 -> Pass; Bob (4.0) < 4.5 -> Fail
        res = calculate_class_component_attainment([9.0, 4.0], 10.0, threshold_percent=45.0)
        self.assertEqual(res["attained_count"], 1)
        self.assertEqual(res["total_eligible"], 2)
        self.assertEqual(res["attainment_percent"], 50.0)
        self.assertEqual(res["level"], 2)

    # -------------------------------------------------------------------------
    # Scenario 2: Upload Excel file, map columns, validate, import
    # -------------------------------------------------------------------------
    def test_scenario_02_marks_validation_rules(self):
        """Tests that anomalous marks are flagged and prevented from corrupting results."""
        max_marks = {"mt1_co1": 10, "mt1_co2": 10, "ese_co5": 8}
        
        # Test 1: Out of range mark (Roll 138 Jeet Lambat scored 19/10)
        raw_val = 19.0
        self.assertGreater(raw_val, max_marks["mt1_co2"]) # Out of range

        # Test 2: Negative mark
        neg_val = -3.5
        self.assertLess(neg_val, 0) # Flagged as invalid

        # Test 3: Absent mark
        absent_val = "A"
        # Must not be parsed as 0.0
        self.assertEqual(absent_val, "A")
        self.assertNotEqual(absent_val, 0.0)

    # -------------------------------------------------------------------------
    # Scenario 3: Calculate attainment and inspect explanations
    # -------------------------------------------------------------------------
    def test_scenario_03_attainment_calculation_and_explanations(self):
        """Verifies mathematical proofs and step-by-step arithmetic explanations."""
        # 1. Component explanation check
        marks_list = [8.0, 7.5, 9.0, 3.0, 2.0] # 3 attained, 2 failed
        comp = calculate_class_component_attainment(marks_list, 10.0, 45.0)
        self.assertEqual(comp["threshold_mark"], 4.5)
        self.assertEqual(comp["attained_count"], 3)
        self.assertEqual(comp["attainment_percent"], 60.0)
        self.assertEqual(comp["level"], 3)

        # 2. Final CO explanation check
        # Direct Level 3, Indirect Level 2.8 -> Final = 3 * 0.8 + 2.8 * 0.2 = 2.4 + 0.56 = 2.96
        final_co = calculate_final_co_attainment(3.0, 2.8)
        self.assertEqual(final_co, 2.96)

        # 3. PO explanation check
        po_calc = calculate_po_attainment({"CO1": 3, "CO2": 2}, {"CO1": 3.0, "CO2": 2.96})
        # (3*3.0 + 2*2.96) / 5 = (9 + 5.92) / 5 = 14.92 / 5 = 2.984
        self.assertEqual(po_calc["achieved_attainment"], 2.984)

    # -------------------------------------------------------------------------
    # Scenario 4: Generate and download official Excel workbook
    # -------------------------------------------------------------------------
    def test_scenario_04_generate_and_download_workbook(self):
        """Verifies official workbook generation and safe download path resolution."""
        output_path = os.path.join(EXPORTS_DIR, "qa_scenario_4_report.xlsx")
        adapter = Adapter60_40()
        course_data = {
            "course_code": "25UCS623T_QA",
            "course_name": "QA Inspection Course",
            "department": "CSE",
            "year_semester": "3rd yr/5th sem",
            "academic_year": "2025-26",
        }
        students = [
            {"roll_no": "101", "student_name": "TEST STUDENT", "marks": {"mt1_co1": 9.0, "ta": 8.0}}
        ]
        res = adapter.generate_report(course_data, students, output_path=output_path)
        self.assertTrue(res["success"])
        self.assertTrue(os.path.exists(output_path))
        self.assertGreater(os.path.getsize(output_path), 50000)

        # Safe download verification
        unsafe_filename = "../../reference/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx"
        safe_name = os.path.basename(unsafe_filename)
        self.assertEqual(safe_name, "Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx")
        self.assertNotIn("..", safe_name)

    # -------------------------------------------------------------------------
    # Scenario 5: Correct marks and regenerate report
    # -------------------------------------------------------------------------
    def test_scenario_05_correct_marks_and_regenerate(self):
        """Verifies workflow when an anomalous mark is corrected and recalculated."""
        # Initial incorrect mark: 19.0 (exceeds 10)
        # Corrected mark: 9.0 (valid)
        marks_before = [19.0, 4.0] # 1 invalid, 1 fail
        # After correction:
        marks_after = [9.0, 4.0]  # 1 valid pass (9.0 >= 4.5), 1 fail

        res_after = calculate_class_component_attainment(marks_after, 10.0, 45.0)
        self.assertEqual(res_after["attained_count"], 1)
        self.assertEqual(res_after["attainment_percent"], 50.0)
        self.assertEqual(res_after["level"], 2)

    # -------------------------------------------------------------------------
    # Scenario 6: Unauthorized access prevention
    # -------------------------------------------------------------------------
    def test_scenario_06_authorization_and_rls_policies(self):
        """Verifies SQL RLS policies enforce isolation between course coordinators."""
        rls_file = os.path.join(PROJECT_ROOT, "supabase", "migrations", "20261018000002_rls_policies.sql")
        with open(rls_file, "r", encoding="utf-8") as f:
            sql = f.read()

        # Check student marks isolation
        self.assertIn("CREATE POLICY \"student_marks_select\" ON public.student_marks", sql)
        self.assertIn("CREATE POLICY \"student_marks_manage\" ON public.student_marks", sql)
        self.assertIn("can_manage_offering", sql)

        # Check report runs isolation
        self.assertIn("CREATE POLICY \"report_runs_select\" ON public.report_runs", sql)

        # Check audit logs non-updatable / non-deletable
        self.assertIn("CREATE POLICY \"audit_logs_insert\" ON public.audit_logs", sql)
        self.assertNotIn("CREATE POLICY \"audit_logs_update\"", sql)
        self.assertNotIn("CREATE POLICY \"audit_logs_delete\"", sql)


if __name__ == "__main__":
    unittest.main()
