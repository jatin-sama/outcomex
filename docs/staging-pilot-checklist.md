# OutcomeX — Staging Pilot & Teacher Trial Checklist

This document details the configuration checklist for the staging environment and the operational protocol for the initial 3-teacher department pilot at Priyadarshini College of Engineering, Nagpur.

---

## 1. Staging Environment Deployment Checklist

### 1.1 Environment Configuration (.env.staging)

| Variable | Scope | Purpose | Staging Verification |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (Client + Server) | Staging Supabase project URL | Must point to staging Supabase instance |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (Client + Server) | RLS-constrained public API key | Must have RLS enforced on all tables |
| `SUPABASE_SERVICE_ROLE_KEY` | **SERVER-ONLY (Secret)** | Privileged backend tasks | **CRITICAL: NEVER prefix with NEXT_PUBLIC_ or bundle in client** |
| `NEXT_PUBLIC_APP_URL` | Public | Staging base URL | `https://staging-outcomex.pce.edu.in` |
| `NODE_ENV` | Server | Runtime environment | `staging` / `production` |
| `PORT` | Server | Local bind port | `3000` |

### 1.2 Database Migrations (Ordered Execution)
Execute the three versioned migrations against the Staging PostgreSQL database:
- [x] `supabase/migrations/20261018000001_initial_schema.sql` (19 tables, indexes, UUID PKs) — **APPLIED & VERIFIED**
- [x] `supabase/migrations/20261018000002_rls_policies.sql` (RLS enabled on all 19 entities, teacher course boundary isolation) — **APPLIED & VERIFIED**
- [x] `supabase/migrations/20261018000003_seed_reference_data.sql` (CSE department, academic year 2025-26, 12 POs, 2 PSOs, 81 student records) — **APPLIED & VERIFIED**

### 1.3 Security & Storage Verification
- [x] **RLS Verification**: Confirmed anonymous `SELECT` on `student_marks` is denied.
- [x] **Course Boundary**: Confirmed Teacher A cannot read or write marks for Course Offering B.
- [x] **Audit Trail**: Confirmed `audit_logs` records cannot be updated or deleted by teachers.
- [x] **Report Storage**: Generated reports in `exports/` are served only via authenticated `/api/v1/reports/download` with path-traversal sanitization.
- [x] **Template Protection**: Original workbook `reference/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx` remains read-only with verified SHA-256 (`497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477`).
- [x] **Live Pilot Gate**: Staging database connected (`twuvuovkznrksymbobav`), Next.js routes running, and faculty trial protocols validated. — **PASSED**

---

## 2. Department Teacher Trial Protocol (3 Teachers)

### 2.1 Teacher Cohort & Test Scenarios

| Teacher | Assigned Course / Section | Testing Scenario | Expected Data & Actions |
|---|---|---|---|
| **Teacher 1** (Course Coordinator) | `25UCS623T` — Data Science (60/40 Scheme) | **Manual Grid Entry & Workflow Flow** | Enrolls 81 students; manually enters marks via keyboard navigation (`Tab`/`Arrow`/`Enter`); verifies sticky headers; reviews attainment preview. |
| **Teacher 2** (Subject Faculty) | `25UCS623T` — Data Science (60/40 Scheme) | **Excel File Upload & Error Interception** | Uploads sample marks file containing intentional anomalies (score > max marks, duplicate roll numbers, negative marks); verifies wizard error interception. |
| **Teacher 3** (Subject Faculty) | `25UCS402T` — Database Systems (30/20 Scheme) | **4-CO Scheme & Report Generation** | Runs 30/20 attainment scheme; inspects repaired `#REF!` formulas; exports official Excel workbook; verifies formatting in Microsoft Excel 2016/2019/365. |

### 2.2 Trial Feedback & Defect Logging Rubric

Teachers will record observations using the following categories:
1. **Import Errors**: Mismatched headers, student name discrepancies, or coercion errors.
2. **Calculation Discrepancies**: Any difference between expected student percentages and system-calculated direct attainment.
3. **Excel Compatibility**: Opening generated `.xlsx` in Microsoft Excel desktop and mobile; checking for repair alerts, font distortions, or merged cell issues.
4. **Workflow Friction**: Confusing button labels, lag when entering marks, or difficulty navigating between screens.
