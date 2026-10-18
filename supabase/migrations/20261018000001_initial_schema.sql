-- ==============================================================================
-- OutcomeX — Migration 01: Initial Schema for CO-PO Attainment Automation
-- Description: Core entities, constraints, indexes, and triggers
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper trigger function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. Identity, Departments, and Authorization Entities
-- ==============================================================================

-- 2.1 Departments (e.g. Computer Science & Engineering)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    institution_name VARCHAR(255) NOT NULL DEFAULT 'Priyadarshini College of Engineering, Nagpur',
    is_autonomous BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON public.departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.2 Profiles (Linked to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Automatically create profile on Supabase auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe trigger creation for auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
    ) THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- If running outside Supabase environment where auth.users does not exist
        NULL;
END;
$$;

-- 2.3 Department Memberships (Roles: teacher, hod, department_admin)
CREATE TABLE IF NOT EXISTS public.department_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('teacher', 'hod', 'department_admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dept_membership UNIQUE (profile_id, department_id)
);

CREATE INDEX idx_dept_memberships_profile ON public.department_memberships(profile_id);
CREATE INDEX idx_dept_memberships_department ON public.department_memberships(department_id);

-- ==============================================================================
-- 3. Academic Planning & Attainment Schemes
-- ==============================================================================

-- 3.1 Academic Years (e.g. 2025-26)
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    year_label VARCHAR(50) NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_academic_year_dept UNIQUE (department_id, year_label)
);

CREATE INDEX idx_academic_years_dept ON public.academic_years(department_id);

-- 3.2 Attainment Schemes (Configurable parameters and rubrics)
CREATE TABLE IF NOT EXISTS public.attainment_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    scheme_name VARCHAR(100) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    threshold_percent NUMERIC(5, 2) NOT NULL DEFAULT 45.00 CHECK (threshold_percent > 0 AND threshold_percent <= 100),
    level_3_threshold NUMERIC(5, 2) NOT NULL DEFAULT 55.00 CHECK (level_3_threshold >= 0 AND level_3_threshold <= 100),
    level_2_threshold NUMERIC(5, 2) NOT NULL DEFAULT 45.00 CHECK (level_2_threshold >= 0 AND level_2_threshold <= 100),
    direct_weight NUMERIC(5, 2) NOT NULL DEFAULT 0.80 CHECK (direct_weight >= 0 AND direct_weight <= 1.0),
    indirect_weight NUMERIC(5, 2) NOT NULL DEFAULT 0.20 CHECK (indirect_weight >= 0 AND indirect_weight <= 1.0),
    iam_weight NUMERIC(5, 2) NOT NULL DEFAULT 0.40 CHECK (iam_weight >= 0 AND iam_weight <= 1.0),
    esam_weight NUMERIC(5, 2) NOT NULL DEFAULT 0.60 CHECK (esam_weight >= 0 AND esam_weight <= 1.0),
    po_aggregation_method VARCHAR(50) NOT NULL DEFAULT 'WEIGHTED_AVERAGE'
        CHECK (po_aggregation_method IN ('WEIGHTED_AVERAGE', 'MAPPING_AVERAGE')),
    is_approved BOOLEAN NOT NULL DEFAULT true,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_scheme_version UNIQUE (department_id, scheme_name, version)
);

CREATE INDEX idx_schemes_dept ON public.attainment_schemes(department_id);

-- 3.3 Template Versions (Adapter references and file signatures)
CREATE TABLE IF NOT EXISTS public.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    file_sha256 VARCHAR(64) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    sheet_name VARCHAR(100) NOT NULL,
    adapter_identifier VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_template_version UNIQUE (template_name, version)
);

-- ==============================================================================
-- 4. Courses, Outcomes, and Curricular Mappings
-- ==============================================================================

-- 4.1 Courses (Catalog entity)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    year_of_study VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dept_course_code UNIQUE (department_id, course_code)
);

CREATE INDEX idx_courses_dept ON public.courses(department_id);

-- 4.2 Course Offerings (Specific academic session and assigned faculty)
CREATE TABLE IF NOT EXISTS public.course_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    section VARCHAR(50) NOT NULL DEFAULT 'A',
    attainment_scheme_id UUID NOT NULL REFERENCES public.attainment_schemes(id) ON DELETE RESTRICT,
    template_version_id UUID REFERENCES public.template_versions(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_offering UNIQUE (course_id, academic_year_id, section)
);

CREATE INDEX idx_offerings_course ON public.course_offerings(course_id);
CREATE INDEX idx_offerings_teacher ON public.course_offerings(teacher_id);
CREATE INDEX idx_offerings_acad_year ON public.course_offerings(academic_year_id);

-- 4.3 Course Outcomes (CO1..COn for each course)
CREATE TABLE IF NOT EXISTS public.course_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    co_code VARCHAR(20) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_co UNIQUE (course_id, co_code)
);

CREATE INDEX idx_co_course ON public.course_outcomes(course_id);

-- 4.4 Program Outcomes & Program Specific Outcomes (PO1..PO12, PSO1..PSOn)
CREATE TABLE IF NOT EXISTS public.program_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    po_code VARCHAR(20) NOT NULL,
    po_type VARCHAR(10) NOT NULL CHECK (po_type IN ('PO', 'PSO')),
    description TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dept_po UNIQUE (department_id, po_code)
);

