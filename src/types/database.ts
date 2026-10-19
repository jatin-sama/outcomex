export type UserRole = 'teacher' | 'hod' | 'department_admin';
export type EnrollmentStatus = 'ENROLLED' | 'DROPPED' | 'DETAINED';
export type AssessmentCategory = 'MID_TERM_1' | 'MID_TERM_2' | 'TEACHER_ASSESSMENT' | 'END_SEM' | 'ASSIGNMENT' | 'LAB';
export type MarkStatus = 'PRESENT' | 'ABSENT' | 'EXEMPT' | 'NOT_ENTERED';
export type POType = 'PO' | 'PSO';
export type POAggregationMethod = 'WEIGHTED_AVERAGE' | 'MAPPING_AVERAGE';
export type ReportStatus = 'COMPLETED' | 'FAILED' | 'PENDING';
export type ReportWorkflowStatus = 'DRAFT' | 'CALCULATED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'LOCKED';

export interface Department {
  id: string;
  code: string;
  name: string;
  institution_name: string;
  is_autonomous: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentMembership {
  id: string;
  profile_id: string;
  department_id: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department;
  profile?: Profile;
}

export interface AcademicYear {
  id: string;
  department_id: string;
  year_label: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttainmentScheme {
  id: string;
  department_id: string;
  scheme_name: string;
  version: number;
  threshold_percent: number;
  level_3_threshold: number;
  level_2_threshold: number;
  direct_weight: number;
  indirect_weight: number;
  iam_weight: number;
  esam_weight: number;
  po_aggregation_method: POAggregationMethod;
  is_approved: boolean;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersion {
  id: string;
  template_name: string;
  version: string;
  file_sha256: string;
  storage_path: string;
  sheet_name: string;
  adapter_identifier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  department_id: string;
  course_code: string;
  course_name: string;
  semester: string;
  year_of_study: string;
  created_at: string;
  updated_at: string;
}

export interface CourseOffering {
  id: string;
  course_id: string;
  academic_year_id: string;
  teacher_id: string;
  section: string;
  attainment_scheme_id: string;
  template_version_id?: string | null;
  created_at: string;
  updated_at: string;
  course?: Course;
  academic_year?: AcademicYear;
  teacher?: Profile;
  attainment_scheme?: AttainmentScheme;
  template_version?: TemplateVersion;
}

export interface CourseOutcome {
  id: string;
  course_id: string;
  co_code: string;
  description?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProgramOutcome {
  id: string;
  department_id: string;
  po_code: string;
  po_type: POType;
  description?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CoursePOMapping {
  id: string;
  course_outcome_id: string;
  program_outcome_id: string;
  mapping_strength: number | null; // 1, 2, 3 or null
  created_at: string;
  updated_at: string;
  course_outcome?: CourseOutcome;
  program_outcome?: ProgramOutcome;
}

export interface Student {
  id: string;
  department_id: string;
  university_reg_no?: string | null;
  student_name: string;
  gender?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  course_offering_id: string;
  student_id: string;
  roll_no: string;
  status: EnrollmentStatus;
  created_at: string;
  updated_at: string;
  student?: Student;
}

export interface AssessmentComponent {
  id: string;
  course_offering_id: string;
  category: AssessmentCategory;
  component_name: string;
  max_marks: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  co_mappings?: AssessmentComponentCO[];
}

export interface AssessmentComponentCO {
  id: string;
  assessment_component_id: string;
  course_outcome_id: string;
  weight: number;
  created_at: string;
  course_outcome?: CourseOutcome;
}

export interface StudentMark {
  id: string;
  enrollment_id: string;
  assessment_component_id: string;
  marks_obtained: number | null;
  status: MarkStatus;
  created_at: string;
  updated_at: string;
}

export interface IndirectAttainment {
  id: string;
  course_offering_id: string;
  course_outcome_id: string;
  attainment_level: number;
  survey_sample_size?: number | null;
  created_at: string;
  updated_at: string;
  course_outcome?: CourseOutcome;
}

export interface ReportRun {
  id: string;
  course_offering_id: string;
  template_version_id: string;
  generated_by: string;
  calculation_snapshot: Record<string, unknown>;
  storage_file_path: string;
  file_checksum: string;
  validation_warnings: Array<Record<string, unknown>>;
  status: ReportStatus;
  workflow_status?: ReportWorkflowStatus;
  submitted_by?: string | null;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_comments?: string | null;
  locked_at?: string | null;
  reopened_at?: string | null;
  reopen_reason?: string | null;
  created_at: string;
  course_offering?: CourseOffering;
  template_version?: TemplateVersion;
  generator?: Profile;
}

export interface AuditLog {
  id: string;
  profile_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  profile?: Profile;
}
