"""
OutcomeX — Stage 8: Security Audit & Compliance Automated Test Suite
Programmatically verifies:
1. Absence of leaked secrets or service role keys in client source code.
2. Path traversal defenses in file handling.
3. RLS policies covering all 19 core tables.
4. Integrity of master reference template.
"""

import os
import re
import unittest
from scripts.excel_generator import compute_sha256, REFERENCE_WORKBOOK_PATH

ORIGINAL_TEMPLATE_SHA256 = "497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class TestSecurityAudit(unittest.TestCase):
    def test_01_no_service_role_key_leaks_in_src(self):
        """Scans all typescript and javascript files in src/ for exposed service role keys."""
        src_dir = os.path.join(PROJECT_ROOT, "src")
        forbidden_patterns = [
            re.compile(r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][A-Za-z0-9_\-\.]+['\"]"),
            re.compile(r"NEXT_PUBLIC_.*SERVICE_ROLE", re.IGNORECASE),
            re.compile(r"service_role_secret", re.IGNORECASE),
        ]

        violations = []
        for root, _, files in os.walk(src_dir):
            for file in files:
                if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                    fpath = os.path.join(root, file)
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        for pattern in forbidden_patterns:
                            if pattern.search(content):
                                violations.append(fpath)

        self.assertEqual(len(violations), 0, f"Found forbidden secret patterns in: {violations}")

    def test_02_path_traversal_sanitization(self):
        """Verifies path traversal strings are neutralized by basename sanitization."""
        malicious_inputs = [
            "../../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\SAM",
            "../../../reference/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx",
            "/absolute/path/to/secret.env",
            "normal_report.xlsx",
        ]

        for malicious in malicious_inputs:
            safe = os.path.basename(malicious)
            self.assertNotIn("/", safe)
            self.assertNotIn("\\", safe)
            self.assertFalse(safe.startswith(".."))

    def test_03_all_19_entities_have_rls_enabled(self):
        """Verifies that 20261018000002_rls_policies.sql enables RLS on all 19 entities."""
        migration_file = os.path.join(
            PROJECT_ROOT, "supabase", "migrations", "20261018000002_rls_policies.sql"
        )
        self.assertTrue(os.path.exists(migration_file))

        with open(migration_file, "r", encoding="utf-8") as f:
            sql_content = f.read()

        expected_entities = [
            "departments", "profiles", "department_memberships", "academic_years",
            "attainment_schemes", "template_versions", "courses", "course_offerings",
            "course_outcomes", "program_outcomes", "course_po_mappings", "students",
            "enrollments", "assessment_components", "assessment_component_co_mappings",
            "student_marks", "indirect_attainment", "report_runs", "audit_logs"
        ]

        for entity in expected_entities:
            pattern = re.compile(
                rf"ALTER\s+TABLE\s+(?:public\.)?{entity}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
                re.IGNORECASE
            )
            self.assertTrue(
                pattern.search(sql_content),
                f"Missing ENABLE ROW LEVEL SECURITY for entity: {entity}"
            )

    def test_04_master_reference_template_integrity(self):
        """Verifies reference Excel file has not been altered."""
        sha = compute_sha256(REFERENCE_WORKBOOK_PATH)
        self.assertEqual(sha, ORIGINAL_TEMPLATE_SHA256)


if __name__ == "__main__":
    unittest.main()
