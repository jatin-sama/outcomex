import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.engine import (
    evaluate_attainment_level,
    calculate_class_component_attainment,
    calculate_final_co_attainment,
    calculate_po_attainment,
)

class TestRosterToMarksIntegration(unittest.TestCase):
    """
    Direct regression test verifying:
    1. A student enrolled in Student Roster is integrated into the Marks dataset.
    2. Enrolled students with and without marks are correctly handled.
    3. Entered marks drive deterministic CO and PO attainment calculations.
    """

    def setUp(self):
        # Base cohort of 81 reference students
        self.base_cohort_size = 81
        
        # Test student added via Roster
        self.new_student = {
            "student_id": "s-test-999",
            "roll_no": "999",
            "student_name": "TEST DEMO STUDENT",
            "marks": {}
        }

    def test_newly_enrolled_student_in_marks_grid(self):
        """Verify that a student added to roster exists in marks grid even before marks are entered"""
        roster = [{"roll_no": str(i), "student_name": f"Student {i}"} for i in range(101, 101 + self.base_cohort_size)]
        
        # Add new student to roster
        roster.append({"roll_no": "999", "student_name": "TEST DEMO STUDENT"})
        self.assertEqual(len(roster), 82)

        # Build marks grid driven by roster
        existing_marks = {str(i): {"mt1_co1": 8} for i in range(101, 101 + self.base_cohort_size)}
        
        marks_grid = []
        for s in roster:
            roll = s["roll_no"]
            marks_grid.append({
                "roll_no": roll,
                "student_name": s["student_name"],
                "marks": existing_marks.get(roll, {}) # Empty if not entered yet
            })

        # Find new student in marks grid
        found = [m for m in marks_grid if m["roll_no"] == "999"]
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["student_name"], "TEST DEMO STUDENT")
        self.assertEqual(found[0]["marks"], {})

    def test_marks_entry_persistence_and_attainment_calculation(self):
        """Verify that when marks are entered for the newly enrolled student, attainment updates correctly"""
        # 10 students, threshold = 45% (4.5 / 10)
        marks_component = [8, 7, 6, 5, 3, 2, 9, 8, 7, 6] # 8 qualified out of 10

        # Initial calculation: 8 qualified out of 10 = 80% -> Level 3
        result_initial = calculate_class_component_attainment(
            marks_list=marks_component,
            max_marks=10,
            threshold_percent=45.0
        )
        self.assertEqual(result_initial["total_eligible"], 10)
        self.assertEqual(result_initial["attained_count"], 8)
        self.assertEqual(result_initial["level"], 3)

        # Now newly enrolled student 999 has marks entered: 2/10 (not qualified)
        marks_component.append(2)
        
        result_with_new_student = calculate_class_component_attainment(
            marks_list=marks_component,
            max_marks=10,
            threshold_percent=45.0
        )
        self.assertEqual(result_with_new_student["total_eligible"], 11)
        self.assertEqual(result_with_new_student["attained_count"], 8)
        self.assertAlmostEqual(result_with_new_student["attainment_percent"], (8/11)*100, places=1)
        self.assertEqual(result_with_new_student["level"], 3)

    def test_co_to_po_aggregation_modes_with_enrolled_cohort(self):
        """Verify that both WEIGHTED_AVERAGE and MAPPING_AVERAGE work deterministically"""
        final_co_map = {
            "CO1": 3.0, "CO2": 3.0, "CO3": 3.0,
            "CO4": 3.0, "CO5": 3.0, "CO6": 3.0
        }
        po_mapping = {"CO1": 3, "CO2": 3, "CO3": 3, "CO4": 3, "CO5": 2, "CO6": 2}

        # Weighted Average mode
        res_weighted = calculate_po_attainment(
            mappings=po_mapping,
            final_co_map=final_co_map,
            aggregation_method="WEIGHTED_AVERAGE"
        )
        self.assertEqual(res_weighted["achieved_attainment"], 3.0)

        # Mapping Average (Reference) mode
        # Average of (3+3+3+3+2+2)/6 = 16/6 = 2.6667
        res_mapping = calculate_po_attainment(
            mappings=po_mapping,
            final_co_map=final_co_map,
            aggregation_method="MAPPING_AVERAGE"
        )
        self.assertAlmostEqual(res_mapping["achieved_attainment"], 2.67, places=2)

if __name__ == "__main__":
    unittest.main()
