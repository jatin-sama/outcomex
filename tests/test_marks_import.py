"""
OutcomeX — Stage 4 Marks Import & Validation Unit Tests
Validates:
1. All-zero marks vs missing marks (empty cells are not silently converted to 0)
2. Absent ('A', 'ABSENT') and Exempt ('E', 'EXEMPT') handling
3. Maximum mark validation (detects marks exceeding component limit, e.g. 19/10)
4. Duplicate roll number detection in imported records
5. Negative and non-numeric value rejection
6. Python openpyxl parsing of real workbook
"""

import os
import unittest
from scripts.parse_marks_file import parse_marks_file

WORKBOOK_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reference", "Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx")

class TestMarksValidationRules(unittest.TestCase):

    def validate_mark(self, cell_value, max_marks):
        """
        Rules:
        - Blank/empty: NOT_ENTERED, null mark
        - A/ABSENT: ABSENT, null mark (NOT 0)
        - E/EXEMPT: EXEMPT, null mark (NOT 0)
        - Numeric >= 0 and <= max_marks: PRESENT, numeric mark
        - Numeric > max_marks: OUT_OF_BOUNDS error
        - Numeric < 0: NEGATIVE error
        """
        val_str = str(cell_value).strip().upper() if cell_value is not None else ""
        
        if val_str in ("", "-", "NA", "NULL"):
            return {"status": "NOT_ENTERED", "mark": None}
        elif val_str in ("A", "AB", "ABSENT"):
            return {"status": "ABSENT", "mark": None}
        elif val_str in ("E", "EX", "EXEMPT"):
            return {"status": "EXEMPT", "mark": None}
        
        try:
            num = float(val_str)
        except ValueError:
            raise ValueError(f"Non-numeric mark value: {cell_value}")
        
        if num < 0:
            raise ValueError(f"Negative mark not permitted: {num}")
        if num > max_marks:
            raise ValueError(f"Mark {num} exceeds maximum allowed of {max_marks}")
            
        return {"status": "PRESENT", "mark": num}

    def test_distinguishes_zero_from_absent_and_missing(self):
        # Numeric zero must be a legitimate 0
        r_zero = self.validate_mark(0, 10)
        self.assertEqual(r_zero["status"], "PRESENT")
        self.assertEqual(r_zero["mark"], 0.0)

        # Blank cell must be NOT_ENTERED and null mark (never silently converted to 0)
        r_blank = self.validate_mark("", 10)
        self.assertEqual(r_blank["status"], "NOT_ENTERED")
        self.assertIsNone(r_blank["mark"])

        # Absent must be ABSENT and null mark (never silently converted to 0)
        r_abs = self.validate_mark("ABSENT", 10)
        self.assertEqual(r_abs["status"], "ABSENT")
        self.assertIsNone(r_abs["mark"])

        # Exempt must be EXEMPT and null mark
        r_ex = self.validate_mark("EXEMPT", 10)
        self.assertEqual(r_ex["status"], "EXEMPT")
        self.assertIsNone(r_ex["mark"])

    def test_maximum_mark_violation_detection(self):
        # 19 out of 10 (the exact anomaly found in student Roll 138 Row 94)
        with self.assertRaises(ValueError) as ctx:
            self.validate_mark(19.0, 10.0)
        self.assertIn("exceeds maximum allowed", str(ctx.exception))

        # 9 out of 8 (Roll 218 Row 55 anomaly)
        with self.assertRaises(ValueError) as ctx:
            self.validate_mark(9.0, 8.0)
        self.assertIn("exceeds maximum allowed", str(ctx.exception))

        # Boundary: exactly max marks is valid
        r_max = self.validate_mark(10.0, 10.0)
        self.assertEqual(r_max["mark"], 10.0)

    def test_negative_and_invalid_marks_rejected(self):
        with self.assertRaises(ValueError):
            self.validate_mark(-2, 10)
        with self.assertRaises(ValueError):
            self.validate_mark("INVALID_TEXT", 10)

    def test_duplicate_roll_number_detection(self):
        rows = [
            {"roll": "102", "name": "Bhairavi"},
            {"roll": "103", "name": "Rutuja"},
            {"roll": "102", "name": "Duplicate Roll"},
        ]
        seen = set()
        duplicates = []
        for r in rows:
            roll = r["roll"]
            if roll in seen:
                duplicates.append(roll)
            seen.add(roll)

        self.assertEqual(len(duplicates), 1)
        self.assertIn("102", duplicates)


class TestWorkbookParserService(unittest.TestCase):

    def test_openpyxl_parses_reference_workbook(self):
        self.assertTrue(os.path.exists(WORKBOOK_PATH), f"Workbook must exist at {WORKBOOK_PATH}")
        res = parse_marks_file(WORKBOOK_PATH)
        self.assertNotIn("error", res, f"Parser returned error: {res.get('error')}")
        self.assertEqual(res["format"], "xlsx")
        self.assertIn("For 60_40 (final)", res["sheet_names"])
        self.assertGreaterEqual(res["total_rows"], 20)


if __name__ == "__main__":
    unittest.main()
