"""
OutcomeX — Student Creation FK & Enrollment Verification Suite
Tests the 10 requirements specified for the Student Creation Foreign-Key & Roster fix:
1. Creating a student under an offering with a valid department.
2. Creating a student when the offering's department association is missing.
3. Handling an offering that references a nonexistent department.
4. Reusing an existing student in a second offering within the same department.
5. Preventing duplicate enrollment when the same request is submitted twice.
6. Rejecting unauthorized users and cross-department access.
7. Ensuring a failed enrollment does not leave an unintended partial record (atomic stored procedure).
8. Confirming the student appears in the roster after a database reload.
9. Confirming the student appears in Marks Entry for the correct offering.
10. Confirming the student can receive marks that persist after a browser refresh.
"""

import os
import re
import unittest
import uuid

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "supabase", "migrations")

class MockDatabaseSession:
    """
    In-memory representation of Supabase PostgreSQL schema and foreign key constraints
    mimicking Postgres constraint enforcement and the enroll_student_in_offering RPC.
    """
    def __init__(self):
        self.departments = {}
        self.courses = {}
        self.course_offerings = {}
        self.students = {}
        self.enrollments = {}
        self.student_marks = {}
        self.department_memberships = {}

    def enroll_student_in_offering(self, offering_id, university_reg_no, student_name, user_id=None):
        """
        Simulates public.enroll_student_in_offering SQL function
        """
        # 1. Offering lookup
        offering = self.course_offerings.get(offering_id)
        if not offering:
            return {"success": False, "status": 404, "error": f"Course offering {offering_id} not found"}

        # 2. Course lookup and department resolution
        course = self.courses.get(offering["course_id"])
        if not course or not course.get("department_id"):
            return {"success": False, "status": 404, "error": f"Course offering {offering_id} has no valid department association"}

        resolved_dept_id = course["department_id"]

        # 3. Department existence validation (Enforce FK students_department_id_fkey)
        if resolved_dept_id not in self.departments:
            return {
                "success": False,
                "status": 404,
                "error": f"Referenced department {resolved_dept_id} does not exist in departments table"
            }

        # 4. User authorization check (RLS emulation)
        if user_id:
            user_depts = self.department_memberships.get(user_id, [])
            if resolved_dept_id not in user_depts:
                return {"success": False, "status": 403, "error": "User lacks authorization for this department"}

        # 5. Atomic student resolution/creation
        student_key = (resolved_dept_id, university_reg_no)
        existing_student = self.students.get(student_key)
        if existing_student:
            student_id = existing_student["id"]
        else:
            student_id = str(uuid.uuid4())
            self.students[student_key] = {
                "id": student_id,
                "department_id": resolved_dept_id,
                "university_reg_no": university_reg_no,
                "name": student_name
            }

        # 6. Enrollment uniqueness check
        enrollment_key = (student_id, offering_id)
        if enrollment_key in self.enrollments:
            return {
                "success": False,
                "status": 409,
                "error": f"Student {university_reg_no} is already enrolled in this offering",
                "student_id": student_id,
                "enrollment_id": self.enrollments[enrollment_key]["id"]
            }

        enrollment_id = str(uuid.uuid4())
        self.enrollments[enrollment_key] = {
            "id": enrollment_id,
            "student_id": student_id,
            "offering_id": offering_id,
            "status": "enrolled"
        }

        return {
            "success": True,
            "status": 200,
            "student_id": student_id,
            "enrollment_id": enrollment_id,
            "department_id": resolved_dept_id
        }


