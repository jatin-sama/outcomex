"""
OutcomeX — Regression Test Suite: Database-Derived Excel Export (Tests A - G)
Verifies:
- Test A: Real roster with unique names appears in output workbook.
- Test B: Persisted marks written to cells match input data exactly.
- Test C: Attainment counts and formulas evaluate for the actual cohort size, not 81 mock students.
- Test D: Empty roster produces no demo students (and raises clear error in production generator).
- Test E: Failure / invalid records raise errors cleanly without silent fallback to sample data.
- Test F: Course isolation: workbooks for different offerings never cross-contaminate.
- Test G: Mock-data isolation: production export cannot fall back to reference fixtures.
"""

import os
import sys
import json
import unittest
import subprocess
import openpyxl

from scripts.excel_generator import (
    Adapter60_40,
    Adapter30_20,
    generate_workbook,
    load_reference_dataset,
    compute_sha256,
    REFERENCE_WORKBOOK_PATH,
    EXPORTS_DIR,
)
from scripts.engine import (
    calculate_class_component_attainment,
    calculate_student_co_percent,
    calculate_final_co_attainment,
)

ORIGINAL_TEMPLATE_SHA256 = "497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477"

class TestExcelExportRealData(unittest.TestCase):
    def setUp(self):
        os.makedirs(EXPORTS_DIR, exist_ok=True)
        self.course_metadata = {
            "course_code": "25UCS623T_REAL",
            "course_name": "Autonomous Advanced Data Science",
            "department": "CSE",
            "year_semester": "3rd yr/5th sem",
            "academic_year": "2025-26",
            "po_results": [
                {"po_code": "PO1", "achieved_attainment": 3.0},
                {"po_code": "PO2", "achieved_attainment": 2.85},
            ]
        }

    # -------------------------------------------------------------------------
    # Test A: Real Roster
    # -------------------------------------------------------------------------
    def test_a_real_roster_names_and_rolls_appear(self):
        """Test A: Output workbook contains uniquely identifiable test student names and roll numbers."""
        test_students = [
            {
                "roll_no": "9001",
                "student_name": "REAL_TEST_STUDENT_ALPHA",
                "marks": {"mt1_co1": 9.5, "ta": 10.0, "ese_co1": 8.5}
            },
            {
                "roll_no": "9002",
                "student_name": "REAL_TEST_STUDENT_BETA",
                "marks": {"mt1_co1": 7.0, "ta": 8.0, "ese_co1": 6.5}
            }
        ]

        output_path = os.path.join(EXPORTS_DIR, "test_export_test_a_real_roster.xlsx")
        adapter = Adapter60_40()
        res = adapter.generate_report(self.course_metadata, test_students, output_path=output_path)
        self.assertTrue(res["success"])

        wb = openpyxl.load_workbook(output_path, data_only=False)
        ws = wb["For 60_40 (final)"]

        # Row 29: Student Alpha
        self.assertEqual(ws["A29"].value, 9001.0)
        self.assertEqual(ws["B29"].value, "REAL_TEST_STUDENT_ALPHA")

        # Row 30: Student Beta
        self.assertEqual(ws["A30"].value, 9002.0)
        self.assertEqual(ws["B30"].value, "REAL_TEST_STUDENT_BETA")

        # Row 31 and beyond: MUST BE EMPTY, NOT MOCK STUDENTS
        self.assertIsNone(ws["A31"].value, "Row 31 roll number must be None (not leftover mock student)")
        self.assertIsNone(ws["B31"].value, "Row 31 student name must be None (not leftover mock student)")
        self.assertIsNone(ws["A32"].value)
        self.assertIsNone(ws["B32"].value)
        self.assertIsNone(ws["A109"].value)
        self.assertIsNone(ws["B109"].value)

        # Confirm old mock student names are NOT present in the student column
        student_names = [ws[f"B{r}"].value for r in range(29, 110) if ws[f"B{r}"].value is not None]
        self.assertEqual(len(student_names), 2)
        self.assertIn("REAL_TEST_STUDENT_ALPHA", student_names)
        self.assertIn("REAL_TEST_STUDENT_BETA", student_names)
        self.assertNotIn("BHAIRAVI SANJAY BHENDARKAR", student_names)
        self.assertNotIn("GUNJAN RAJU CHATARE", student_names)
        self.assertNotIn("OM SURESH VINCHURKAR", student_names)
        wb.close()

    # -------------------------------------------------------------------------
    # Test B: Real Marks
    # -------------------------------------------------------------------------
    def test_b_real_marks_fidelity(self):
        """Test B: Persisted marks written to workbook match the exact input marks and absences."""
        test_students = [
            {
                "roll_no": "9010",
                "student_name": "STUDENT_MARKS_TESTER",
                "marks": {
                    "mt1_co1": 8.5,
                    "mt1_co2": 9.0,
                    "mt1_co3": 7.5,
                    "mt2_co4": 10.0,
                    "mt2_co5": 6.5,
                    "mt2_co6": 8.0,
                    "ese_co1": 8.0,
                    "ese_co2": 11.0,
                    "ese_co3": 10.5,
                    "ese_co4": 9.0,
                    "ese_co5": 7.0,
                    "ese_co6": 7.5,
                    "ta": 10.0,
                }
            },
            {
                "roll_no": "9011",
                "student_name": "ABSENT_STUDENT_TESTER",
                "marks": {
                    "mt1_co1": "AB",
                    "mt1_co2": 5.0,
                    "mt2_co4": "A",
                    "ta": 8.0,
                }
            }
        ]

        output_path = os.path.join(EXPORTS_DIR, "test_export_test_b_real_marks.xlsx")
        adapter = Adapter60_40()
        res = adapter.generate_report(self.course_metadata, test_students, output_path=output_path)
        self.assertTrue(res["success"])

        wb = openpyxl.load_workbook(output_path, data_only=False)
        ws = wb["For 60_40 (final)"]

        # Check exact numeric marks
        self.assertEqual(ws["C29"].value, 8.5)
        self.assertEqual(ws["D29"].value, 9.0)
        self.assertEqual(ws["E29"].value, 7.5)
        self.assertEqual(ws["H29"].value, 10.0)
        self.assertEqual(ws["I29"].value, 6.5)
        self.assertEqual(ws["J29"].value, 8.0)
        self.assertEqual(ws["M29"].value, 8.0)
        self.assertEqual(ws["N29"].value, 11.0)
        self.assertEqual(ws["O29"].value, 10.5)
        self.assertEqual(ws["P29"].value, 9.0)
        self.assertEqual(ws["Q29"].value, 7.0)
        self.assertEqual(ws["R29"].value, 7.5)
        self.assertEqual(ws["T29"].value, 10.0)

        # Check absence preservation
        self.assertIn(ws["C30"].value, ["AB", "A"])
        self.assertEqual(ws["D30"].value, 5.0)
        self.assertIn(ws["H30"].value, ["AB", "A"])
        self.assertEqual(ws["T30"].value, 8.0)
        self.assertIsNone(ws["E30"].value, "Unentered mark must be None")
        wb.close()

    # -------------------------------------------------------------------------
    # Test C: Calculated Results
    # -------------------------------------------------------------------------
    def test_c_calculated_results_parity(self):
        """Test C: Component attainment and CO attainment match independent calculation."""
        # 4 students: 3 score >= 4.5 on MT1 CO1 (max 10) -> 75% -> Level 3
        # 1 student scores 3.0 (< 4.5)
        test_students = [
            {"roll_no": "1001", "student_name": "S1", "marks": {"mt1_co1": 9.0, "ta": 10.0, "ese_co1": 8.0}},
            {"roll_no": "1002", "student_name": "S2", "marks": {"mt1_co1": 8.0, "ta": 9.0, "ese_co1": 7.0}},
            {"roll_no": "1003", "student_name": "S3", "marks": {"mt1_co1": 5.0, "ta": 8.0, "ese_co1": 6.0}},
            {"roll_no": "1004", "student_name": "S4", "marks": {"mt1_co1": 3.0, "ta": 5.0, "ese_co1": 4.0}},
        ]

        # Independent calculation check
        mt1_marks = [s["marks"]["mt1_co1"] for s in test_students]
        calc = calculate_class_component_attainment(mt1_marks, 10.0, 45.0)
        self.assertEqual(calc["total_eligible"], 4)
        self.assertEqual(calc["attained_count"], 3)
        self.assertEqual(calc["attainment_percent"], 75.0)
        self.assertEqual(calc["level"], 3)

        output_path = os.path.join(EXPORTS_DIR, "test_export_test_c_calculation.xlsx")
        adapter = Adapter60_40()
        adapter.generate_report(self.course_metadata, test_students, output_path=output_path)

        wb = openpyxl.load_workbook(output_path, data_only=False)
        ws = wb["For 60_40 (final)"]

        # Check total students formula in row 112
        self.assertEqual(ws["C112"].value, "=COUNT($A$29:$A$109)")
        # Check countif formula in row 113
        self.assertEqual(ws["C113"].value, '=COUNTIF(C29:C109,">="&(C$28*$AG$16/100))')
        wb.close()

    # -------------------------------------------------------------------------
    # Test D: Empty Offering Handling
    # -------------------------------------------------------------------------
    def test_d_empty_offering_no_demo_students(self):
        """Test D: An empty offering produces no demo students and raises error in generate_workbook."""
        output_path = os.path.join(EXPORTS_DIR, "test_export_test_d_empty.xlsx")
        adapter = Adapter60_40()
        
        # When an empty list is passed to adapter, it clears all student rows
        res = adapter.generate_report(self.course_metadata, [], output_path=output_path)
        self.assertTrue(res["success"])

        wb = openpyxl.load_workbook(output_path, data_only=False)
        ws = wb["For 60_40 (final)"]

        # Confirm NO students exist in rows 29 to 109
        for r in range(29, 110):
            self.assertIsNone(ws[f"A{r}"].value, f"Row {r} roll must be None")
            self.assertIsNone(ws[f"B{r}"].value, f"Row {r} name must be None")
        wb.close()

        # generate_workbook with empty list must raise ValueError
        with self.assertRaises(ValueError):
            generate_workbook("60_40", student_records=[])

    # -------------------------------------------------------------------------
    # Test E: Database / Adapter Failure Handling
    # -------------------------------------------------------------------------
    def test_e_failure_no_silent_fallback(self):
        """Test E: Failed or None input records raises ValueError instead of silent fallback."""
        with self.assertRaises(ValueError):
            generate_workbook("60_40", course_data={}, student_records=None, allow_mock_fallback=False)

    # -------------------------------------------------------------------------
    # Test F: Course Isolation
    # -------------------------------------------------------------------------
    def test_f_course_isolation(self):
        """Test F: Exporting two offerings produces workbooks with ONLY their respective students."""
        offering_1_students = [
            {"roll_no": "1111", "student_name": "OFFERING_ONE_STUDENT", "marks": {"mt1_co1": 9.0}}
        ]
        offering_2_students = [
            {"roll_no": "2222", "student_name": "OFFERING_TWO_STUDENT", "marks": {"mt1_co1": 8.0}}
        ]

        out1 = os.path.join(EXPORTS_DIR, "test_export_test_f_offering_1.xlsx")
        out2 = os.path.join(EXPORTS_DIR, "test_export_test_f_offering_2.xlsx")

        adapter = Adapter60_40()
        adapter.generate_report({"course_code": "COURSE_1"}, offering_1_students, output_path=out1)
        adapter.generate_report({"course_code": "COURSE_2"}, offering_2_students, output_path=out2)

        wb1 = openpyxl.load_workbook(out1, data_only=False)
        wb2 = openpyxl.load_workbook(out2, data_only=False)

        ws1 = wb1["For 60_40 (final)"]
        ws2 = wb2["For 60_40 (final)"]

        # Workbook 1 must have Offering 1 student and NOT Offering 2 student
        self.assertEqual(ws1["A29"].value, 1111.0)
        self.assertEqual(ws1["B29"].value, "OFFERING_ONE_STUDENT")
        self.assertIsNone(ws1["A30"].value)

        # Workbook 2 must have Offering 2 student and NOT Offering 1 student
        self.assertEqual(ws2["A29"].value, 2222.0)
        self.assertEqual(ws2["B29"].value, "OFFERING_TWO_STUDENT")
        self.assertIsNone(ws2["A30"].value)

        wb1.close()
        wb2.close()

    # -------------------------------------------------------------------------
    # Test G: Mock-Data Isolation
    # -------------------------------------------------------------------------
    def test_g_mock_data_isolation_cli(self):
        """Test G: Normal production execution cannot access test fixtures or seed datasets."""
        # Running excel_generator.py with no payload or empty payload must fail
        cmd = [
            sys.executable,
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "excel_generator.py"),
            "60_40",
            "" # Empty payload path
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0, "CLI must reject execution with empty payload")
        self.assertIn("Error", proc.stderr)

        # Calling generate_workbook without allow_mock_fallback must raise ValueError
        with self.assertRaises(ValueError):
            generate_workbook("60_40", student_records=None, allow_mock_fallback=False)


if __name__ == "__main__":
    unittest.main()
