-- ==============================================================================
-- OutcomeX — Migration 03: Seed Reference Department, Schemes, Outcomes & Mappings
-- Description: Seeds PCE Nagpur CSE department, 2025-26, Schemes, PO1-12, PSO1-2, and Course IDS
-- ==============================================================================

DO $$
DECLARE
    v_dept_id UUID;
    v_acad_year_id UUID;
    v_scheme_60_40_id UUID;
    v_scheme_30_20_id UUID;
    v_template_60_id UUID;
    v_template_30_id UUID;
    v_course_id UUID;
    v_co1_id UUID; v_co2_id UUID; v_co3_id UUID; v_co4_id UUID; v_co5_id UUID; v_co6_id UUID;
    v_po1_id UUID; v_po2_id UUID; v_po3_id UUID; v_po4_id UUID; v_po5_id UUID; v_po6_id UUID;
    v_po7_id UUID; v_po8_id UUID; v_po9_id UUID; v_po10_id UUID; v_po11_id UUID; v_po12_id UUID;
    v_pso1_id UUID; v_pso2_id UUID;
BEGIN
    -- 1. Insert Department: Computer Science & Engineering
    INSERT INTO public.departments (code, name, institution_name, is_autonomous)
    VALUES ('CSE', 'Computer Science & Engineering', 'Priyadarshini College of Engineering, Nagpur', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_dept_id;

    -- 2. Insert Academic Year: 2025-26
    INSERT INTO public.academic_years (department_id, year_label, is_current)
    VALUES (v_dept_id, '2025-26', true)
    ON CONFLICT (department_id, year_label) DO UPDATE SET is_current = true
    RETURNING id INTO v_acad_year_id;

    -- 3. Insert Attainment Schemes
    -- 60/40 Scheme
    INSERT INTO public.attainment_schemes (
        department_id, scheme_name, version, threshold_percent,
        level_3_threshold, level_2_threshold, direct_weight, indirect_weight,
        iam_weight, esam_weight, po_aggregation_method, is_approved
    ) VALUES (
        v_dept_id, 'Autonomous 60/40 Scheme', 1, 45.00,
        55.00, 45.00, 0.80, 0.20,
        0.40, 0.60, 'WEIGHTED_AVERAGE', true
    )
    ON CONFLICT (department_id, scheme_name, version) DO UPDATE SET threshold_percent = EXCLUDED.threshold_percent
    RETURNING id INTO v_scheme_60_40_id;

    -- 30/20 Scheme
    INSERT INTO public.attainment_schemes (
        department_id, scheme_name, version, threshold_percent,
        level_3_threshold, level_2_threshold, direct_weight, indirect_weight,
        iam_weight, esam_weight, po_aggregation_method, is_approved
    ) VALUES (
        v_dept_id, 'Autonomous 30/20 Scheme', 1, 45.00,
        55.00, 45.00, 0.80, 0.20,
        0.40, 0.60, 'WEIGHTED_AVERAGE', true
    )
    ON CONFLICT (department_id, scheme_name, version) DO UPDATE SET threshold_percent = EXCLUDED.threshold_percent
    RETURNING id INTO v_scheme_30_20_id;

    -- 4. Insert Template Versions
    INSERT INTO public.template_versions (
        template_name, version, file_sha256, storage_path, sheet_name, adapter_identifier, is_active
    ) VALUES (
        '60_40_v1', 'v1.0',
        '497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477',
        'templates/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx',
        'For 60_40 (final)', 'Adapter60_40', true
    )
    ON CONFLICT (template_name, version) DO UPDATE SET file_sha256 = EXCLUDED.file_sha256
    RETURNING id INTO v_template_60_id;

    INSERT INTO public.template_versions (
        template_name, version, file_sha256, storage_path, sheet_name, adapter_identifier, is_active
    ) VALUES (
        '30_20_v1', 'v1.0',
        '497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477',
        'templates/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx',
        'For 30_20 (Final)', 'Adapter30_20', true
    )
    ON CONFLICT (template_name, version) DO UPDATE SET file_sha256 = EXCLUDED.file_sha256
    RETURNING id INTO v_template_30_id;

    -- 5. Insert Program Outcomes (NBA Criteria 1-12) and PSOs
    INSERT INTO public.program_outcomes (department_id, po_code, po_type, sort_order, description)
    VALUES
        (v_dept_id, 'PO1', 'PO', 1, 'Engineering knowledge: Apply knowledge of mathematics, science, engineering fundamentals.'),
        (v_dept_id, 'PO2', 'PO', 2, 'Problem analysis: Identify, formulate, and analyze complex engineering problems.'),
        (v_dept_id, 'PO3', 'PO', 3, 'Design/development of solutions: Design solutions for complex engineering problems.'),
        (v_dept_id, 'PO4', 'PO', 4, 'Conduct investigations of complex problems: Use research-based knowledge and methods.'),
        (v_dept_id, 'PO5', 'PO', 5, 'Modern tool usage: Create, select, and apply appropriate techniques and resources.'),
        (v_dept_id, 'PO6', 'PO', 6, 'The engineer and society: Apply reasoning informed by contextual knowledge.'),
        (v_dept_id, 'PO7', 'PO', 7, 'Environment and sustainability: Understand the impact of professional engineering solutions.'),
        (v_dept_id, 'PO8', 'PO', 8, 'Ethics: Apply ethical principles and commit to professional ethics and responsibilities.'),
        (v_dept_id, 'PO9', 'PO', 9, 'Individual and team work: Function effectively as an individual and as a member or leader.'),
        (v_dept_id, 'PO10', 'PO', 10, 'Communication: Communicate effectively on complex engineering activities.'),
        (v_dept_id, 'PO11', 'PO', 11, 'Project management and finance: Demonstrate knowledge and understanding of management principles.'),
        (v_dept_id, 'PO12', 'PO', 12, 'Life-long learning: Recognize the need for and have preparation for lifelong learning.'),
        (v_dept_id, 'PSO 1', 'PSO', 13, 'Professional Skills: Ability to analyze, design and develop computer-based systems.'),
        (v_dept_id, 'PSO 2', 'PSO', 14, 'Problem-Solving Skills: Ability to apply standard practices in software engineering.')
    ON CONFLICT (department_id, po_code) DO UPDATE SET description = EXCLUDED.description;

    -- Retrieve PO IDs
    SELECT id INTO v_po1_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO1';
    SELECT id INTO v_po2_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO2';
    SELECT id INTO v_po3_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO3';
    SELECT id INTO v_po4_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO4';
    SELECT id INTO v_po5_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO5';
    SELECT id INTO v_po6_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO6';
    SELECT id INTO v_po7_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO7';
    SELECT id INTO v_po8_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO8';
    SELECT id INTO v_po9_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO9';
    SELECT id INTO v_po10_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO10';
    SELECT id INTO v_po11_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO11';
    SELECT id INTO v_po12_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PO12';
    SELECT id INTO v_pso1_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PSO 1';
    SELECT id INTO v_pso2_id FROM public.program_outcomes WHERE department_id = v_dept_id AND po_code = 'PSO 2';

    -- 6. Insert Reference Course: Introduction to Data Science (IDS)
    INSERT INTO public.courses (department_id, course_code, course_name, semester, year_of_study)
    VALUES (v_dept_id, '25UCS623T', 'Introduction to Data Science', '5th Sem', '3rd Yr')
    ON CONFLICT (department_id, course_code) DO UPDATE SET course_name = EXCLUDED.course_name
    RETURNING id INTO v_course_id;

    -- 7. Insert Course Outcomes (CO1..CO6)
    INSERT INTO public.course_outcomes (course_id, co_code, description, sort_order)
    VALUES
        (v_course_id, 'CO1', 'Understand foundational principles and workflow of data science', 1),
        (v_course_id, 'CO2', 'Apply data preprocessing, wrangling, and exploratory data analysis', 2),
        (v_course_id, 'CO3', 'Formulate and implement statistical inference and regression models', 3),
        (v_course_id, 'CO4', 'Apply classification, clustering, and unsupervised learning algorithms', 4),
        (v_course_id, 'CO5', 'Evaluate model performance using standard validation metrics', 5),
        (v_course_id, 'CO6', 'Communicate data-driven insights through effective visualization', 6)
    ON CONFLICT (course_id, co_code) DO UPDATE SET description = EXCLUDED.description;

    SELECT id INTO v_co1_id FROM public.course_outcomes WHERE course_id = v_course_id AND co_code = 'CO1';
    SELECT id INTO v_co2_id FROM public.course_outcomes WHERE course_id = v_course_id AND co_code = 'CO2';
    SELECT id INTO v_co3_id FROM public.course_outcomes WHERE course_id = v_course_id AND co_code = 'CO3';
    SELECT id INTO v_co4_id FROM public.course_outcomes WHERE course_id = v_course_id AND co_code = 'CO4';
    SELECT id INTO v_co5_id FROM public.course_outcomes WHERE course_id = v_course_id AND co_code = 'CO5';
    SELECT id INTO v_co6_id FROM public.course_outcomes WHERE course_id = v_course_id AND co_code = 'CO6';

    -- 8. Seed Course-to-PO Mappings (Verified exactly from Reference Workbook Row 15 to 20)
    -- CO1 mappings
    INSERT INTO public.course_po_mappings (course_outcome_id, program_outcome_id, mapping_strength)
    VALUES
        (v_co1_id, v_po1_id, 3), (v_co1_id, v_po2_id, 2), (v_co1_id, v_po5_id, 2), (v_co1_id, v_po7_id, 1),
        (v_co1_id, v_po9_id, 1), (v_co1_id, v_po11_id, 2), (v_co1_id, v_pso1_id, 2), (v_co1_id, v_pso2_id, 2)
    ON CONFLICT (course_outcome_id, program_outcome_id) DO UPDATE SET mapping_strength = EXCLUDED.mapping_strength;

    -- CO2 mappings
    INSERT INTO public.course_po_mappings (course_outcome_id, program_outcome_id, mapping_strength)
    VALUES
        (v_co2_id, v_po1_id, 3), (v_co2_id, v_po2_id, 3), (v_co2_id, v_po3_id, 2), (v_co2_id, v_po4_id, 2),
        (v_co2_id, v_po5_id, 2), (v_co2_id, v_po7_id, 1), (v_co2_id, v_po8_id, 1), (v_co2_id, v_po9_id, 2),
        (v_co2_id, v_po10_id, 1), (v_co2_id, v_po11_id, 2), (v_co2_id, v_pso1_id, 2), (v_co2_id, v_pso2_id, 2)
    ON CONFLICT (course_outcome_id, program_outcome_id) DO UPDATE SET mapping_strength = EXCLUDED.mapping_strength;

    -- CO3 mappings
    INSERT INTO public.course_po_mappings (course_outcome_id, program_outcome_id, mapping_strength)
    VALUES
        (v_co3_id, v_po1_id, 3), (v_co3_id, v_po2_id, 3), (v_co3_id, v_po3_id, 2), (v_co3_id, v_po4_id, 2),
        (v_co3_id, v_po5_id, 3), (v_co3_id, v_po7_id, 1), (v_co3_id, v_po9_id, 1), (v_co3_id, v_po10_id, 1),
        (v_co3_id, v_po11_id, 3), (v_co3_id, v_pso1_id, 2), (v_co3_id, v_pso2_id, 2)
    ON CONFLICT (course_outcome_id, program_outcome_id) DO UPDATE SET mapping_strength = EXCLUDED.mapping_strength;

    -- CO4 mappings
    INSERT INTO public.course_po_mappings (course_outcome_id, program_outcome_id, mapping_strength)
    VALUES
        (v_co4_id, v_po1_id, 3), (v_co4_id, v_po2_id, 3), (v_co4_id, v_po3_id, 2), (v_co4_id, v_po4_id, 3),
        (v_co4_id, v_po5_id, 2), (v_co4_id, v_po7_id, 1), (v_co4_id, v_po9_id, 1), (v_co4_id, v_po10_id, 1),
        (v_co4_id, v_po11_id, 3), (v_co4_id, v_pso1_id, 2), (v_co4_id, v_pso2_id, 2)
    ON CONFLICT (course_outcome_id, program_outcome_id) DO UPDATE SET mapping_strength = EXCLUDED.mapping_strength;

    -- CO5 mappings
    INSERT INTO public.course_po_mappings (course_outcome_id, program_outcome_id, mapping_strength)
    VALUES
        (v_co5_id, v_po1_id, 2), (v_co5_id, v_po2_id, 2), (v_co5_id, v_po3_id, 2), (v_co5_id, v_po4_id, 3),
        (v_co5_id, v_po5_id, 3), (v_co5_id, v_po7_id, 1), (v_co5_id, v_po9_id, 1), (v_co5_id, v_po10_id, 1),
        (v_co5_id, v_po11_id, 3), (v_co5_id, v_pso1_id, 2), (v_co5_id, v_pso2_id, 2)
    ON CONFLICT (course_outcome_id, program_outcome_id) DO UPDATE SET mapping_strength = EXCLUDED.mapping_strength;

    -- CO6 mappings
    INSERT INTO public.course_po_mappings (course_outcome_id, program_outcome_id, mapping_strength)
    VALUES
        (v_co6_id, v_po1_id, 2), (v_co6_id, v_po2_id, 3), (v_co6_id, v_po3_id, 2), (v_co6_id, v_po4_id, 3),
        (v_co6_id, v_po5_id, 3), (v_co6_id, v_po7_id, 2), (v_co6_id, v_po8_id, 1), (v_co6_id, v_po9_id, 3),
        (v_co6_id, v_po10_id, 1), (v_co6_id, v_po11_id, 3), (v_co6_id, v_pso1_id, 2), (v_co6_id, v_pso2_id, 2)
    ON CONFLICT (course_outcome_id, program_outcome_id) DO UPDATE SET mapping_strength = EXCLUDED.mapping_strength;

END $$;
