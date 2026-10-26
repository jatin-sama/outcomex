import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";
import {
  INITIAL_OFFERING,
  INITIAL_COURSE,
  INITIAL_SCHEMES,
  INITIAL_ASSESSMENTS,
  INITIAL_30_20_ASSESSMENTS,
  INITIAL_COS,
} from "@/lib/data/initialData";
import { REFERENCE_STUDENTS } from "@/lib/data/referenceStudents";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json(
      { error: `Invalid course offering ID "${id}": must be a valid RFC 4122 UUID.` },
      { status: 400 }
    );
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to access course offering details." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized to access this course offering." },
        { status: 403 }
      );
    }

    const db = await getDbClient();

    // 1. Authoritative Course Offering Query
    const { data: offering, error: offErr } = await db
      .from("course_offerings")
      .select(`
        id,
        section,
        academic_year_id,
        teacher_id,
        attainment_scheme_id,
        created_at,
        updated_at,
        courses (
          id,
          department_id,
          course_code,
          course_name,
          semester,
          year_of_study
        ),
        academic_years (
          id,
          year_label
        ),
        attainment_schemes (
          id,
          scheme_name,
          version,
          direct_weight,
          indirect_weight,
          iam_weight,
          esam_weight,
          config_json
        ),
        profiles (
          id,
          full_name,
          email
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (offErr) {
      throw new Error(`Database error querying course offering: ${offErr.message}`);
    }

    // Determine course data
    const rawCourse: any = offering?.courses;
    const courseData = (Array.isArray(rawCourse) ? rawCourse[0] : rawCourse) || INITIAL_COURSE;

    // Determine scheme data
    const rawScheme: any = offering?.attainment_schemes;
    const schemeData = (Array.isArray(rawScheme) ? rawScheme[0] : rawScheme) || INITIAL_SCHEMES[0];

    // Determine academic year
    const rawAy: any = offering?.academic_years;
    const ayData = (Array.isArray(rawAy) ? rawAy[0] : rawAy) || { id: "a0000000-0000-0000-0000-000000000001", year_label: "2025-26" };

    // Determine faculty teacher
    const rawTeacher: any = offering?.profiles;
    const teacherData = (Array.isArray(rawTeacher) ? rawTeacher[0] : rawTeacher) || { full_name: "Assigned Faculty", email: "" };

    // 2. Fetch Course Outcomes for this Course
    const courseId = courseData.id;
    let outcomes: any[] = [];
    if (courseId && isValidUuid(courseId)) {
      const { data: dbOutcomes } = await db
        .from("course_outcomes")
        .select("id, co_code, description, sort_order")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });

      if (dbOutcomes && dbOutcomes.length > 0) {
        outcomes = dbOutcomes;
      }
    }

    if (outcomes.length === 0 && (id === INITIAL_OFFERING.id || id.startsWith("f0000000"))) {
      outcomes = INITIAL_COS;
    }

    // 3. Fetch Configured Assessment Components with CO Mappings
    const { data: dbComps } = await db
      .from("assessment_components")
      .select(`
        id,
        component_name,
        category,
        max_marks,
        sort_order,
        assessment_component_co_mappings (
          course_outcome_id,
          weight,
          course_outcomes (
            id,
            co_code
          )
        )
      `)
      .eq("course_offering_id", id)
      .order("sort_order", { ascending: true });

    let components: any[] = [];
    if (dbComps && dbComps.length > 0) {
      components = dbComps.map((c: any) => {
        const mappings = c.assessment_component_co_mappings || [];
        const primaryMapping = Array.isArray(mappings) ? mappings[0] : mappings;
        const coCode = primaryMapping?.course_outcomes?.co_code ||
          c.component_name.match(/CO\d+/i)?.[0]?.toUpperCase() || "-";

        return {
          id: c.id,
          component_name: c.component_name,
          category: c.category,
          max_marks: Number(c.max_marks),
          sort_order: c.sort_order,
          co_code: coCode,
          course_outcome_id: primaryMapping?.course_outcome_id || null,
          weight: primaryMapping?.weight ? Number(primaryMapping.weight) : 1.0,
        };
      });
    } else if (id === INITIAL_OFFERING.id) {
      components = INITIAL_ASSESSMENTS.map((c) => ({
        id: c.id,
        component_name: c.component_name,
        category: c.category,
        max_marks: Number(c.max_marks),
        sort_order: c.sort_order,
        co_code: c.component_name.match(/CO\d+/i)?.[0]?.toUpperCase() || "-",
        course_outcome_id: null,
        weight: 1.0,
      }));
    } else if (id === "f0000000-0000-0000-0000-000000000002") {
      components = INITIAL_30_20_ASSESSMENTS.map((c) => ({
        id: c.id,
        component_name: c.component_name,
        category: c.category,
        max_marks: Number(c.max_marks),
        sort_order: c.sort_order,
        co_code: c.component_name.match(/CO\d+/i)?.[0]?.toUpperCase() || "-",
        course_outcome_id: null,
        weight: 1.0,
      }));
    }

    // 4. Fetch Enrolled Students from Roster
    const { data: dbEnrollments } = await db
      .from("enrollments")
      .select(`
        id,
        roll_no,
        student_id,
        status,
        students (
          id,
          student_name
        )
      `)
      .eq("course_offering_id", id)
      .order("roll_no", { ascending: true });

    let enrolledStudents: any[] = [];
    if (dbEnrollments && dbEnrollments.length > 0) {
      enrolledStudents = dbEnrollments.map((enr: any) => ({
        enrollment_id: enr.id,
        student_id: enr.student_id,
        roll_no: enr.roll_no,
        student_name: enr.students?.student_name || `Student ${enr.roll_no}`,
        status: enr.status,
      }));
    } else if (id === INITIAL_OFFERING.id || id.startsWith("f0000000")) {
      enrolledStudents = REFERENCE_STUDENTS.map((st) => ({
        enrollment_id: `e-${st.roll_no}`,
        student_id: `s-${st.roll_no}`,
        roll_no: st.roll_no,
        student_name: st.student_name,
        status: "ENROLLED",
      }));
    }

    // Configuration Completeness Assessment
    const configurationErrors: string[] = [];
    if (components.length === 0) {
      configurationErrors.push(
        "No assessment components configured for this course offering. Assessment components must be configured before generating marks templates."
      );
    }
    if (outcomes.length === 0) {
      configurationErrors.push(
        "No course outcomes defined for this course. Define course outcomes before marks entry."
      );
    }
    if (enrolledStudents.length === 0) {
      configurationErrors.push(
        "No students enrolled in this course offering. Please enroll students in Roster Management."
      );
    }

    const isConfigurationComplete = components.length > 0 && outcomes.length > 0;

    return NextResponse.json({
      offering_id: id,
      course: {
        id: courseData.id,
        course_code: courseData.course_code,
        course_name: courseData.course_name,
        semester: courseData.semester,
        year_of_study: courseData.year_of_study,
      },
      section: offering?.section || "A",
      academic_year: {
        id: ayData.id,
        year_label: ayData.year_label,
      },
      scheme: {
        id: schemeData.id,
        scheme_name: schemeData.scheme_name,
        version: schemeData.version,
        direct_weight: Number(schemeData.direct_weight || 0.8),
        indirect_weight: Number(schemeData.indirect_weight || 0.2),
        iam_weight: Number(schemeData.iam_weight || 0.4),
        esam_weight: Number(schemeData.esam_weight || 0.6),
      },
      teacher: {
        id: offering?.teacher_id || authCtx.user.id,
        full_name: teacherData.full_name,
      },
      course_outcomes: outcomes,
      cos_count: outcomes.length,
      assessment_components: components,
      components_count: components.length,
      enrolled_students: enrolledStudents,
      students_count: enrolledStudents.length,
      is_configuration_complete: isConfigurationComplete,
      configuration_errors: configurationErrors,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load offering details" },
      { status: 500 }
    );
  }
}
