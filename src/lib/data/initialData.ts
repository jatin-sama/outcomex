import {
  Department,
  AcademicYear,
  AttainmentScheme,
  Course,
  CourseOffering,
  CourseOutcome,
  ProgramOutcome,
  CoursePOMapping,
  AssessmentComponent,
  Student,
  Enrollment,
} from "@/types/database";

// Authoritative reference constants seeded with PCE Nagpur CSE 2025-26 data
// All IDs are strictly valid RFC 4122 hexadecimal UUID strings.
export const INITIAL_DEPARTMENT: Department = {
  id: "d0000000-0000-0000-0000-000000000001",
  code: "CSE",
  name: "Computer Science & Engineering",
  institution_name: "Priyadarshini College of Engineering, Nagpur",
  is_autonomous: true,
  created_at: "2026-10-18T00:00:00.000Z",
  updated_at: "2026-10-18T00:00:00.000Z",
};

export const INITIAL_ACADEMIC_YEAR: AcademicYear = {
  id: "a0000000-0000-0000-0000-000000000001",
  department_id: INITIAL_DEPARTMENT.id,
  year_label: "2025-26",
  is_current: true,
  created_at: "2026-10-18T00:00:00.000Z",
  updated_at: "2026-10-18T00:00:00.000Z",
};

