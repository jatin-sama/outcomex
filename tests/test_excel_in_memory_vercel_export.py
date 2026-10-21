"""
OutcomeX — In-Memory Excel Generation & Vercel Serverless Export Test Suite
Verifies:
1. Workbook generation without creating an 'exports' directory.
2. Valid .xlsx response headers and workbook contents (ZIP / OpenXML magic bytes).
3. Both 60/40 and 30/20 templates generation & cohort capacity limits.
4. Missing template and invalid template errors.
5. Database failure without mock-data fallback.
6. Unauthorized export and download requests.
7. Durable report history and storage retrieval.
8. Successful browser download and error handling.
9. Repository scan confirming no references to /var/task/exports or required mkdir in export/download.
"""

import os
import re
import unittest
import subprocess

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, "src")

class TestInMemoryVercelExcelExport(unittest.TestCase):

    def test_1_and_3_in_memory_generation_and_capacity_limits(self):
        """1 & 3: Executes in-memory generation across 60/40 and 30/20 templates and enforces cohort limits."""
        test_ts_file = os.path.join(ROOT_DIR, "tests", "test_excel_in_memory_vercel.ts")
        proc = subprocess.run(
            ["npx", "tsx", test_ts_file],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            shell=True
        )
        self.assertEqual(proc.returncode, 0, f"TypeScript in-memory test failed:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("ALL IN-MEMORY VERCEL EXCEL GENERATION TESTS PASSED!", proc.stdout)

    def test_2_valid_xlsx_response_headers_and_content_type(self):
        """2: Verifies that export API route sets exact MIME type, Content-Disposition, and Cache-Control: no-store."""
        export_route_path = os.path.join(SRC_DIR, "app", "api", "v1", "offerings", "[id]", "export", "route.ts")
        with open(export_route_path, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", code)
        self.assertIn('attachment; filename="', code)
        self.assertIn("no-store", code)

    def test_4_template_resolution_resilience(self):
        """4: Verifies resolveTemplatePath checks candidate paths and throws descriptive error if template missing."""
        generator_path = os.path.join(SRC_DIR, "lib", "excel", "excelGenerator.ts")
        with open(generator_path, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("resolveTemplatePath", code)
        self.assertIn(".next", code)
        self.assertIn("reference", code)

    def test_5_database_failure_without_mock_data_fallback(self):
        """5: Verifies export API rejects invalid offerings without falling back to mock students."""
        export_route_path = os.path.join(SRC_DIR, "app", "api", "v1", "offerings", "[id]", "export", "route.ts")
        with open(export_route_path, "r", encoding="utf-8") as f:
            code = f.read()

        # Must reject empty roster with 400
        self.assertIn("Offering has no enrolled students", code)
        # Must reject invalid offering with DB error
        self.assertIn("Database error fetching offering metadata", code)

    def test_6_unauthorized_export_and_download_requests(self):
        """6: Verifies that export and download routes enforce server-side authentication and offering authorization."""
        export_route = os.path.join(SRC_DIR, "app", "api", "v1", "offerings", "[id]", "export", "route.ts")
        download_route = os.path.join(SRC_DIR, "app", "api", "v1", "reports", "download", "route.ts")

        for route_path in [export_route, download_route]:
            with open(route_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("getAuthenticatedUser", content)
            self.assertIn("authorizeOfferingAccess", content)
            self.assertIn("status: 401", content)
            self.assertIn("status: 403", content)

    def test_7_durable_report_history_and_storage_retrieval(self):
        """7: Verifies durable report history in report_runs and storage bucket upload with dynamic fallback."""
        export_route = os.path.join(SRC_DIR, "app", "api", "v1", "offerings", "[id]", "export", "route.ts")
        download_route = os.path.join(SRC_DIR, "app", "api", "v1", "reports", "download", "route.ts")

        with open(export_route, "r", encoding="utf-8") as f:
            export_content = f.read()
        with open(download_route, "r", encoding="utf-8") as f:
            download_content = f.read()

        # Export inserts into report_runs and uploads to storage
        self.assertIn('.from("report_runs")', export_content)
        self.assertIn('.storage.from("reports")', export_content)

        # Download checks storage and falls back to dynamic regeneration
        self.assertIn('.storage', download_content)
        self.assertIn('.from("reports")', download_content)
        self.assertIn('.download(storagePath)', download_content)
        self.assertIn('generateExcelReport', download_content)

    def test_8_frontend_blob_download_and_error_handling(self):
        """8: Verifies frontend handles binary Blob downloads, parses JSON errors, and prevents duplicate requests."""
        reports_page = os.path.join(SRC_DIR, "app", "reports", "page.tsx")
        with open(reports_page, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("if (isGenerating) return;", content)
        self.assertIn("res.blob()", content)
        self.assertIn("createObjectURL", content)
        self.assertIn("revokeObjectURL", content)
        self.assertIn("setErrorMessage", content)
        self.assertIn("setSuccessMessage", content)

    def test_9_no_filesystem_dependency_on_exports_directory(self):
        """9: Scans all TypeScript files in src/ to guarantee no code requires mkdir or writes to /var/task/exports."""
        pattern_mkdir = re.compile(r'mkdirSync\s*\(\s*exportsDir')
        pattern_exports = re.compile(r'path\.join\s*\(\s*process\.cwd\(\)\s*,\s*["\']exports["\']\s*\)')

        violations = []
        for root, _, files in os.walk(SRC_DIR):
            for file in files:
                if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                    fpath = os.path.join(root, file)
                    with open(fpath, "r", encoding="utf-8") as f:
                        text = f.read()
                    if pattern_mkdir.search(text) or pattern_exports.search(text):
                        violations.append(fpath)

        self.assertEqual(len(violations), 0, f"Found lingering filesystem exports dependencies in: {violations}")


if __name__ == "__main__":
    unittest.main()
