-- ==============================================================================
-- OutcomeX — Migration 05: Auto-Membership & Cross-Device Authenticated Access
-- Description:
-- 1. Guarantees default CSE department exists.
-- 2. Automatically links any signing-up user to department_memberships with full permissions.
-- 3. Backfills existing user profiles with department memberships.
-- 4. Enables authenticated faculty to read and write courses, offerings, students, and marks.
-- ==============================================================================

-- 1. Ensure Department 'CSE' exists
INSERT INTO public.departments (id, code, name, institution_name, is_autonomous)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'CSE',
    'Computer Science & Engineering',
    'Priyadarshini College of Engineering, Nagpur',
    true
)
ON CONFLICT (code) DO UPDATE SET is_autonomous = true;

-- 2. Enhanced handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_dept_id UUID;
BEGIN
    -- Insert profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

    -- Find first department or default CSE
    SELECT id INTO v_dept_id FROM public.departments WHERE code = 'CSE' LIMIT 1;
    IF v_dept_id IS NULL THEN
        SELECT id INTO v_dept_id FROM public.departments LIMIT 1;
    END IF;
    IF v_dept_id IS NULL THEN
        v_dept_id := 'd0000000-0000-0000-0000-000000000001'::uuid;
    END IF;

    -- Grant membership as department_admin so faculty has complete access across all devices
    INSERT INTO public.department_memberships (profile_id, department_id, role, is_active)
    VALUES (NEW.id, v_dept_id, 'department_admin', true)
    ON CONFLICT (profile_id, department_id) DO UPDATE SET is_active = true, role = 'department_admin';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill all existing profiles into department_memberships
INSERT INTO public.department_memberships (profile_id, department_id, role, is_active)
SELECT 
    p.id, 
    COALESCE(
        (SELECT id FROM public.departments WHERE code = 'CSE' LIMIT 1),
        'd0000000-0000-0000-0000-000000000001'::uuid
    ),
    'department_admin',
    true
FROM public.profiles p
ON CONFLICT (profile_id, department_id) DO UPDATE SET is_active = true, role = 'department_admin';

-- 4. Permissive policies for authenticated users
-- Allows cross-device reads and writes for courses, offerings, students, enrollments, and marks

DO $$
BEGIN
    -- Courses
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'courses_authenticated_all' AND tablename = 'courses') THEN
        CREATE POLICY "courses_authenticated_all" ON public.courses FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Course Offerings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'offerings_authenticated_all' AND tablename = 'course_offerings') THEN
        CREATE POLICY "offerings_authenticated_all" ON public.course_offerings FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Students
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'students_authenticated_all' AND tablename = 'students') THEN
        CREATE POLICY "students_authenticated_all" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Enrollments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'enrollments_authenticated_all' AND tablename = 'enrollments') THEN
        CREATE POLICY "enrollments_authenticated_all" ON public.enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Student Marks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_marks_authenticated_all' AND tablename = 'student_marks') THEN
        CREATE POLICY "student_marks_authenticated_all" ON public.student_marks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Assessment Components
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assessment_components_authenticated_all' AND tablename = 'assessment_components') THEN
        CREATE POLICY "assessment_components_authenticated_all" ON public.assessment_components FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Course Outcomes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'course_outcomes_authenticated_all' AND tablename = 'course_outcomes') THEN
        CREATE POLICY "course_outcomes_authenticated_all" ON public.course_outcomes FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Course PO Mappings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'course_po_mappings_authenticated_all' AND tablename = 'course_po_mappings') THEN
        CREATE POLICY "course_po_mappings_authenticated_all" ON public.course_po_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Report Runs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'report_runs_authenticated_all' AND tablename = 'report_runs') THEN
        CREATE POLICY "report_runs_authenticated_all" ON public.report_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
