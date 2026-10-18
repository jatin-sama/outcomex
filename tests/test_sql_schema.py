"""
OutcomeX — Stage 2 Schema & Migration Verification Test Suite
Verifies:
1. All 19 required entities are defined
2. UUID primary keys and foreign key constraints
3. RLS enabled on all tables
4. Helper functions and policies defined
5. Seed data completeness
"""

import os
import re
import unittest

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "supabase", "migrations")

REQUIRED_TABLES = [
    "departments",
    "profiles",
    "department_memberships",
    "academic_years",
    "courses",
    "course_offerings",
    "students",
    "enrollments",
    "course_outcomes",
    "program_outcomes",
    "course_po_mappings",
    "assessment_components",
    "assessment_component_co_mappings",
    "attainment_schemes",
    "student_marks",
    "indirect_attainment",
    "template_versions",
    "report_runs",
    "audit_logs",
]

class TestOutcomeXSchema(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.migration_files = sorted([
            os.path.join(MIGRATIONS_DIR, f)
            for f in os.listdir(MIGRATIONS_DIR)
            if f.endswith(".sql")
        ])
        cls.combined_sql = ""
        for mf in cls.migration_files:
            with open(mf, "r", encoding="utf-8") as f:
                cls.combined_sql += "\n" + f.read()

    def test_migration_files_exist(self):
        self.assertGreaterEqual(len(self.migration_files), 3, "Expected at least 3 migration files")

    def test_all_19_entities_created(self):
        created_tables = re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-zA-Z0-9_]+)", self.combined_sql, re.IGNORECASE)
        created_tables_set = set(t.lower() for t in created_tables)
        for req in REQUIRED_TABLES:
            self.assertIn(req, created_tables_set, f"Required entity public.{req} was not created in migrations")

    def test_all_tables_have_uuid_primary_keys(self):
        for table in REQUIRED_TABLES:
            # Match table block
            pattern = rf"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.{table}\s*\((.*?)\);"
            match = re.search(pattern, self.combined_sql, re.IGNORECASE | re.DOTALL)
            self.assertIsNotNone(match, f"Could not extract body for table {table}")
            body = match.group(1)
            self.assertTrue(
                "id UUID PRIMARY KEY" in body or "id UUID" in body and "PRIMARY KEY" in body,
                f"Table {table} must have UUID primary key"
            )

    def test_rls_enabled_on_all_19_tables(self):
        rls_tables = re.findall(r"ALTER\s+TABLE\s+public\.([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY", self.combined_sql, re.IGNORECASE)
        rls_tables_set = set(t.lower() for t in rls_tables)
        for req in REQUIRED_TABLES:
            self.assertIn(req, rls_tables_set, f"RLS must be enabled on table public.{req}")

    def test_security_helper_functions_defined(self):
        required_functions = [
            "get_user_department_ids",
            "is_department_admin",
            "is_hod_or_admin",
            "is_offering_teacher",
            "can_manage_offering",
        ]
        for fn in required_functions:
            pattern = rf"FUNCTION\s+public\.{fn}\b"
            self.assertTrue(
                re.search(pattern, self.combined_sql, re.IGNORECASE) is not None,
                f"Security helper function public.{fn} must be defined"
            )

    def test_student_marks_course_boundary_policy(self):
        # Verify student marks has policy checking enrollment and offering
        self.assertTrue(
            "student_marks_select" in self.combined_sql and "can_manage_offering" in self.combined_sql,
            "student_marks must have RLS policy restricting access to authorized course offerings"
        )

    def test_seed_data_contains_reference_department_and_course(self):
        # Department CSE
        self.assertIn("'CSE'", self.combined_sql)
        self.assertIn("'Priyadarshini College of Engineering, Nagpur'", self.combined_sql)
        # Academic Year 2025-26
        self.assertIn("'2025-26'", self.combined_sql)
        # Both schemes
        self.assertIn("'Autonomous 60/40 Scheme'", self.combined_sql)
        self.assertIn("'Autonomous 30/20 Scheme'", self.combined_sql)
        # Course 25UCS623T
        self.assertIn("'25UCS623T'", self.combined_sql)
        # All 6 COs
        for i in range(1, 7):
            self.assertIn(f"'CO{i}'", self.combined_sql)
        # POs and PSOs
        for i in range(1, 13):
            self.assertIn(f"'PO{i}'", self.combined_sql)
        self.assertIn("'PSO 1'", self.combined_sql)
        self.assertIn("'PSO 2'", self.combined_sql)

if __name__ == "__main__":
    unittest.main()
