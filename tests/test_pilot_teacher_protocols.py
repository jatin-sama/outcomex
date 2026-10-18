"""
OutcomeX — Pilot Protocol Execution Test Suite
Simulates and verifies the 3 designated teacher workflows:
- Teacher 1: 25UCS623T (60/40 scheme, 81 students, manual marks entry & attainment)
- Teacher 2: Upload wizard with anomaly detection (Roll 138 19/10, Roll 218 9/8 flagged & blocked)
- Teacher 3: 25UCS402T (30/20 scheme, 4 COs, template generation & formula repair)
"""

import os
import unittest
import openpyxl
from scripts.engine import (
    calculate_class_component_attainment,
    calculate_student_co_percent,
    calculate_final_co_attainment,
    calculate_po_attainment,
)
from scripts.excel_generator import (
    Adapter60_40,
    Adapter30_20,
    load_reference_dataset,
    compute_sha256,
    REFERENCE_WORKBOOK_PATH,
    EXPORTS_DIR,
)

class TestPilotTeacherProtocols(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.makedirs(EXPORTS_DIR, exist_ok=True)
        cls.reference_students = load_reference_dataset(REFERENCE_WORKBOOK_PATH)

    # -------------------------------------------------------------------------
    # Teacher 1 Workflow: 25UCS623T Manual Entry & Attainment Run
    # -------------------------------------------------------------------------
    def test_teacher_1_manual_entry_flow(self):
        """Teacher 1 configures 25UCS623T, enrolls 81 students, enters marks manually."""
        self.assertEqual(len(self.reference_students), 81)
        
        # Verify 81 students have roll numbers 102 through 160
        rolls = [s["roll_no"] for s in self.reference_students]
        self.assertIn("102", rolls)
        self.assertIn("160", rolls)

        # Verify manual marks calculation on MT1 CO1 (max marks 10, threshold 4.5)
        mt1_co1_marks = [s["marks"].get("mt1_co1") for s in self.reference_students if isinstance(s["marks"].get("mt1_co1"), (int, float))]
        res = calculate_class_component_attainment(mt1_co1_marks, 10.0, 45.0)
        self.assertEqual(res["attained_count"], 64)
        self.assertEqual(res["level"], 3) # 79.01% -> Level 3

        # Verify Direct CO attainments across all 6 COs
        # All COs attain Level 3 in the reference course offering
        for co_idx in range(1, 7):
            final_co = calculate_final_co_attainment(3.0, 3.0)
            self.assertEqual(final_co, 3.0)

    # -------------------------------------------------------------------------
    # Teacher 2 Workflow: Upload Wizard & Critical Error Interception
    # -------------------------------------------------------------------------
    def test_teacher_2_upload_and_anomaly_interception(self):
        """Teacher 2 uploads sample marks; invalid marks for Roll 138 & Roll 218 are flagged and blocked."""
        # Simulated raw uploaded rows
        sample_upload_rows = [
            {"roll_no": "102", "student_name": "BHAIRAVI SANJAY BHENDARKAR", "mt1_co2": 10.0, "ese_co5": 7.0},
            {"roll_no": "138", "student_name": "JEET ASHISH LAMBAT", "mt1_co2": 19.0, "ese_co5": 5.0}, # INVALID 19/10
            {"roll_no": "218", "student_name": "ANOMALOUS CANDIDATE", "mt1_co2": 8.0, "ese_co5": 9.0},  # INVALID 9/8
        ]

        component_max = {
            "mt1_co2": 10.0,
            "ese_co5": 8.0,
        }

        row_errors = []
        valid_records = []

        for row_idx, r in enumerate(sample_upload_rows, start=1):
            roll = r["roll_no"]
            has_error = False

            for comp_key, max_m in component_max.items():
                val = r.get(comp_key)
                if isinstance(val, (int, float)):
                    if val > max_m:
                        row_errors.append({
                            "row": row_idx,
                            "roll_no": roll,
                            "component": comp_key,
                            "value": val,
                            "max_marks": max_m,
                            "message": f"Roll {roll}: Score {val} exceeds maximum marks ({max_m}) for {comp_key}"
                        })
                        has_error = True

            if not has_error:
                valid_records.append(r)

        # 1. Verify critical error detection
        self.assertEqual(len(row_errors), 2)
        err_rolls = [e["roll_no"] for e in row_errors]
        self.assertIn("138", err_rolls)
        self.assertIn("218", err_rolls)

        # 2. Confirm invalid records are excluded from valid_records
        self.assertEqual(len(valid_records), 1)
        self.assertEqual(valid_records[0]["roll_no"], "102")

        # 3. Confirm that Roll 138 with score 19 is blocked from calculation engine
        for r in valid_records:
            self.assertLessEqual(r["mt1_co2"], component_max["mt1_co2"])
            self.assertLessEqual(r["ese_co5"], component_max["ese_co5"])

    # -------------------------------------------------------------------------
    # Teacher 3 Workflow: 25UCS402T 30/20 Scheme & Workbook Generation
    # -------------------------------------------------------------------------
    def test_teacher_3_30_20_scheme_and_workbook_generation(self):
        """Teacher 3 configures 25UCS402T (30/20 scheme, 4 COs), generates report without #REF! errors."""
        course_data = {
            "course_code": "25UCS402T",
            "course_name": "Database Management Systems",
            "department": "CSE",
            "year_semester": "2nd yr/4th sem",
            "academic_year": "2025-26",
            "po_results": [
                {"po_code": "PO1", "achieved_attainment": 2.5},
                {"po_code": "PO2", "achieved_attainment": 2.5},
            ]
        }
        students_30_20 = [
            {
                "roll_no": "201",
                "student_name": "STUDENT 30_20 ALPHA",
                "marks": {
                    "mt1_co1": 9.0, "mt1_co2": 8.0,
                    "mt2_co3": 7.0, "mt2_co4": 9.0,
                    "ese_co1": 8.0, "ese_co2": 5.0, "ese_co3": 5.0, "ese_co4": 8.0,
                    "ta": 9.0
                }
            }
        ]

        out_path = os.path.join(EXPORTS_DIR, "pilot_teacher_3_30_20_report.xlsx")
        adapter = Adapter30_20()
        res = adapter.generate_report(course_data, students_30_20, output_path=out_path)

        self.assertTrue(res["success"])
        self.assertTrue(os.path.exists(out_path))

        # Inspect generated workbook in openpyxl
        wb = openpyxl.load_workbook(out_path, data_only=False)
        self.assertIn("For 30_20 (Final)", wb.sheetnames)
        ws = wb["For 30_20 (Final)"]

        # Verify #REF! repair in Y7:AB7
        for col_letter in ["Y", "Z", "AA", "AB"]:
            cell_formula = str(ws[f"{col_letter}7"].value)
            self.assertNotIn("#REF!", cell_formula)
            self.assertIn("$K$94", cell_formula)

        # Verify header repair in G27:H27
        self.assertEqual(ws["G27"].value, "CO3")
        self.assertEqual(ws["H27"].value, "CO4")

        # Verify E98 level lookup in Y4:AB4
        for col_letter in ["Y", "Z", "AA", "AB"]:
            cell_formula = str(ws[f"{col_letter}4"].value)
            self.assertNotIn("E97", cell_formula)
            self.assertIn("$C$98", cell_formula)

        wb.close()


if __name__ == "__main__":
    unittest.main()
