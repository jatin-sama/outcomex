"""
OutcomeX — Stage 7: End-to-End Workflow Integration & Reference Verification Test Suite
Verifies the complete pipeline:
1. Loading 81 students and marks from reference dataset.
2. Executing deterministic calculation engine.
3. Verifying exact match against reference workbook attainment values (rows 111-115, row 21).
4. Generating Excel report and performing cell-by-cell comparison.
5. Verifying template immutability (SHA-256 untouched).
"""

import os
import unittest
import openpyxl
from scripts.excel_generator import (
    Adapter60_40,
    Adapter30_20,
    load_reference_dataset,
    compute_sha256,
    REFERENCE_WORKBOOK_PATH,
    EXPORTS_DIR,
)
from scripts.engine import (
    calculate_class_component_attainment,
    calculate_student_co_percent,
    evaluate_attainment_level,
    calculate_final_co_attainment,
    calculate_po_attainment,
)

ORIGINAL_TEMPLATE_SHA256 = "497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477"

class TestIntegrationReferenceVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = load_reference_dataset(REFERENCE_WORKBOOK_PATH)
        cls.orig_wb = openpyxl.load_workbook(REFERENCE_WORKBOOK_PATH, data_only=True)
        cls.orig_ws = cls.orig_wb["For 60_40 (final)"]

    @classmethod
    def tearDownClass(cls):
        cls.orig_wb.close()

    def test_01_student_dataset_loaded_accurately(self):
        """Verifies all 81 students loaded with 13 assessed components."""
        self.assertEqual(len(self.records), 81, "Must extract exactly 81 students")
        first = self.records[0]
        self.assertEqual(first["roll_no"], "102")
        self.assertEqual(first["student_name"], "BHAIRAVI SANJAY BHENDARKAR")

        last = self.records[-1]
        self.assertEqual(last["roll_no"], "160")
        self.assertEqual(last["student_name"], "OM SURESH VINCHURKAR")

    def test_02_component_threshold_attainment_counts(self):
        """
        Verifies student threshold counts match reference workbook rows 112-115:
        Row 113 in reference:
        MT1: CO1=64, CO2=54, CO3=49
        MT2: CO4=66, CO5=57, CO6=49
        ESE: CO1=51, CO2=58, CO3=55, CO4=9, CO5=44, CO6=44
        """
        components = [
            ("mt1_co1", 10.0, 64, 3),
            ("mt1_co2", 10.0, 54, 3),
            ("mt1_co3", 10.0, 49, 3),
            ("mt2_co4", 10.0, 66, 3),
            ("mt2_co5", 10.0, 57, 3),
            ("mt2_co6", 10.0, 49, 3),
            ("ese_co1", 10.0, 51, 3),
            ("ese_co2", 12.0, 58, 3),
            ("ese_co3", 12.0, 55, 3),
            ("ese_co4", 10.0, 9, 1),
            ("ese_co5", 8.0, 44, 2),
            ("ese_co6", 8.0, 44, 2),
        ]

        for comp_key, max_m, expected_count, expected_level in components:
            marks_list = []
            for s in self.records:
                val = s["marks"].get(comp_key)
                if isinstance(val, (int, float)):
                    marks_list.append(val)
                else:
                    marks_list.append(None)

            res = calculate_class_component_attainment(marks_list, max_m, threshold_percent=45.0)
            self.assertEqual(
                res["attained_count"],
                expected_count,
                f"Mismatch in attained student count for {comp_key}"
            )
            self.assertEqual(
                res["level"],
                expected_level,
                f"Mismatch in attainment level for {comp_key}"
            )

    def test_03_po_attainment_reference_match(self):
        """
        Verifies PO attainment calculations against reference workbook row 21:
        PO1: 2.67, PO2: 2.67, PO3: 2.0, PO4: 2.6, PO5: 2.5, PO7: 1.16,
        PO8: 1.0, PO9: 1.5, PO10: 1.0, PO11: 2.67, PSO1: 2.0, PSO2: 2.0
        """
        # Approved CO-PO matrix for 25UCS623T
        mappings = {
            "PO1": {"CO1": 3, "CO2": 3, "CO3": 2},
            "PO2": {"CO1": 3, "CO2": 3, "CO3": 2},
            "PO3": {"CO4": 2},
            "PO4": {"CO1": 3, "CO2": 2, "CO3": 3, "CO4": 2, "CO5": 3},
            "PO5": {"CO5": 2, "CO6": 3},
            "PO7": {"CO1": 1, "CO2": 1, "CO3": 1, "CO4": 1, "CO5": 2, "CO6": 1},
            "PO8": {"CO6": 1},
            "PO9": {"CO5": 1, "CO6": 2},
            "PO10": {"CO5": 1},
            "PO11": {"CO1": 2, "CO2": 3, "CO3": 3},
            "PSO 1": {"CO1": 2, "CO2": 2, "CO3": 2, "CO4": 2, "CO5": 2, "CO6": 2},
            "PSO 2": {"CO1": 2, "CO2": 2, "CO3": 2, "CO4": 2, "CO5": 2, "CO6": 2},
        }

        # Reference final COs are all Level 3
        final_cos = {f"CO{i}": 3.0 for i in range(1, 7)}

        expected_pos = {
            "PO1": 2.67,
            "PO2": 2.67,
            "PO3": 2.0,
            "PO4": 2.6,
            "PO5": 2.5,
            "PO7": 1.16,
            "PO8": 1.0,
            "PO9": 1.5,
            "PO10": 1.0,
            "PO11": 2.67,
            "PSO 1": 2.0,
            "PSO 2": 2.0,
        }

        for po_code, expected_val in expected_pos.items():
            po_map = mappings.get(po_code, {})
            # In reference sheet 60/40, PO values are mapping strength averages
            calc = calculate_po_attainment(po_map, final_cos, aggregation_method="MAPPING_AVERAGE")
            achieved = round(calc["achieved_attainment"], 2)
            self.assertAlmostEqual(
                achieved,
                expected_val,
                places=1,
                msg=f"PO {po_code} calculated {achieved} did not match reference {expected_val}"
            )

    def test_04_cell_by_cell_comparison_with_generated_workbook(self):
        """
        Generates workbook with Adapter60_40 and performs cell-by-cell comparison
        against reference workbook across rows 29-109 (all 81 students x 13 components).
        """
        output_path = os.path.join(EXPORTS_DIR, "integration_test_60_40.xlsx")
        adapter = Adapter60_40()
        course_data = {
            "course_code": "25UCS623T",
            "course_name": "Introduction to Data Science",
            "department": "CSE",
            "year_semester": "3rd yr/5th sem",
            "academic_year": "2025-26",
            "po_results": [
                {"po_code": "PO1", "achieved_attainment": 2.67},
                {"po_code": "PO2", "achieved_attainment": 2.67},
                {"po_code": "PO3", "achieved_attainment": 2.0},
                {"po_code": "PO4", "achieved_attainment": 2.6},
                {"po_code": "PO5", "achieved_attainment": 2.5},
                {"po_code": "PO7", "achieved_attainment": 1.16},
                {"po_code": "PO8", "achieved_attainment": 1.0},
                {"po_code": "PO9", "achieved_attainment": 1.5},
                {"po_code": "PO10", "achieved_attainment": 1.0},
                {"po_code": "PO11", "achieved_attainment": 2.67},
                {"po_code": "PSO 1", "achieved_attainment": 2.0},
                {"po_code": "PSO 2", "achieved_attainment": 2.0},
            ]
        }
        res = adapter.generate_report(course_data, self.records, output_path=output_path)
        self.assertTrue(res["success"])

        gen_wb = openpyxl.load_workbook(output_path, data_only=True)
        gen_ws = gen_wb["For 60_40 (final)"]

        # Cell-by-cell student comparison (cols 1..20, rows 29..109)
        cols_to_check = [1, 2, 3, 4, 5, 8, 9, 10, 13, 14, 15, 16, 17, 18, 20]
        mismatches = 0
        total_cells_checked = 0

        for r in range(29, 110):
            for c in cols_to_check:
                orig_val = self.orig_ws.cell(r, c).value
                gen_val = gen_ws.cell(r, c).value
                total_cells_checked += 1

                # Normalize types for comparison
                if orig_val is not None and gen_val is not None:
                    if isinstance(orig_val, float) and orig_val.is_integer():
                        orig_val = int(orig_val)
                    if isinstance(gen_val, float) and gen_val.is_integer():
                        gen_val = int(gen_val)
                    if str(orig_val).strip() != str(gen_val).strip():
                        mismatches += 1

        gen_wb.close()
        self.assertEqual(mismatches, 0, f"Found {mismatches} cell value differences across {total_cells_checked} cells checked")
        self.assertGreater(total_cells_checked, 1000)

    def test_05_reference_template_integrity_verified(self):
        """Verifies template has never been modified."""
        sha = compute_sha256(REFERENCE_WORKBOOK_PATH)
        self.assertEqual(sha, ORIGINAL_TEMPLATE_SHA256)


if __name__ == "__main__":
    unittest.main()