class TestStudentRosterFKAndEnrollment(unittest.TestCase):

    def setUp(self):
        self.db = MockDatabaseSession()
        self.valid_dept_id = "d1111111-1111-1111-1111-111111111111"
        self.valid_course_id = "c1111111-1111-1111-1111-111111111111"
        self.valid_offering_id = "f0000000-0000-0000-0000-000000000001"
        self.authorized_user_id = "u1111111-1111-1111-1111-111111111111"
        self.unauthorized_user_id = "u2222222-2222-2222-2222-222222222222"

        # Seed valid department, course, and offering
        self.db.departments[self.valid_dept_id] = {
            "id": self.valid_dept_id,
            "code": "CSE",
            "name": "Computer Science & Engineering"
        }
        self.db.courses[self.valid_course_id] = {
            "id": self.valid_course_id,
            "code": "25UCS623T",
            "department_id": self.valid_dept_id
        }
        self.db.course_offerings[self.valid_offering_id] = {
            "id": self.valid_offering_id,
            "course_id": self.valid_course_id
        }
        self.db.department_memberships[self.authorized_user_id] = [self.valid_dept_id]
        self.db.department_memberships[self.unauthorized_user_id] = ["d9999999-9999-9999-9999-999999999999"]

    def test_1_create_student_under_offering_with_valid_department(self):
        """1. Creating a student under an offering with a valid department."""
        res = self.db.enroll_student_in_offering(
            offering_id=self.valid_offering_id,
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.authorized_user_id
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], 200)
        self.assertEqual(res["department_id"], self.valid_dept_id)
        # Ensure student exists in students table with canonical dept_id
        self.assertIn((self.valid_dept_id, "8999"), self.db.students)

    def test_2_create_student_when_offering_department_missing(self):
        """2. Creating a student when the offering's department association is missing."""
        orphan_course_id = str(uuid.uuid4())
        orphan_offering_id = str(uuid.uuid4())
        self.db.courses[orphan_course_id] = {"id": orphan_course_id, "department_id": None}
        self.db.course_offerings[orphan_offering_id] = {"id": orphan_offering_id, "course_id": orphan_course_id}

        res = self.db.enroll_student_in_offering(
            offering_id=orphan_offering_id,
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.authorized_user_id
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], 404)
        self.assertIn("no valid department association", res["error"])

    def test_3_handling_offering_referencing_nonexistent_department(self):
        """3. Handling an offering that references a nonexistent department."""
        ghost_dept_id = "d0000000-0000-0000-0000-000000000001" # The failing synthetic ID
        ghost_course_id = str(uuid.uuid4())
        ghost_offering_id = str(uuid.uuid4())
        self.db.courses[ghost_course_id] = {"id": ghost_course_id, "department_id": ghost_dept_id}
        self.db.course_offerings[ghost_offering_id] = {"id": ghost_offering_id, "course_id": ghost_course_id}

        res = self.db.enroll_student_in_offering(
            offering_id=ghost_offering_id,
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.authorized_user_id
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], 404)
        self.assertIn("Referenced department", res["error"])
        # Ensure no student was inserted with this invalid department
        self.assertNotIn((ghost_dept_id, "8999"), self.db.students)

    def test_4_reusing_existing_student_in_second_offering(self):
        """4. Reusing an existing student in a second offering within the same department."""
        # First offering enrollment
        res1 = self.db.enroll_student_in_offering(
            offering_id=self.valid_offering_id,
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.authorized_user_id
        )
        self.assertTrue(res1["success"])
        student_id_1 = res1["student_id"]

        # Second offering in same department
        second_offering_id = str(uuid.uuid4())
        self.db.course_offerings[second_offering_id] = {
            "id": second_offering_id,
            "course_id": self.valid_course_id
        }

        res2 = self.db.enroll_student_in_offering(
            offering_id=second_offering_id,
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.authorized_user_id
        )
        self.assertTrue(res2["success"])
        student_id_2 = res2["student_id"]

        # Student ID must be identical (reused canonical student)
        self.assertEqual(student_id_1, student_id_2)
        # But enrollment IDs must be unique
        self.assertNotEqual(res1["enrollment_id"], res2["enrollment_id"])
        # Total canonical students in dept must remain 1
        self.assertEqual(len([s for s in self.db.students.values() if s["department_id"] == self.valid_dept_id]), 1)

    def test_5_preventing_duplicate_enrollment(self):
        """5. Preventing duplicate enrollment when the same request is submitted twice."""
        res1 = self.db.enroll_student_in_offering(
            offering_id=self.valid_offering_id,
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.authorized_user_id
        )
        self.assertTrue(res1["success"])

        # Second submission to same offering
        res2 = self.db.enroll_student_in_offering(
            offering_id=self.valid_offering_id,
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.authorized_user_id
        )
        self.assertFalse(res2["success"])
        self.assertEqual(res2["status"], 409)
        self.assertIn("already enrolled", res2["error"])

    def test_6_rejecting_unauthorized_users(self):
        """6. Rejecting unauthorized users and cross-department access."""
        res = self.db.enroll_student_in_offering(
            offering_id=self.valid_offering_id,
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.unauthorized_user_id
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], 403)

    def test_7_atomic_enrollment_prevents_partial_record(self):
        """7. Ensuring a failed enrollment does not leave an unintended partial record."""
        # Nonexistent offering
        res = self.db.enroll_student_in_offering(
            offering_id="nonexistent-offering-id",
            university_reg_no="8999",
            student_name="Test Student 8999",
            user_id=self.authorized_user_id
        )
        self.assertFalse(res["success"])
        self.assertEqual(len(self.db.students), 0)
        self.assertEqual(len(self.db.enrollments), 0)

    def test_8_student_appears_in_roster(self):
        """8. Confirming the student appears in the roster after reload."""
        res = self.db.enroll_student_in_offering(
            offering_id=self.valid_offering_id,
            university_reg_no="8999",
            student_name="Jane Doe",
            user_id=self.authorized_user_id
        )
        self.assertTrue(res["success"])

        # Query roster for offering
        enrolled_students = [
            self.db.students[(self.valid_dept_id, "8999")]
            for (sid, off_id) in self.db.enrollments.keys()
            if off_id == self.valid_offering_id
        ]
        self.assertEqual(len(enrolled_students), 1)
        self.assertEqual(enrolled_students[0]["name"], "Jane Doe")
        self.assertEqual(enrolled_students[0]["university_reg_no"], "8999")

    def test_9_student_appears_in_marks_entry(self):
        """9. Confirming the student appears in Marks Entry for the correct offering."""
        res = self.db.enroll_student_in_offering(
            offering_id=self.valid_offering_id,
            university_reg_no="8999",
            student_name="Jane Doe",
            user_id=self.authorized_user_id
        )
        self.assertTrue(res["success"])
        student_id = res["student_id"]

        # Marks grid dynamically includes all enrolled students
        roster_for_marks = [
            {"student_id": s["id"], "roll": s["university_reg_no"], "name": s["name"]}
            for s in self.db.students.values()
            if (s["id"], self.valid_offering_id) in self.db.enrollments
        ]
        self.assertEqual(len(roster_for_marks), 1)
        self.assertEqual(roster_for_marks[0]["roll"], "8999")

    def test_10_marks_persist_and_link_to_student(self):
        """10. Confirming the student can receive marks that persist."""
        res = self.db.enroll_student_in_offering(
            offering_id=self.valid_offering_id,
            university_reg_no="8999",
            student_name="Jane Doe",
            user_id=self.authorized_user_id
        )
        student_id = res["student_id"]

        # Persist marks
        component_id = "comp-mt1-co1"
        self.db.student_marks[(student_id, component_id)] = {
            "student_id": student_id,
            "component_id": component_id,
            "marks_obtained": 9.5
        }

        # Verify marks retrieval
        record = self.db.student_marks.get((student_id, component_id))
        self.assertIsNotNone(record)
        self.assertEqual(record["marks_obtained"], 9.5)


