-- ==============================================================================
-- OutcomeX — Migration 07: Fix Student Department Resolution & Roster Persistence
-- Description:
-- 1. Idempotently guarantees canonical department, academic year, course, and offering exist.
-- 2. Seeds default Course Offering (f0000000-0000-0000-0000-000000000001) for 25UCS623T Section A.
-- 3. Seeds standard assessment components for the offering.
-- 4. Updates RLS policy on students to allow department faculty to manage students in their department.
-- 5. Implements atomic stored procedure enroll_student_in_offering() for reliable student & enrollment creation.
-- ==============================================================================

DO $$
DECLARE
    v_dept_id UUID;
    v_acad_year_id UUID;
    v_scheme_id UUID;
    v_course_id UUID;
    v_profile_id UUID;
    v_offering_id UUID := 'f0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    -- 1. Ensure Department 'CSE' exists
    SELECT id INTO v_dept_id FROM public.departments WHERE code = 'CSE' LIMIT 1;
    IF v_dept_id IS NULL THEN
        INSERT INTO public.departments (id, code, name, institution_name, is_autonomous)
        VALUES (
            'd0000000-0000-0000-0000-000000000001'::uuid,
            'CSE',
            'Computer Science & Engineering',
            'Priyadarshini College of Engineering, Nagpur',
            true
        )
        RETURNING id INTO v_dept_id;
    END IF;

    -- 2. Ensure Academic Year '2025-26' exists for CSE
    SELECT id INTO v_acad_year_id FROM public.academic_years
    WHERE department_id = v_dept_id AND year_label = '2025-26' LIMIT 1;
    IF v_acad_year_id IS NULL THEN
        INSERT INTO public.academic_years (id, department_id, year_label, is_current)
        VALUES (
            'a0000000-0000-0000-0000-000000000001'::uuid,
            v_dept_id,
            '2025-26',
            true
        )
        ON CONFLICT (department_id, year_label) DO UPDATE SET is_current = true
        RETURNING id INTO v_acad_year_id;
    END IF;

    -- 3. Ensure Attainment Scheme 'Autonomous 60/40 Scheme' exists for CSE
    SELECT id INTO v_scheme_id FROM public.attainment_schemes
    WHERE department_id = v_dept_id AND scheme_name = 'Autonomous 60/40 Scheme' LIMIT 1;
    IF v_scheme_id IS NULL THEN
        INSERT INTO public.attainment_schemes (
            id, department_id, scheme_name, version, threshold_percent,
            level_3_threshold, level_2_threshold, direct_weight, indirect_weight,
            iam_weight, esam_weight, po_aggregation_method, is_approved
        ) VALUES (
            '60000000-0000-0000-0000-000000000001'::uuid,
            v_dept_id, 'Autonomous 60/40 Scheme', 1, 45.00,
            55.00, 45.00, 0.80, 0.20,
            0.40, 0.60, 'WEIGHTED_AVERAGE', true
        )
        ON CONFLICT (department_id, scheme_name, version) DO UPDATE SET threshold_percent = EXCLUDED.threshold_percent
        RETURNING id INTO v_scheme_id;
    END IF;

    -- 4. Ensure Course '25UCS623T' exists for CSE
    SELECT id INTO v_course_id FROM public.courses
    WHERE department_id = v_dept_id AND course_code = '25UCS623T' LIMIT 1;
    IF v_course_id IS NULL THEN
        INSERT INTO public.courses (
            id, department_id, course_code, course_name, semester, year_of_study
        ) VALUES (
            'c0000000-0000-0000-0000-000000000001'::uuid,
            v_dept_id, '25UCS623T', 'Introduction to Data Science', '5th Sem', '3rd Yr'
        )
        ON CONFLICT (department_id, course_code) DO UPDATE SET course_name = EXCLUDED.course_name
        RETURNING id INTO v_course_id;
    END IF;

    -- 5. Ensure Profile for teacher exists
    SELECT id INTO v_profile_id FROM public.profiles LIMIT 1;
    IF v_profile_id IS NULL THEN
        INSERT INTO public.profiles (id, email, full_name)
        VALUES (
            'b0000000-0000-0000-0000-000000000001'::uuid,
            'coordinator.cse@pce.edu.in',
            'CSE Course Coordinator'
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id INTO v_profile_id;
    END IF;

    -- 6. Ensure Canonical Course Offering (Section A) exists
    IF NOT EXISTS (SELECT 1 FROM public.course_offerings WHERE id = v_offering_id) THEN
        -- Check if an offering already exists for this course, academic year, and section
        SELECT id INTO v_offering_id FROM public.course_offerings
        WHERE course_id = v_course_id AND academic_year_id = v_acad_year_id AND section = 'A' LIMIT 1;

        IF v_offering_id IS NULL THEN
            v_offering_id := 'f0000000-0000-0000-0000-000000000001'::uuid;
            INSERT INTO public.course_offerings (
                id, course_id, academic_year_id, teacher_id, section, attainment_scheme_id
            ) VALUES (
                v_offering_id,
                v_course_id,
                v_acad_year_id,
                COALESCE(v_profile_id, 'b0000000-0000-0000-0000-000000000001'::uuid),
                'A',
                v_scheme_id
            );
        END IF;
    END IF;

    -- 7. Ensure standard assessment components exist for this offering
    INSERT INTO public.assessment_components (course_offering_id, component_name, max_marks, sort_order)
    VALUES
        (v_offering_id, 'MT1 Q1 (CO1)', 10, 1),
        (v_offering_id, 'MT1 Q2 (CO2)', 10, 2),
        (v_offering_id, 'MT1 Q3 (CO3)', 10, 3),
        (v_offering_id, 'MT2 Q1 (CO4)', 10, 4),
        (v_offering_id, 'MT2 Q2 (CO5)', 10, 5),
        (v_offering_id, 'MT2 Q3 (CO6)', 10, 6),
        (v_offering_id, 'ESE (CO1)', 8, 7),
        (v_offering_id, 'ESE (CO2)', 8, 8),
        (v_offering_id, 'ESE (CO3)', 8, 9),
        (v_offering_id, 'ESE (CO4)', 16, 10),
        (v_offering_id, 'ESE (CO5)', 8, 11),
        (v_offering_id, 'ESE (CO6)', 12, 12),
        (v_offering_id, 'Teacher Assessment (CO5)', 10, 13)
    ON CONFLICT DO NOTHING;

END $$;

-- 8. Correct students RLS Policy: Allow department members to manage students within their department
DROP POLICY IF EXISTS "students_manage" ON public.students;
CREATE POLICY "students_manage" ON public.students
    FOR ALL TO authenticated
    USING (
        department_id IN (SELECT public.get_user_department_ids())
    )
    WITH CHECK (
        department_id IN (SELECT public.get_user_department_ids())
    );

-- 9. Correct enrollments RLS Policy: Allow teachers who can manage the offering to manage enrollments
DROP POLICY IF EXISTS "enrollments_manage" ON public.enrollments;
CREATE POLICY "enrollments_manage" ON public.enrollments
    FOR ALL TO authenticated
    USING (public.can_manage_offering(course_offering_id))
    WITH CHECK (public.can_manage_offering(course_offering_id));

-- 10. Atomic stored procedure for reliable student enrollment
CREATE OR REPLACE FUNCTION public.enroll_student_in_offering(
    p_offering_id UUID,
    p_roll_no VARCHAR,
    p_student_name VARCHAR,
    p_status VARCHAR DEFAULT 'ENROLLED'
)
RETURNS JSONB AS $$
DECLARE
    v_dept_id UUID;
    v_student_id UUID;
    v_enrollment_id UUID;
    v_clean_roll VARCHAR;
    v_clean_name VARCHAR;
BEGIN
    v_clean_roll := TRIM(p_roll_no);
    v_clean_name := TRIM(p_student_name);

    IF v_clean_roll IS NULL OR v_clean_roll = '' THEN
        RAISE EXCEPTION 'Roll number cannot be empty';
    END IF;

    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'Student name cannot be empty';
    END IF;

    -- 1. Resolve department from offering and associated course
    SELECT c.department_id INTO v_dept_id
    FROM public.course_offerings co
    JOIN public.courses c ON co.course_id = c.id
    WHERE co.id = p_offering_id;

    IF v_dept_id IS NULL THEN
        RAISE EXCEPTION 'Course offering % has no valid course or department association', p_offering_id;
    END IF;

    -- 2. Verify department exists
    IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_dept_id) THEN
        RAISE EXCEPTION 'Department % associated with offering % does not exist in database', v_dept_id, p_offering_id;
    END IF;

    -- 3. Check for existing enrollment in this offering
    SELECT id INTO v_enrollment_id
    FROM public.enrollments
    WHERE course_offering_id = p_offering_id AND LOWER(roll_no) = LOWER(v_clean_roll);

    IF v_enrollment_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'duplicate',
            'message', 'Student with roll ' || v_clean_roll || ' is already enrolled in this offering',
            'enrollment_id', v_enrollment_id
        );
    END IF;

    -- 4. Find or create canonical student in the department
    SELECT id INTO v_student_id
    FROM public.students
    WHERE department_id = v_dept_id AND LOWER(university_reg_no) = LOWER(v_clean_roll);

    IF v_student_id IS NULL THEN
        INSERT INTO public.students (department_id, university_reg_no, student_name)
        VALUES (v_dept_id, v_clean_roll, v_clean_name)
        RETURNING id INTO v_student_id;
    END IF;

    -- 5. Insert unique enrollment for this offering
    INSERT INTO public.enrollments (course_offering_id, student_id, roll_no, status)
    VALUES (p_offering_id, v_student_id, v_clean_roll, COALESCE(p_status, 'ENROLLED'))
    RETURNING id INTO v_enrollment_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'created',
        'enrollment_id', v_enrollment_id,
        'student_id', v_student_id,
        'roll_no', v_clean_roll,
        'student_name', v_clean_name,
        'department_id', v_dept_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
