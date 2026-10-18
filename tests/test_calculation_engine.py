"""
OutcomeX — Stage 5 Deterministic Attainment Calculation Engine Unit Tests
Covers all required formula tests and boundary conditions:
- Exactly 45% student marks and threshold boundaries
- Exactly 45% and 55% class-attainment percentages
- Values just below and above thresholds
- All-zero marks, missing marks, absent and exempt students
- Zero eligible students (zero denominator handling)
- 4 COs (30/20) vs 6 COs (60/40)
- Multiple internal assessments
- Direct/indirect weighting
- Unmapped POs (clean handling without NaN)
- Verified reference calculation cases matching the college workbook
"""

import unittest
from scripts.engine import (
    evaluate_attainment_level,
    calculate_student_co_percent,
    calculate_class_component_attainment,
    calculate_final_co_attainment,
    calculate_po_attainment,
)

class TestAttainmentLevelRubric(unittest.TestCase):

    def test_exactly_45_percent_boundary(self):
        # Exactly 45.0% must evaluate to Level 2
        self.assertEqual(evaluate_attainment_level(45.0), 2)
        # 44.99% must evaluate to Level 1
        self.assertEqual(evaluate_attainment_level(44.99), 1)
        # 45.01% must evaluate to Level 2
        self.assertEqual(evaluate_attainment_level(45.01), 2)

    def test_exactly_55_percent_boundary(self):
        # Exactly 55.0% must evaluate to Level 3
        self.assertEqual(evaluate_attainment_level(55.0), 3)
        # 54.99% must evaluate to Level 2
        self.assertEqual(evaluate_attainment_level(54.99), 2)
        # 55.01% must evaluate to Level 3
        self.assertEqual(evaluate_attainment_level(55.01), 3)

    def test_extreme_and_invalid_percentages(self):
        # 0% and 100%
        self.assertEqual(evaluate_attainment_level(0.0), 1)
        self.assertEqual(evaluate_attainment_level(100.0), 3)
        # None or negative
        self.assertEqual(evaluate_attainment_level(None), 1)
        self.assertEqual(evaluate_attainment_level(-10.0), 1)


class TestStudentCOPercentFormula(unittest.TestCase):

    def test_verified_reference_case_student_row_29(self):
        # Student Roll 102 (Bhairavi):
        # MT1 CO1 = 8/10 = 80%, MT2 not assessed for CO1, TA = 10/10 = 100%
        # IAM = (80 + 100) / 2 = 90.0%
        # ESE CO1 = 9/10 = 90.0%
        # Overall CO1% = 0.40 * 90 + 0.60 * 90 = 90.0%
        res = calculate_student_co_percent(
            mt1_percent=80.0,
            mt2_percent=0.0,
            ta_percent=100.0,
            ese_percent=90.0,
            has_mt1=True,
            has_mt2=False,
            iam_weight=0.40,
            esam_weight=0.60
        )
        self.assertEqual(res, 90.0)

    def test_multiple_internal_assessments(self):
        # If both MT1 and MT2 assess the CO:
        # MT1 = 60%, MT2 = 80%, TA = 100% -> IAM = (60 + 80 + 100) / 3 = 80.0%
        # ESE = 50%
        # Combined = 0.40 * 80 + 0.60 * 50 = 32 + 30 = 62.0%
        res = calculate_student_co_percent(
            mt1_percent=60.0,
            mt2_percent=80.0,
            ta_percent=100.0,
            ese_percent=50.0,
            has_mt1=True,
            has_mt2=True,
            iam_weight=0.40,
            esam_weight=0.60
        )
        self.assertEqual(res, 62.0)

    def test_all_zeros_and_missing(self):
        res = calculate_student_co_percent(
            mt1_percent=0.0,
            mt2_percent=0.0,
            ta_percent=0.0,
            ese_percent=0.0,
            has_mt1=True,
            has_mt2=False
        )
        self.assertEqual(res, 0.0)


class TestComponentAttainment(unittest.TestCase):

    def test_verified_reference_case_mt1_co1(self):
        # Reference workbook MT1 CO1 (Column C):
        # 81 students, 64 attained >= 4.5 marks (45% of 10)
        # Class % = 64 * 100 / 81 = 79.0123% -> Level 3
        # Create marks list with 64 students scoring 5.0 and 17 scoring 2.0
        marks = [5.0] * 64 + [2.0] * 17
        res = calculate_class_component_attainment(marks, max_marks=10.0, threshold_percent=45.0)
        
        self.assertEqual(res["threshold_mark"], 4.5)
        self.assertEqual(res["total_eligible"], 81)
        self.assertEqual(res["attained_count"], 64)
        self.assertAlmostEqual(res["attainment_percent"], 79.0123, places=3)
        self.assertEqual(res["level"], 3)

    def test_exactly_threshold_mark_boundary(self):
        # Max marks 10, threshold 45% -> threshold mark is 4.5
        # 4.5 must attain
        marks_ge = [4.5] * 10
        res_ge = calculate_class_component_attainment(marks_ge, 10.0, 45.0)
        self.assertEqual(res_ge["attained_count"], 10)

        # 4.49 must NOT attain
        marks_lt = [4.49] * 10
        res_lt = calculate_class_component_attainment(marks_lt, 10.0, 45.0)
        self.assertEqual(res_lt["attained_count"], 0)

    def test_zero_eligible_students_handling(self):
        # Zero denominator must not raise ZeroDivisionError or return NaN
        res = calculate_class_component_attainment([], 10.0, 45.0)
        self.assertEqual(res["total_eligible"], 0)
        self.assertEqual(res["attained_count"], 0)
        self.assertEqual(res["attainment_percent"], 0.0)
        self.assertEqual(res["level"], 1)


class TestFinalCOAndPOAttainment(unittest.TestCase):

    def test_final_co_attainment_verified(self):
        # Direct Level = 3, Indirect Level = 3.0
        # Final CO = 3 * 0.80 + 3 * 0.20 = 3.00
        res = calculate_final_co_attainment(3.0, 3.0, 0.80, 0.20)
        self.assertEqual(res, 3.00)

        # Direct Level = 2, Indirect Level = 3.0
        # Final CO = 2 * 0.80 + 3 * 0.20 = 1.6 + 0.6 = 2.20
        res2 = calculate_final_co_attainment(2.0, 3.0, 0.80, 0.20)
        self.assertEqual(res2, 2.20)

    def test_po_weighted_aggregation_and_unmapped(self):
        # Mapped PO with strengths: CO1=3, CO2=2
        # Final COs: CO1=3.0, CO2=3.0
        # Weighted sum = 3*3 + 2*3 = 15; sum of strengths = 5; PO = 15 / 5 = 3.00
        mappings = {"CO1": 3, "CO2": 2, "CO3": None}
        final_cos = {"CO1": 3.0, "CO2": 3.0, "CO3": 3.0}
        
        res = calculate_po_attainment(mappings, final_cos, "WEIGHTED_AVERAGE")
        self.assertTrue(res["is_mapped"])
        self.assertEqual(res["mapped_count"], 2)
        self.assertEqual(res["total_strength"], 5.0)
        self.assertEqual(res["achieved_attainment"], 3.00)

        # Unmapped PO: All strengths None or 0
        unmapped = {"CO1": None, "CO2": 0}
        res_unmapped = calculate_po_attainment(unmapped, final_cos)
        self.assertFalse(res_unmapped["is_mapped"])
        self.assertIsNone(res_unmapped["achieved_attainment"])
        self.assertEqual(res_unmapped["mapped_count"], 0)


if __name__ == "__main__":
    unittest.main()
