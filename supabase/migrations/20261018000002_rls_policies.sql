-- ==============================================================================
-- OutcomeX — Migration 02: Row Level Security (RLS) & Department Authorization
-- Description: Enforces strict data isolation by department and course assignment
-- ==============================================================================

-- ==============================================================================
-- 1. Enable RLS on All Tables
-- ==============================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attainment_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_po_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_component_co_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indirect_attainment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. Security Helper Functions
-- ==============================================================================

-- Get all department IDs where current user is an active member
CREATE OR REPLACE FUNCTION public.get_user_department_ids()
RETURNS SETOF UUID AS $$
    SELECT department_id FROM public.department_memberships
    WHERE profile_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is an active department admin for a department
CREATE OR REPLACE FUNCTION public.is_department_admin(dept_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.department_memberships
        WHERE profile_id = auth.uid()
          AND department_id = dept_id
          AND role = 'department_admin'
          AND is_active = true
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is an active HOD or admin for a department
CREATE OR REPLACE FUNCTION public.is_hod_or_admin(dept_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.department_memberships
        WHERE profile_id = auth.uid()
          AND department_id = dept_id
          AND role IN ('hod', 'department_admin')
          AND is_active = true
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is the assigned teacher of a course offering
CREATE OR REPLACE FUNCTION public.is_offering_teacher(offering_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.course_offerings
        WHERE id = offering_id AND teacher_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user has management access to a course offering (teacher OR HOD/Admin)
CREATE OR REPLACE FUNCTION public.can_manage_offering(offering_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.course_offerings co
        JOIN public.courses c ON co.course_id = c.id
        WHERE co.id = offering_id
          AND (
              co.teacher_id = auth.uid()
              OR public.is_hod_or_admin(c.department_id)
          )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 3. Department & Profile Policies
-- ==============================================================================

-- Profiles: Users can view profiles in their departments, edit their own
CREATE POLICY "profiles_select_dept" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR id IN (
            SELECT dm.profile_id FROM public.department_memberships dm
            WHERE dm.department_id IN (SELECT public.get_user_department_ids())
        )
    );

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Departments: Members can view their department
CREATE POLICY "departments_select_member" ON public.departments
    FOR SELECT TO authenticated
    USING (id IN (SELECT public.get_user_department_ids()));

CREATE POLICY "departments_admin_all" ON public.departments
    FOR ALL TO authenticated
    USING (public.is_department_admin(id))
    WITH CHECK (public.is_department_admin(id));

-- Department Memberships: View memberships in same department
CREATE POLICY "memberships_select" ON public.department_memberships
    FOR SELECT TO authenticated
    USING (department_id IN (SELECT public.get_user_department_ids()));

CREATE POLICY "memberships_admin_manage" ON public.department_memberships
    FOR ALL TO authenticated
    USING (public.is_department_admin(department_id))
    WITH CHECK (public.is_department_admin(department_id));

-- ==============================================================================
-- 4. Academic Planning, Schemes, and Catalogs
-- ==============================================================================

-- Academic Years
CREATE POLICY "academic_years_select" ON public.academic_years
    FOR SELECT TO authenticated
    USING (department_id IN (SELECT public.get_user_department_ids()));

CREATE POLICY "academic_years_manage" ON public.academic_years
    FOR ALL TO authenticated
    USING (public.is_hod_or_admin(department_id))
    WITH CHECK (public.is_hod_or_admin(department_id));

-- Attainment Schemes
CREATE POLICY "attainment_schemes_select" ON public.attainment_schemes
    FOR SELECT TO authenticated
    USING (department_id IN (SELECT public.get_user_department_ids()));

CREATE POLICY "attainment_schemes_manage" ON public.attainment_schemes
    FOR ALL TO authenticated
    USING (public.is_hod_or_admin(department_id))
    WITH CHECK (public.is_hod_or_admin(department_id));

-- Template Versions (Global read, admin manage)
CREATE POLICY "template_versions_select" ON public.template_versions
    FOR SELECT TO authenticated
    USING (is_active = true);

CREATE POLICY "template_versions_admin" ON public.template_versions
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.department_memberships
        WHERE profile_id = auth.uid() AND role = 'department_admin'
    ));

-- Courses
CREATE POLICY "courses_select" ON public.courses
    FOR SELECT TO authenticated
    USING (department_id IN (SELECT public.get_user_department_ids()));

CREATE POLICY "courses_manage" ON public.courses
    FOR ALL TO authenticated
    USING (public.is_hod_or_admin(department_id))
    WITH CHECK (public.is_hod_or_admin(department_id));

-- Course Offerings: Teachers view their offerings, HOD/Admins view all department offerings
CREATE POLICY "offerings_select" ON public.course_offerings
    FOR SELECT TO authenticated
    USING (
        teacher_id = auth.uid()
        OR course_id IN (
            SELECT id FROM public.courses WHERE department_id IN (SELECT public.get_user_department_ids())
        )
    );

CREATE POLICY "offerings_manage" ON public.course_offerings
    FOR ALL TO authenticated
    USING (
        teacher_id = auth.uid()
        OR course_id IN (
            SELECT id FROM public.courses WHERE public.is_hod_or_admin(department_id)
        )
    );

-- Course Outcomes & POs & Mappings
CREATE POLICY "course_outcomes_select" ON public.course_outcomes
    FOR SELECT TO authenticated
    USING (course_id IN (
        SELECT id FROM public.courses WHERE department_id IN (SELECT public.get_user_department_ids())
    ));

CREATE POLICY "course_outcomes_manage" ON public.course_outcomes
    FOR ALL TO authenticated
    USING (course_id IN (
        SELECT id FROM public.courses WHERE public.is_hod_or_admin(department_id)
    ));

CREATE POLICY "program_outcomes_select" ON public.program_outcomes
    FOR SELECT TO authenticated
    USING (department_id IN (SELECT public.get_user_department_ids()));

CREATE POLICY "program_outcomes_manage" ON public.program_outcomes
    FOR ALL TO authenticated
    USING (public.is_hod_or_admin(department_id));

CREATE POLICY "course_po_mappings_select" ON public.course_po_mappings
    FOR SELECT TO authenticated
    USING (course_outcome_id IN (
        SELECT co.id FROM public.course_outcomes co
        JOIN public.courses c ON co.course_id = c.id
        WHERE c.department_id IN (SELECT public.get_user_department_ids())
    ));

CREATE POLICY "course_po_mappings_manage" ON public.course_po_mappings
    FOR ALL TO authenticated
    USING (course_outcome_id IN (
        SELECT co.id FROM public.course_outcomes co
        JOIN public.courses c ON co.course_id = c.id
        WHERE public.is_hod_or_admin(c.department_id)
    ));

-- ==============================================================================
-- 5. Student Roster, Assessment Components, and Marks Protection
-- ==============================================================================

-- Students Master
CREATE POLICY "students_select" ON public.students
    FOR SELECT TO authenticated
    USING (department_id IN (SELECT public.get_user_department_ids()));

CREATE POLICY "students_manage" ON public.students
    FOR ALL TO authenticated
    USING (public.is_hod_or_admin(department_id));

-- Enrollments: Viewable if user can manage offering or is HOD/Admin
CREATE POLICY "enrollments_select" ON public.enrollments
    FOR SELECT TO authenticated
    USING (public.can_manage_offering(course_offering_id));

CREATE POLICY "enrollments_manage" ON public.enrollments
    FOR ALL TO authenticated
    USING (public.can_manage_offering(course_offering_id))
    WITH CHECK (public.can_manage_offering(course_offering_id));

-- Assessment Components
CREATE POLICY "assessment_comp_select" ON public.assessment_components
    FOR SELECT TO authenticated
    USING (public.can_manage_offering(course_offering_id));

CREATE POLICY "assessment_comp_manage" ON public.assessment_components
    FOR ALL TO authenticated
    USING (public.can_manage_offering(course_offering_id))
    WITH CHECK (public.can_manage_offering(course_offering_id));

-- Assessment Component CO Mappings
CREATE POLICY "assessment_comp_co_select" ON public.assessment_component_co_mappings
    FOR SELECT TO authenticated
    USING (assessment_component_id IN (
        SELECT id FROM public.assessment_components WHERE public.can_manage_offering(course_offering_id)
    ));

CREATE POLICY "assessment_comp_co_manage" ON public.assessment_component_co_mappings
    FOR ALL TO authenticated
    USING (assessment_component_id IN (
        SELECT id FROM public.assessment_components WHERE public.can_manage_offering(course_offering_id)
    ));

-- Student Marks: TEACHER COURSE BOUNDARY (CRITICAL SECURITY)
-- Teachers can ONLY select/insert/update marks for their OWN course offerings!
CREATE POLICY "student_marks_select" ON public.student_marks
    FOR SELECT TO authenticated
    USING (enrollment_id IN (
        SELECT e.id FROM public.enrollments e
        WHERE public.can_manage_offering(e.course_offering_id)
    ));

CREATE POLICY "student_marks_manage" ON public.student_marks
    FOR ALL TO authenticated
    USING (enrollment_id IN (
        SELECT e.id FROM public.enrollments e
        WHERE public.can_manage_offering(e.course_offering_id)
    ))
    WITH CHECK (enrollment_id IN (
        SELECT e.id FROM public.enrollments e
        WHERE public.can_manage_offering(e.course_offering_id)
    ));

-- Indirect Attainment
CREATE POLICY "indirect_attainment_select" ON public.indirect_attainment
    FOR SELECT TO authenticated
    USING (public.can_manage_offering(course_offering_id));

CREATE POLICY "indirect_attainment_manage" ON public.indirect_attainment
    FOR ALL TO authenticated
    USING (public.can_manage_offering(course_offering_id))
    WITH CHECK (public.can_manage_offering(course_offering_id));

-- ==============================================================================
-- 6. Reports & Audit Trail
-- ==============================================================================

-- Report Runs: Accessible only to assigned teacher or department HOD/Admin
CREATE POLICY "report_runs_select" ON public.report_runs
    FOR SELECT TO authenticated
    USING (public.can_manage_offering(course_offering_id));

CREATE POLICY "report_runs_insert" ON public.report_runs
    FOR INSERT TO authenticated
    WITH CHECK (public.can_manage_offering(course_offering_id));

-- Audit Logs: Insert own events, viewable by department admin
CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid());

CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.department_memberships
        WHERE profile_id = auth.uid() AND role = 'department_admin'
    ));
