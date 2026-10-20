-- ==============================================================================
-- OutcomeX — Migration 06: Fix Privilege Escalation & Enforce Strict RLS
-- Description:
-- 1. Revokes overly permissive policies created in Migration 05.
-- 2. Restores least-privilege role assignments in handle_new_user() (default to 'teacher').
-- 3. Enforces strict tenant and course-offering boundaries for all academic data.
-- 4. Secures report_runs and audit_logs tables.
-- ==============================================================================

-- 1. Drop overly permissive authenticated_all policies from Migration 05
DROP POLICY IF EXISTS "courses_authenticated_all" ON public.courses;
DROP POLICY IF EXISTS "offerings_authenticated_all" ON public.course_offerings;
DROP POLICY IF EXISTS "students_authenticated_all" ON public.students;
DROP POLICY IF EXISTS "enrollments_authenticated_all" ON public.enrollments;
DROP POLICY IF EXISTS "student_marks_authenticated_all" ON public.student_marks;
DROP POLICY IF EXISTS "assessment_components_authenticated_all" ON public.assessment_components;
DROP POLICY IF EXISTS "course_outcomes_authenticated_all" ON public.course_outcomes;
DROP POLICY IF EXISTS "course_po_mappings_authenticated_all" ON public.course_po_mappings;
DROP POLICY IF EXISTS "report_runs_authenticated_all" ON public.report_runs;

-- 2. Correct handle_new_user() trigger function
-- Assigns role 'teacher' by default instead of unconditional 'department_admin'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_dept_id UUID;
    v_assigned_role VARCHAR(50);
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

    -- Validate role from metadata (only allow 'hod' or 'teacher'; default to 'teacher')
    v_assigned_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'));
    IF v_assigned_role NOT IN ('teacher', 'hod') THEN
        v_assigned_role := 'teacher';
    END IF;

    -- Insert membership with least-privilege role
    INSERT INTO public.department_memberships (profile_id, department_id, role, is_active)
    VALUES (NEW.id, v_dept_id, v_assigned_role::public.user_role, true)
    ON CONFLICT (profile_id, department_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure Strict Scoped Policies on Core Tables

-- Course Offerings: Teachers can read their assigned offerings, HODs can read/manage department offerings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'offerings_teacher_select' AND tablename = 'course_offerings') THEN
        CREATE POLICY "offerings_teacher_select" ON public.course_offerings
            FOR SELECT TO authenticated
            USING (
                teacher_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.courses c
                    JOIN public.department_memberships dm ON dm.department_id = c.department_id
                    WHERE c.id = course_offerings.course_id
                      AND dm.profile_id = auth.uid()
                      AND dm.role IN ('hod', 'department_admin')
                      AND dm.is_active = true
                )
            );
    END IF;

    -- Student Marks: Bound strictly to offering teachers and department HODs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_marks_manage_scoped' AND tablename = 'student_marks') THEN
        CREATE POLICY "student_marks_manage_scoped" ON public.student_marks
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.enrollments e
                    WHERE e.id = student_marks.enrollment_id
                      AND public.can_manage_offering(e.course_offering_id)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.enrollments e
                    WHERE e.id = student_marks.enrollment_id
                      AND public.can_manage_offering(e.course_offering_id)
                )
            );
    END IF;

    -- Report Runs: Bound strictly to offering teachers and department HODs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'report_runs_scoped' AND tablename = 'report_runs') THEN
        CREATE POLICY "report_runs_scoped" ON public.report_runs
            FOR ALL TO authenticated
            USING (public.can_manage_offering(course_offering_id))
            WITH CHECK (public.can_manage_offering(course_offering_id));
    END IF;

    -- Audit Logs: Insert allowed for authenticated actors; SELECT scoped to members
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_logs_insert_scoped' AND tablename = 'audit_logs') THEN
        CREATE POLICY "audit_logs_insert_scoped" ON public.audit_logs
            FOR INSERT TO authenticated
            WITH CHECK (profile_id = auth.uid() OR profile_id IS NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_logs_select_scoped' AND tablename = 'audit_logs') THEN
        CREATE POLICY "audit_logs_select_scoped" ON public.audit_logs
            FOR SELECT TO authenticated
            USING (
                profile_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.department_memberships dm
                    WHERE dm.profile_id = auth.uid()
                      AND dm.role IN ('hod', 'department_admin')
                      AND dm.is_active = true
                )
            );
    END IF;
END $$;