export const INITIAL_SCHEMES: AttainmentScheme[] = [
  {
    id: "60000000-0000-0000-0000-000000000001",
    department_id: INITIAL_DEPARTMENT.id,
    scheme_name: "Autonomous 60/40 Scheme",
    version: 1,
    threshold_percent: 45.0,
    level_3_threshold: 55.0,
    level_2_threshold: 45.0,
    direct_weight: 0.8,
    indirect_weight: 0.2,
    iam_weight: 0.4,
    esam_weight: 0.6,
    po_aggregation_method: "WEIGHTED_AVERAGE",
    is_approved: true,
    config_json: {
      mt1_max: 30,
      mt2_max: 30,
      ta_max: 10,
      ese_max: 60,
    },
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "30000000-0000-0000-0000-000000000002",
    department_id: INITIAL_DEPARTMENT.id,
    scheme_name: "Autonomous 30/20 Scheme",
    version: 1,
    threshold_percent: 45.0,
    level_3_threshold: 55.0,
    level_2_threshold: 45.0,
    direct_weight: 0.8,
    indirect_weight: 0.2,
    iam_weight: 0.4,
    esam_weight: 0.6,
    po_aggregation_method: "WEIGHTED_AVERAGE",
    is_approved: true,
    config_json: {
      mt1_max: 20,
      mt2_max: 20,
      ta_max: 10,
      ese_max: 30,
    },
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
];

export const INITIAL_COURSE: Course = {
  id: "c0000000-0000-0000-0000-000000000001",
  department_id: INITIAL_DEPARTMENT.id,
  course_code: "25UCS623T",
  course_name: "Introduction to Data Science",
  semester: "5th Sem",
  year_of_study: "3rd Yr",
  created_at: "2026-10-18T00:00:00.000Z",
  updated_at: "2026-10-18T00:00:00.000Z",
};

export const INITIAL_OFFERING: CourseOffering = {
  id: "f0000000-0000-0000-0000-000000000001",
  course_id: INITIAL_COURSE.id,
  academic_year_id: INITIAL_ACADEMIC_YEAR.id,
  teacher_id: "b0000000-0000-0000-0000-000000000001",
  section: "A",
  attainment_scheme_id: INITIAL_SCHEMES[0].id,
  template_version_id: "70000000-0000-0000-0000-000000000001",
  created_at: "2026-10-18T00:00:00.000Z",
  updated_at: "2026-10-18T00:00:00.000Z",
  course: INITIAL_COURSE,
  academic_year: INITIAL_ACADEMIC_YEAR,
  attainment_scheme: INITIAL_SCHEMES[0],
};

export const INITIAL_COS: CourseOutcome[] = [
  {
    id: "c0000000-0000-0000-0001-000000000001",
    course_id: INITIAL_COURSE.id,
    co_code: "CO1",
    description: "Understand foundational principles and workflow of data science",
    sort_order: 1,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0001-000000000002",
    course_id: INITIAL_COURSE.id,
    co_code: "CO2",
    description: "Apply data preprocessing, wrangling, and exploratory data analysis",
    sort_order: 2,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0001-000000000003",
    course_id: INITIAL_COURSE.id,
    co_code: "CO3",
    description: "Formulate and implement statistical inference and regression models",
    sort_order: 3,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0001-000000000004",
    course_id: INITIAL_COURSE.id,
    co_code: "CO4",
    description: "Apply classification, clustering, and unsupervised learning algorithms",
    sort_order: 4,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0001-000000000005",
    course_id: INITIAL_COURSE.id,
    co_code: "CO5",
    description: "Evaluate model performance using standard validation metrics",
    sort_order: 5,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "c0000000-0000-0000-0001-000000000006",
    course_id: INITIAL_COURSE.id,
    co_code: "CO6",
    description: "Communicate data-driven insights through effective visualization",
    sort_order: 6,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
];

export const INITIAL_POS: ProgramOutcome[] = [
  { id: "b0000000-0000-0000-0001-000000000001", department_id: INITIAL_DEPARTMENT.id, po_code: "PO1", po_type: "PO", description: "Engineering Knowledge", sort_order: 1, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000002", department_id: INITIAL_DEPARTMENT.id, po_code: "PO2", po_type: "PO", description: "Problem Analysis", sort_order: 2, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000003", department_id: INITIAL_DEPARTMENT.id, po_code: "PO3", po_type: "PO", description: "Design/Development of Solutions", sort_order: 3, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000004", department_id: INITIAL_DEPARTMENT.id, po_code: "PO4", po_type: "PO", description: "Conduct Investigations of Complex Problems", sort_order: 4, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000005", department_id: INITIAL_DEPARTMENT.id, po_code: "PO5", po_type: "PO", description: "Modern Tool Usage", sort_order: 5, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000006", department_id: INITIAL_DEPARTMENT.id, po_code: "PO6", po_type: "PO", description: "The Engineer and Society", sort_order: 6, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000007", department_id: INITIAL_DEPARTMENT.id, po_code: "PO7", po_type: "PO", description: "Environment and Sustainability", sort_order: 7, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000008", department_id: INITIAL_DEPARTMENT.id, po_code: "PO8", po_type: "PO", description: "Ethics", sort_order: 8, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000009", department_id: INITIAL_DEPARTMENT.id, po_code: "PO9", po_type: "PO", description: "Individual and Team Work", sort_order: 9, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000010", department_id: INITIAL_DEPARTMENT.id, po_code: "PO10", po_type: "PO", description: "Communication", sort_order: 10, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000011", department_id: INITIAL_DEPARTMENT.id, po_code: "PO11", po_type: "PO", description: "Project Management and Finance", sort_order: 11, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0001-000000000012", department_id: INITIAL_DEPARTMENT.id, po_code: "PO12", po_type: "PO", description: "Life-long Learning", sort_order: 12, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0002-000000000001", department_id: INITIAL_DEPARTMENT.id, po_code: "PSO 1", po_type: "PSO", description: "Professional Skills", sort_order: 13, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "b0000000-0000-0000-0002-000000000002", department_id: INITIAL_DEPARTMENT.id, po_code: "PSO 2", po_type: "PSO", description: "Problem-Solving Skills", sort_order: 14, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
];

// Initial 14 PO mappings for the 6 COs exactly from reference sheet
export const INITIAL_MAPPINGS: Record<string, Record<string, number | null>> = {
  CO1: { PO1: 3, PO2: 2, PO5: 2, PO7: 1, PO9: 1, PO11: 2, "PSO 1": 2, "PSO 2": 2 },
  CO2: { PO1: 3, PO2: 3, PO3: 2, PO4: 2, PO5: 2, PO7: 1, PO8: 1, PO9: 2, PO10: 1, PO11: 2, "PSO 1": 2, "PSO 2": 2 },
  CO3: { PO1: 3, PO2: 3, PO3: 2, PO4: 2, PO5: 3, PO7: 1, PO9: 1, PO10: 1, PO11: 3, "PSO 1": 2, "PSO 2": 2 },
  CO4: { PO1: 3, PO2: 3, PO3: 2, PO4: 3, PO5: 2, PO7: 1, PO9: 1, PO10: 1, PO11: 3, "PSO 1": 2, "PSO 2": 2 },
  CO5: { PO1: 2, PO2: 2, PO3: 2, PO4: 3, PO5: 3, PO7: 1, PO9: 1, PO10: 1, PO11: 3, "PSO 1": 2, "PSO 2": 2 },
  CO6: { PO1: 2, PO2: 3, PO3: 2, PO4: 3, PO5: 3, PO7: 2, PO8: 1, PO9: 3, PO10: 1, PO11: 3, "PSO 1": 2, "PSO 2": 2 },
};

// Initial assessment components for 60/40 IDS
export const INITIAL_ASSESSMENTS: AssessmentComponent[] = [
  { id: "e0000000-0000-0000-0001-000000000001", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_1", component_name: "MT1 Q1 (CO1)", max_marks: 10, sort_order: 1, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000002", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_1", component_name: "MT1 Q2 (CO2)", max_marks: 10, sort_order: 2, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000003", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_1", component_name: "MT1 Q3 (CO3)", max_marks: 10, sort_order: 3, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000004", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_2", component_name: "MT2 Q1 (CO4)", max_marks: 10, sort_order: 4, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000005", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_2", component_name: "MT2 Q2 (CO5)", max_marks: 10, sort_order: 5, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000006", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_2", component_name: "MT2 Q3 (CO6)", max_marks: 10, sort_order: 6, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000007", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO1", max_marks: 10, sort_order: 7, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000008", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO2", max_marks: 12, sort_order: 8, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000009", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO3", max_marks: 12, sort_order: 9, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000010", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO4", max_marks: 10, sort_order: 10, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000011", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO5", max_marks: 8, sort_order: 11, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000012", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO6", max_marks: 8, sort_order: 12, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0001-000000000013", course_offering_id: INITIAL_OFFERING.id, category: "TEACHER_ASSESSMENT", component_name: "Teacher Assessment (TA)", max_marks: 10, sort_order: 13, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
];

// Initial assessment components for 30/20 Autonomous Scheme (4 COs)
export const INITIAL_30_20_ASSESSMENTS: AssessmentComponent[] = [
  { id: "e0000000-0000-0000-0002-000000000001", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_1", component_name: "MT1 Q1 (CO1)", max_marks: 10, sort_order: 1, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0002-000000000002", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_1", component_name: "MT1 Q2 (CO2)", max_marks: 10, sort_order: 2, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0002-000000000003", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_2", component_name: "MT2 Q1 (CO3)", max_marks: 10, sort_order: 3, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0002-000000000004", course_offering_id: INITIAL_OFFERING.id, category: "MID_TERM_2", component_name: "MT2 Q2 (CO4)", max_marks: 10, sort_order: 4, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0002-000000000005", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO1", max_marks: 8, sort_order: 5, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0002-000000000006", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO2", max_marks: 8, sort_order: 6, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0002-000000000007", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO3", max_marks: 12, sort_order: 7, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0002-000000000008", course_offering_id: INITIAL_OFFERING.id, category: "END_SEM", component_name: "ESE CO4", max_marks: 12, sort_order: 8, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
  { id: "e0000000-0000-0000-0002-000000000009", course_offering_id: INITIAL_OFFERING.id, category: "TEACHER_ASSESSMENT", component_name: "Teacher Assessment (TA)", max_marks: 10, sort_order: 9, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" },
];