CREATE INDEX idx_po_dept ON public.program_outcomes(department_id);

-- 4.5 Course-to-PO/PSO Mappings (Strength: 1=Low, 2=Medium, 3=High)
CREATE TABLE IF NOT EXISTS public.course_po_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_outcome_id UUID NOT NULL REFERENCES public.course_outcomes(id) ON DELETE CASCADE,
    program_outcome_id UUID NOT NULL REFERENCES public.program_outcomes(id) ON DELETE CASCADE,
    mapping_strength INT CHECK (mapping_strength IN (1, 2, 3)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_co_po_mapping UNIQUE (course_outcome_id, program_outcome_id)
);

CREATE INDEX idx_co_po_co ON public.course_po_mappings(course_outcome_id);
CREATE INDEX idx_co_po_po ON public.course_po_mappings(program_outcome_id);

-- ==============================================================================
-- 5. Students, Enrollments, and Assessment Framework
-- ==============================================================================

-- 5.1 Students Master
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    university_reg_no VARCHAR(100),
    student_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dept_student_reg UNIQUE (department_id, university_reg_no)
);

CREATE INDEX idx_students_dept ON public.students(department_id);

-- 5.2 Enrollments (Roster for a specific course offering)
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    roll_no VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ENROLLED' CHECK (status IN ('ENROLLED', 'DROPPED', 'DETAINED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_offering_roll UNIQUE (course_offering_id, roll_no),
    CONSTRAINT uq_offering_student UNIQUE (course_offering_id, student_id)
);

CREATE INDEX idx_enrollments_offering ON public.enrollments(course_offering_id);
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id);

-- 5.3 Assessment Components (MT-1, MT-2, Teacher Assessment, Endsem)
CREATE TABLE IF NOT EXISTS public.assessment_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('MID_TERM_1', 'MID_TERM_2', 'TEACHER_ASSESSMENT', 'END_SEM', 'ASSIGNMENT', 'LAB')),
    component_name VARCHAR(100) NOT NULL,
    max_marks NUMERIC(6, 2) NOT NULL CHECK (max_marks > 0),
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_offering_component UNIQUE (course_offering_id, component_name)
);

CREATE INDEX idx_assessment_comp_offering ON public.assessment_components(course_offering_id);

-- 5.4 Assessment Component to CO Mapping
CREATE TABLE IF NOT EXISTS public.assessment_component_co_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_component_id UUID NOT NULL REFERENCES public.assessment_components(id) ON DELETE CASCADE,
    course_outcome_id UUID NOT NULL REFERENCES public.course_outcomes(id) ON DELETE CASCADE,
    weight NUMERIC(5, 2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comp_co_mapping UNIQUE (assessment_component_id, course_outcome_id)
);

CREATE INDEX idx_comp_co_comp ON public.assessment_component_co_mappings(assessment_component_id);
CREATE INDEX idx_comp_co_co ON public.assessment_component_co_mappings(course_outcome_id);

-- 5.5 Student Marks (Atomic, Normalized Gradebook)
CREATE TABLE IF NOT EXISTS public.student_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    assessment_component_id UUID NOT NULL REFERENCES public.assessment_components(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(6, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'EXEMPT', 'NOT_ENTERED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrollment_component_mark UNIQUE (enrollment_id, assessment_component_id),
    CONSTRAINT chk_positive_marks CHECK (marks_obtained IS NULL OR marks_obtained >= 0)
);

CREATE INDEX idx_student_marks_enrollment ON public.student_marks(enrollment_id);
CREATE INDEX idx_student_marks_comp ON public.student_marks(assessment_component_id);

-- 5.6 Indirect Attainment (Exit survey / faculty input per CO)
CREATE TABLE IF NOT EXISTS public.indirect_attainment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
    course_outcome_id UUID NOT NULL REFERENCES public.course_outcomes(id) ON DELETE CASCADE,
    attainment_level NUMERIC(4, 2) NOT NULL DEFAULT 3.00 CHECK (attainment_level >= 0 AND attainment_level <= 3.0),
    survey_sample_size INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_offering_co_indirect UNIQUE (course_offering_id, course_outcome_id)
);

CREATE INDEX idx_indirect_offering ON public.indirect_attainment(course_offering_id);

-- ==============================================================================
-- 6. Report History & Audit Logs
-- ==============================================================================

-- 6.1 Report Runs (Immutable generation snapshot and storage reference)
CREATE TABLE IF NOT EXISTS public.report_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE RESTRICT,
    template_version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE RESTRICT,
    generated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    calculation_snapshot JSONB NOT NULL,
    storage_file_path VARCHAR(500) NOT NULL,
    file_checksum VARCHAR(64) NOT NULL,
    validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'FAILED', 'PENDING')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_runs_offering ON public.report_runs(course_offering_id);
CREATE INDEX idx_report_runs_generated_by ON public.report_runs(generated_by);

-- 6.2 Audit Logs (Security, marks imports, recalculation events)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_profile ON public.audit_logs(profile_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
