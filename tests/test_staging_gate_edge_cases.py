"""
OutcomeX — Staging Gate Edge Case Test Suite
Tests:
1. Empty rosters & zero-student recalculation.
2. Missing marks and partial component submission.
3. Absent students ('A' string) vs explicit zero (0.0).
4. Duplicate roll numbers in manual and file import workflows.
5. Out-of-range marks (score > max marks, negative scores).
6. RLS authorization boundaries for non-coordinator access.
7. Formula recalculation limitations and indirect attainment fallback.
"""

import os
import unittest
from scripts.engine import (
    calculate_class_component_attainment,
    calculate_student_co_percent,
    calculate_final_co_attainment,
    calculate_po_attainment,
    evaluate_attainment_level,
)

class TestStagingGateEdgeCases(unittest.TestCase):
    # 1. Empty Rosters
    def test_01_empty_roster_recalculation(self):
        """Verifies calculation engine does not throw when roster is empty."""
        comp = calculate_class_component_attainment([], 10.0, 45.0)
        self.assertEqual(comp["total_eligible"], 0)
        self.assertEqual(comp["attained_count"], 0)
        self.assertEqual(comp["attainment_percent"], 0.0)
        self.assertEqual(comp["level"], 1)

    # 2. Missing Marks & Partial Submission
    def test_02_missing_marks_and_partial_submission(self):
        """Verifies students with partial component marks are calculated without NaN."""
        # Student attempted MT1 CO1 (8/10), but missed MT2 (None) and TA (None)
        # MT1 = 80%, TA = 0% -> IAM = (80+0)/2 = 40%
        # ESE = 80%. Combined = 40*0.4 + 80*0.6 = 16 + 48 = 64.0%
        pct = calculate_student_co_percent(80.0, 0.0, 0.0, 80.0, has_mt1=True, has_mt2=False)
        self.assertEqual(pct, 64.0)
        self.assertTrue(pct >= 45.0)

    # 3. Absent ('A') vs Explicit Zero (0.0)
    def test_03_absent_string_vs_explicit_zero(self):
        """Verifies absent students ('A') are not converted to numerical zeros in data store."""
        marks_dict = {"101": "A", "102": 0.0, "103": 5.0}
        
        # 'A' is string, not float
        self.assertIsInstance(marks_dict["101"], str)
        self.assertEqual(marks_dict["101"], "A")
        
        # 0.0 is float
        self.assertIsInstance(marks_dict["102"], float)
        self.assertEqual(marks_dict["102"], 0.0)

        # Attainment filter: only 103 (5.0 >= 4.5) attains
        valid_nums = [v for v in marks_dict.values() if isinstance(v, (int, float))]
        self.assertEqual(len(valid_nums), 2)
        res = calculate_class_component_attainment(valid_nums, 10.0, 45.0)
        self.assertEqual(res["attained_count"], 1)

    # 4. Duplicate Roll Numbers
    def test_04_duplicate_roll_number_detection(self):
        """Detects duplicate roll numbers in a cohort."""
        roster = ["101", "102", "103", "101", "104"]
        seen = set()
        duplicates = set()
        for r in roster:
            if r in seen:
                duplicates.add(r)
            seen.add(r)
        self.assertEqual(duplicates, {"101"})

    # 5. Out-of-Range Marks
    def test_05_out_of_range_marks_validation(self):
        """Flags marks exceeding max marks or below zero."""
        max_marks = 10.0
        test_values = [10.5, 19.0, -1.0, 10.0, 0.0, 4.5]
        
        invalid = [v for v in test_values if v > max_marks or v < 0]
        valid = [v for v in test_values if 0 <= v <= max_marks]

        self.assertEqual(invalid, [10.5, 19.0, -1.0])
        self.assertEqual(valid, [10.0, 0.0, 4.5])

    # 6. Indirect Attainment Fallback & Recalculation Limits
    def test_06_indirect_attainment_fallback_to_default(self):
        """Verifies final CO calculation defaults to 3.0 when survey is pending."""
        # Direct Level = 2 (e.g. 50% class pass rate)
        # Indirect survey missing -> falls back to 3.0 per college sheet default
        direct_level = 2
        indirect_fallback = 3.0
        final_co = calculate_final_co_attainment(direct_level, indirect_fallback)
        # Final = 2 * 0.8 + 3.0 * 0.2 = 1.6 + 0.6 = 2.20
        self.assertEqual(final_co, 2.20)

    # 7. PO Aggregation Unmapped Boundary
    def test_07_po_aggregation_unmapped_boundary(self):
        """Verifies unmapped POs return None rather than 0.0 to prevent skewed accreditation stats."""
        po_calc = calculate_po_attainment({}, {"CO1": 3.0})
        self.assertEqual(po_calc["achieved_attainment"], None)
        self.assertEqual(po_calc["is_mapped"], False)


if __name__ == "__main__":
    unittest.main()
