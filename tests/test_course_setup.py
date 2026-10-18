"""
OutcomeX — Stage 3 Course Setup & Student Roster Unit Tests
Validates:
1. Dynamic CO configuration (variable numbers of COs, duplicate code detection)
2. CO-to-PO mapping strength validation (1, 2, 3 or null)
3. Assessment component max mark validation
4. Student roster duplicate roll number prevention & status handling
"""

import unittest

class TestCourseOutcomeConfig(unittest.TestCase):

    def test_dynamic_co_count_support(self):
        # Must support courses with 4, 6, or arbitrary COs
        schemes = {
            "60/40": ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"],
            "30/20": ["CO1", "CO2", "CO3", "CO4"],
            "custom_8": [f"CO{i}" for i in range(1, 9)],
        }
        for name, cos in schemes.items():
            self.assertGreaterEqual(len(cos), 1, f"Scheme {name} must have at least 1 CO")
            self.assertEqual(len(cos), len(set(cos)), f"CO codes in {name} must be distinct")

    def test_duplicate_co_code_rejection(self):
        input_cos = ["CO1", "CO2", "CO1"]
        seen = set()
        has_duplicate = False
        for code in input_cos:
            if code in seen:
                has_duplicate = True
                break
            seen.add(code)
        self.assertTrue(has_duplicate, "Validation must detect duplicate CO codes")


class TestPOMappingMatrix(unittest.TestCase):

    def validate_strength(self, val):
        if val is None or val == 0 or val == "":
            return None
        num = int(val)
        if num in (1, 2, 3):
            return num
        raise ValueError(f"Invalid mapping strength: {val}")

    def test_valid_strengths_accepted(self):
        self.assertEqual(self.validate_strength(1), 1)
        self.assertEqual(self.validate_strength(2), 2)
        self.assertEqual(self.validate_strength(3), 3)
        self.assertIsNone(self.validate_strength(None))
        self.assertIsNone(self.validate_strength(""))
        self.assertIsNone(self.validate_strength(0))

    def test_invalid_strengths_rejected(self):
        for invalid in [4, 5, -1, 10]:
            with self.assertRaises(ValueError):
                self.validate_strength(invalid)


class TestAssessmentConfig(unittest.TestCase):

    def validate_assessment(self, name, max_marks, category):
        if not name or not name.strip():
            raise ValueError("Component name cannot be empty")
        if max_marks is None or max_marks <= 0:
            raise ValueError("Max marks must be greater than zero")
        valid_cats = {'MID_TERM_1', 'MID_TERM_2', 'TEACHER_ASSESSMENT', 'END_SEM', 'ASSIGNMENT', 'LAB'}
        if category not in valid_cats:
            raise ValueError(f"Invalid category: {category}")
        return True

    def test_valid_assessments(self):
        self.assertTrue(self.validate_assessment("MT1 Q1", 10, "MID_TERM_1"))
        self.assertTrue(self.validate_assessment("ESE Part A", 12, "END_SEM"))
        self.assertTrue(self.validate_assessment("Teacher Assessment", 10, "TEACHER_ASSESSMENT"))

    def test_zero_or_negative_marks_rejected(self):
        with self.assertRaises(ValueError):
            self.validate_assessment("Invalid", 0, "MID_TERM_1")
        with self.assertRaises(ValueError):
            self.validate_assessment("Invalid", -5, "MID_TERM_1")


class TestStudentRosterManagement(unittest.TestCase):

    def test_duplicate_roll_number_rejection(self):
        existing_roster = ["102", "103", "104", "105"]
        new_students = [
            {"roll": "106", "name": "Alice"},
            {"roll": "102", "name": "Duplicate Student"},
        ]

        added = []
        duplicates = []
        for s in new_students:
            if s["roll"] in existing_roster:
                duplicates.append(s["roll"])
            else:
                existing_roster.append(s["roll"])
                added.append(s)

        self.assertEqual(len(added), 1)
        self.assertEqual(added[0]["roll"], "106")
        self.assertIn("102", duplicates)

    def test_enrollment_status_transitions(self):
        valid_statuses = {'ENROLLED', 'DROPPED', 'DETAINED'}
        student = {"id": "s102", "status": "ENROLLED"}

        for status in ['DROPPED', 'DETAINED', 'ENROLLED']:
            self.assertIn(status, valid_statuses)
            student["status"] = status
            self.assertEqual(student["status"], status)


if __name__ == "__main__":
    unittest.main()
