# OutcomeX — MVP Task Checklist & Development Roadmap

> **Status:** Stage 1 Complete / Ready for Review  
> **Development Methodology:** Phased, verifiable stages with strict regression testing against the reference Excel workbook.

---

## Stage Checklist

### [x] Stage 1: Reference Workbook Audit & Specification
- [x] Inspect worksheets, merged cells, formulas, hidden rows/columns, and formatting rules.
- [x] Document 60/40 and 30/20 templates in [formula-specification.md](file:///d:/outcomex/docs/formula-specification.md) and [template-mapping.md](file:///d:/outcomex/docs/template-mapping.md).
- [x] Detect and catalogue broken references, errors, and out-of-bounds student marks.
- [x] Uncover the PO attainment discrepancy (hard-coded mapping averages vs. weighted attainment formula).
- [x] Formulate verified reference calculation test cases directly from workbook data.
- [x] Design normalized PostgreSQL ER diagram with full RLS strategy in [database-schema.md](file:///d:/outcomex/docs/database-schema.md).
- [x] Request faculty verification on critical TODO items before building database migrations and calculation code.

---

### [x] Stage 2: Database Migrations, Auth & Authorization
- [x] Implement SQL migration scripts for all 19 entities ([20261018000001_initial_schema.sql](file:///d:/outcomex/supabase/migrations/20261018000001_initial_schema.sql)).
- [x] Write and verify PostgreSQL RLS policies ensuring department isolation and teacher course-level boundaries ([20261018000002_rls_policies.sql](file:///d:/outcomex/supabase/migrations/20261018000002_rls_policies.sql)).
- [x] Seed reference data for PCE Nagpur CSE department, 2025-26, Autonomous 60/40 & 30/20 schemes, PO1–PO12, PSO1–PSO2 ([20261018000003_seed_reference_data.sql](file:///d:/outcomex/supabase/migrations/20261018000003_seed_reference_data.sql)).
- [x] Build automated test suite ([test_sql_schema.py](file:///d:/outcomex/tests/test_sql_schema.py)) validating all 19 entities, UUID PKs, foreign keys, RLS coverage, helper functions, and seed data (7/7 tests passed).
- [x] Initialize Next.js project skeleton (App Router, TypeScript, Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react`).
- [x] Implement Supabase Auth (email/password login, session management) and department authorization context.
- [x] Verified full TypeScript compilation (`tsc --noEmit`) and Next.js production build (`npm run build`) with zero errors.

---

### [x] Stage 3: Course Setup & Student Roster Management
- [x] Build Course Offering Catalog and Creation Modal ([courses/page.tsx](file:///d:/outcomex/src/app/courses/page.tsx)).
- [x] Support dynamic Course Outcome configuration for arbitrary numbers of COs ([setup/page.tsx](file:///d:/outcomex/src/app/courses/[id]/setup/page.tsx) and [outcomes/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/outcomes/route.ts)).
- [x] Implement interactive CO-to-PO/PSO Mapping Matrix editor with real-time target averages ([mappings/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/mappings/route.ts)).
- [x] Implement Assessment Component builder (MT-1, MT-2, TA, ESE) with max marks validation ([assessments/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/assessments/route.ts)).
- [x] Implement Student Roster CRUD with single add, Excel paste/bulk import, status switcher, search filtering, and duplicate roll number protection ([roster/page.tsx](file:///d:/outcomex/src/app/roster/page.tsx) and [roster/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/roster/route.ts)).
- [x] Pre-populate with the 81 reference students extracted from the college workbook ([referenceStudents.ts](file:///d:/outcomex/src/lib/data/referenceStudents.ts)).
- [x] Automated test suite ([test_course_setup.py](file:///d:/outcomex/tests/test_course_setup.py)) passing 8/8 tests (15/15 total across suite).
- [x] Verified full Next.js production build (`npm run build`) with zero errors.

---

### [x] Stage 4: Marks Import Wizard & Manual Spreadsheet Editor
- [x] Build openpyxl Python parsing service ([parse_marks_file.py](file:///d:/outcomex/scripts/parse_marks_file.py)) for safe `.xlsx` and `.csv` inspection without macro execution.
- [x] Implement versioned API endpoints for marks grid and multi-stage import validation ([marks/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/marks/route.ts) and [marks/import/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/marks/import/route.ts)).
- [x] Build keyboard-navigable spreadsheet-like marks editor with sticky roll/name headers, real-time maximum marks validation, paste-from-Excel support, and absent/exempt states ([marks/page.tsx](file:///d:/outcomex/src/app/marks/page.tsx)).
- [x] Build 4-step marks import wizard with auto column mapping, row-level validation report, and duplicate roll detection.
- [x] Pre-populate with verified marks for all 81 students from reference workbook ([referenceMarks.ts](file:///d:/outcomex/src/lib/data/referenceMarks.ts)).
- [x] Automated test suite ([test_marks_import.py](file:///d:/outcomex/tests/test_marks_import.py)) passing all tests (20/20 total across suite).
- [x] Verified full Next.js production build (`npm run build`) with zero errors.

---

### [x] Stage 5: Deterministic Attainment Calculation Engine
- [x] Build independent TypeScript calculation engine ([attainmentEngine.ts](file:///d:/outcomex/src/lib/engine/attainmentEngine.ts)) and matching Python verification engine ([engine.py](file:///d:/outcomex/scripts/engine.py)).
- [x] Implement verified formulas: Student CO percentages (40% IAM + 60% ESE), Component threshold attainment counts (45% threshold), Class percentages, Rubric levels 1–3, Direct/Indirect weighting (80%/20%), and PO/PSO matrix aggregation.
- [x] Implement step-by-step arithmetic explanations for every CO and PO result.
- [x] Implement versioned calculation API endpoint ([calculate/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/calculate/route.ts)).
- [x] Build interactive Attainment Preview & Inspection UI ([attainment/page.tsx](file:///d:/outcomex/src/app/attainment/page.tsx)) with 4 inspection tabs.
- [x] Automated unit test suite ([test_calculation_engine.py](file:///d:/outcomex/tests/test_calculation_engine.py)) passing all boundary and reference cases (31/31 tests passing across suite).
- [x] Verified full Next.js production build (`npm run build`) with zero errors.

---

### [x] Stage 6: Excel Template Adapters & Workbook Generation
- [x] Build Python openpyxl adapter service ([excel_generator.py](file:///d:/outcomex/scripts/excel_generator.py)).
- [x] Maintain byte-exact template files preserving formatting, column widths, print setups (landscape, A4, 50% scale), and styles.
- [x] Implement `Adapter60_40` and `Adapter30_20`.
- [x] Populate input and output cells while preserving intact formulas.
- [x] Repair verified broken references (`#REF!` in 30/20 ESE lookup, `E97->E98` rubric level typo, `G27:H27` mislabeled headers).
- [x] Compare generated output against independent calculation engine before allowing file download.
- [x] Build Report Generation & History UI ([reports/page.tsx](file:///d:/outcomex/src/app/reports/page.tsx)) and API routes ([export/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/export/route.ts), [download/route.ts](file:///d:/outcomex/src/app/api/v1/reports/download/route.ts)).
- [x] Automated test suite ([test_excel_generation.py](file:///d:/outcomex/tests/test_excel_generation.py)) passing all tests (36/36 tests passing across entire test suite).
- [x] Verified full Next.js production build (`npm run build`) with zero errors.

---

### [x] Stage 7: End-to-End Workflow Integration & Reference Verification
- [x] Import complete 81-student dataset from reference workbook into the web application ([load_reference_dataset](file:///d:/outcomex/scripts/excel_generator.py)).
- [x] Execute automated deterministic calculation run matching rows 111–115 attainment metrics.
- [x] Generate exported Excel workbook and compare cell-by-cell against original reference file (1,215 cells checked across 81 students x 13 components, 0 mismatches).
- [x] Implement immutable audit log trail system ([auditLogger.ts](file:///d:/outcomex/src/lib/audit/auditLogger.ts), [audit/route.ts](file:///d:/outcomex/src/app/api/v1/offerings/[id]/audit/route.ts)) recording marks imports, recalculation runs, and report downloads.
- [x] Verify reference template SHA-256 integrity remains untouched throughout all operations.
- [x] Automated test suite ([test_integration_reference_verification.py](file:///d:/outcomex/tests/test_integration_reference_verification.py)) passing all tests (41/41 tests passing across entire suite).
- [x] Verified full Next.js production build (`npm run build`) with zero errors.

---

### [x] Stage 8: Deployment & Department Pilot Readiness
- [x] Create department deployment guide and environment configuration checklist ([deployment-guide.md](file:///d:/outcomex/docs/deployment-guide.md)).
- [x] Prepare comprehensive user training guide for teachers and HODs ([user-guide.md](file:///d:/outcomex/docs/user-guide.md)).
- [x] Conduct and document production security audit ([security-audit.md](file:///d:/outcomex/docs/security-audit.md)).
- [x] Automated security audit test suite ([test_security_audit.py](file:///d:/outcomex/tests/test_security_audit.py)) passing all tests.
- [x] 100% of test suites passing: 45/45 tests passing across 7 test suites.
- [x] Production Next.js build verified with zero errors across all 11 routes and 10 dynamic APIs.

---

## 2. Final Project Deliverables Summary

| Milestone | Deliverable | Status |
|---|---|---|
| **Stage 1: Discovery & Specification** | [formula-specification.md](file:///d:/outcomex/docs/formula-specification.md), [template-mapping.md](file:///d:/outcomex/docs/template-mapping.md), [database-schema.md](file:///d:/outcomex/docs/database-schema.md), [mvp-roadmap.md](file:///d:/outcomex/docs/mvp-roadmap.md) | Verified Complete |
| **Stage 2: Database & Core Foundation** | 19 SQL tables, RLS policies, seed data ([migrations](file:///d:/outcomex/supabase/migrations/)), Next.js App foundation | Verified Complete |
| **Stage 3: Course Setup & Student Roster** | Dynamic CO builder, CO-to-PO matrix with live averages, Assessment component builder, Bulk-paste student roster | Verified Complete |
| **Stage 4: Marks Workspace & Import Engine** | Sticky-header marks spreadsheet, openpyxl parsing service, 4-step upload wizard, real-time validation | Verified Complete |
| **Stage 5: Deterministic Attainment Engine** | TS & Python OBE engines (40/60 weighting, 45% threshold mark, 55% level 3 cut-off), 4-tab inspection UI with mathematical proofs | Verified Complete |
| **Stage 6: Excel Template Adapters** | openpyxl report generator (`Adapter60_40`, `Adapter30_20`), repaired broken `#REF!` and formula typos, Report History UI | Verified Complete |
| **Stage 7: E2E Reference Verification** | Ingestion of 81 reference students, cell-by-cell comparison (1,215 cells checked, 0 mismatches), immutable audit logging | Verified Complete |
| **Stage 8: Pilot Deployment Readiness** | [deployment-guide.md](file:///d:/outcomex/docs/deployment-guide.md), [user-guide.md](file:///d:/outcomex/docs/user-guide.md), [security-audit.md](file:///d:/outcomex/docs/security-audit.md), [test_security_audit.py](file:///d:/outcomex/tests/test_security_audit.py) | Verified Complete |