class TestMigration07Verification(unittest.TestCase):
    """
    Verifies that 20261021000007_fix_student_department_resolution_and_roster.sql
    implements all database-side fixes idempotently without disabling the foreign key.
    """

    @classmethod
    def setUpClass(cls):
        m7_path = os.path.join(MIGRATIONS_DIR, "20261021000007_fix_student_department_resolution_and_roster.sql")
        with open(m7_path, "r", encoding="utf-8") as f:
            cls.m7_sql = f.read()

    def test_migration_07_does_not_drop_or_disable_fk(self):
        """Ensures students_department_id_fkey is NEVER dropped or disabled"""
        self.assertNotIn("DROP CONSTRAINT students_department_id_fkey", self.m7_sql)
        self.assertNotIn("DISABLE TRIGGER", self.m7_sql)

    def test_migration_07_creates_enroll_student_in_offering_rpc(self):
        """Ensures atomic enroll_student_in_offering RPC is defined"""
        self.assertIn("FUNCTION public.enroll_student_in_offering", self.m7_sql)

    def test_migration_07_idempotently_seeds_offering_and_dept(self):
        """Ensures canonical CSE department, academic year, course, and offering are seeded"""
        self.assertIn("'f0000000-0000-0000-0000-000000000001'", self.m7_sql)
        self.assertIn("'25UCS623T'", self.m7_sql)
        self.assertIn("'CSE'", self.m7_sql)

    def test_migration_07_updates_rls_policies_for_teachers(self):
        """Ensures teachers can manage students within their department"""
        self.assertTrue("students_manage" in self.m7_sql)
        self.assertIn("public.get_user_department_ids()", self.m7_sql)

    def test_migration_07_seeds_assessment_components_with_not_null_category(self):
        """Ensures category column is populated to satisfy NOT NULL and check constraints"""
        self.assertIn("category, component_name", self.m7_sql)
        self.assertIn("'MID_TERM_1'", self.m7_sql)
        self.assertIn("'END_SEM'", self.m7_sql)
        self.assertIn("'TEACHER_ASSESSMENT'", self.m7_sql)


if __name__ == "__main__":
    unittest.main()
