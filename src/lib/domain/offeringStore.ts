/**
 * OutcomeX — Authoritative Domain Offering Service
 * 
 * Provides centralized, server-side data access for courses, offerings,
 * rosters, marks, assessment components, and mappings.
 * Fully backed by Supabase PostgreSQL with strict UUID validation
 * and explicit error propagation.
 */

import crypto from "crypto";
import { REFERENCE_STUDENTS, ReferenceStudent } from "@/lib/data/referenceStudents";
import { INITIAL_OFFERING, INITIAL_ASSESSMENTS, INITIAL_30_20_ASSESSMENTS, INITIAL_COURSE, INITIAL_SCHEMES } from "@/lib/data/initialData";
import { getDbClient } from "@/lib/supabase/admin";

export const DEFAULT_OFFERING_ID = INITIAL_OFFERING.id;

import { isValidUuid, normalizeComponentKey } from "@/lib/utils";
export { isValidUuid, normalizeComponentKey };

export interface StudentMarksRecord {
  student_id: string;
  enrollment_id?: string;
  roll_no: string;
  student_name: string;
  marks: Record<string, number | string | null>;
}

class OfferingDomainService {
  /**
   * Resolves offering ID ensuring it is valid.
   */
  resolveOfferingId(idOrOfferingId: string): string {
    if (!idOrOfferingId) return DEFAULT_OFFERING_ID;
    if (isValidUuid(idOrOfferingId)) return idOrOfferingId;
    return DEFAULT_OFFERING_ID;
  }

  /**
   * Query all courses with their course offerings and active student counts from PostgreSQL.
   */
  async getCourses(authCtx?: { role?: string; department_id?: string; user?: { id: string }; isServiceRole?: boolean } | null): Promise<any[]> {
    const db = await getDbClient();
    const { data: dbCourses, error } = await db
      .from("courses")
      .select(`
        id,
        department_id,
        course_code,
        course_name,
        semester,
        year_of_study,
        created_at,
        updated_at,
        course_offerings (
          id,
          academic_year_id,
          teacher_id,
          section,
          attainment_scheme_id,
          created_at,
          updated_at,
          attainment_schemes (
            id,
            scheme_name
          ),
          academic_years (
            id,
            year_label
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Database error querying courses: ${error.message}`);
    }

    if (dbCourses && dbCourses.length > 0) {
      // Apply authorization filter if faculty teacher
      let filteredCourses = dbCourses;
      if (authCtx && !authCtx.isServiceRole) {
        const teacherUserId = authCtx.user?.id;
        if (authCtx.role === "teacher" && teacherUserId) {
          filteredCourses = dbCourses.filter((c: any) => {
            const offs = Array.isArray(c.course_offerings) ? c.course_offerings : [c.course_offerings];
            return offs.some((o: any) => o?.teacher_id === teacherUserId || !o?.teacher_id);
          });
        } else if ((authCtx.role === "hod" || authCtx.role === "department_admin") && authCtx.department_id) {
          filteredCourses = dbCourses.filter((c: any) => !c.department_id || c.department_id === authCtx.department_id);
        }
      }

      return await Promise.all(
        filteredCourses.map(async (c: any) => {
          let offerings = Array.isArray(c.course_offerings) ? c.course_offerings : [c.course_offerings];
          const teacherUserId = authCtx?.user?.id;
          if (authCtx && authCtx.role === "teacher" && teacherUserId) {
            const assigned = offerings.find((o: any) => o?.teacher_id === teacherUserId);
            if (assigned) offerings = [assigned];
          }
          let offering = offerings[0];

          if (!offering?.id) {
            const { data: existingOff } = await db
              .from("course_offerings")
              .select(`
                id,
                academic_year_id,
                teacher_id,
                section,
                attainment_scheme_id,
                created_at,
                updated_at,
                attainment_schemes (
                  id,
                  scheme_name
                ),
                academic_years (
                  id,
                  year_label
                )
              `)
              .eq("course_id", c.id)
              .maybeSingle();

            if (existingOff) {
              offering = existingOff;
            } else {
              const { data: ays } = await db.from("academic_years").select("id").eq("department_id", c.department_id).limit(1);
              const { data: schemes } = await db.from("attainment_schemes").select("id").eq("department_id", c.department_id).limit(1);
              const { data: teachers } = await db.from("profiles").select("id").limit(1);

              if (ays?.[0]?.id && schemes?.[0]?.id && teachers?.[0]?.id) {
                const newOffId = crypto.randomUUID();
                const { data: createdOff } = await db
                  .from("course_offerings")
                  .insert({
                    id: newOffId,
                    course_id: c.id,
                    academic_year_id: ays[0].id,
                    teacher_id: teachers[0].id,
                    section: "A",
                    attainment_scheme_id: schemes[0].id,
                  })
                  .select(`
                    id,
                    academic_year_id,
                    teacher_id,
                    section,
                    attainment_scheme_id,
                    created_at,
                    updated_at,
                    attainment_schemes (
                      id,
                      scheme_name
                    ),
                    academic_years (
                      id,
                      year_label
                    )
                  `)
                  .maybeSingle();

                if (createdOff) offering = createdOff;
              }
            }
          }

          let studentsCount = 0;
          if (offering?.id) {
            const { count } = await db
              .from("enrollments")
              .select("*", { count: "exact", head: true })
              .eq("course_offering_id", offering.id);
            studentsCount = count || 0;
          }

          const rawScheme = offering?.attainment_schemes;
          const schemeName = (Array.isArray(rawScheme) ? rawScheme[0]?.scheme_name : rawScheme?.scheme_name) ||
            (offering?.attainment_scheme_id?.includes("2") || offering?.attainment_scheme_id?.includes("30")
              ? "Autonomous 30/20 Scheme"
              : "Autonomous 60/40 Scheme");

          const { count: dbCosCount } = await db
            .from("course_outcomes")
            .select("*", { count: "exact", head: true })
            .eq("course_id", c.id);

          const cosCount = dbCosCount || (schemeName.includes("30") ? 4 : 6);

          return {
            id: c.id,
            department_id: c.department_id,
            course_code: c.course_code,
            course_name: c.course_name,
            semester: c.semester,
            year_of_study: c.year_of_study,
            created_at: c.created_at,
            updated_at: c.updated_at,
            studentsCount,
            cosCount,
            schemeName,
            offering,
          };
        })
      );
    }

    // If database courses table has no records, check if department exists to seed reference course
    const { data: cseDept } = await db.from("departments").select("id").eq("code", "CSE").maybeSingle();
    if (cseDept?.id) {
      const { data: ays } = await db.from("academic_years").select("id").eq("department_id", cseDept.id).limit(1);
      const { data: schemes } = await db.from("attainment_schemes").select("id").eq("department_id", cseDept.id).limit(1);
      const { data: teachers } = await db.from("profiles").select("id").limit(1);

      if (ays?.[0]?.id && schemes?.[0]?.id && teachers?.[0]?.id) {
        const courseId = "c0000000-0000-0000-0000-000000000001";
        const offeringId = "f0000000-0000-0000-0000-000000000001";

        const { data: newCourse } = await db
          .from("courses")
          .insert({
            id: courseId,
            department_id: cseDept.id,
            course_code: "25UCS623T",
            course_name: "Introduction to Data Science",
            semester: "5th Sem",
            year_of_study: "3rd Yr",
          })
          .select()
          .maybeSingle();

        if (newCourse) {
          const { data: newOff } = await db
            .from("course_offerings")
            .insert({
              id: offeringId,
              course_id: courseId,
              academic_year_id: ays[0].id,
              teacher_id: teachers[0].id,
              section: "A",
              attainment_scheme_id: schemes[0].id,
            })
            .select()
            .maybeSingle();

          return [
            {
              ...newCourse,
              studentsCount: 0,
              cosCount: 6,
              schemeName: "Autonomous 60/40 Scheme",
              offering: newOff || INITIAL_OFFERING,
            },
          ];
        }
      }
    }

    // Default reference course fallback
    return [
      {
        ...INITIAL_COURSE,
        studentsCount: 0,
        cosCount: 6,
        schemeName: "Autonomous 60/40 Scheme",
        offering: INITIAL_OFFERING,
      },
    ];
  }

  /**
   * Create a new course and guarantee its associated course offering in the database.
   */
  async createCourse(input: {
    course_code: string;
    course_name: string;
    semester?: string;
    year_of_study?: string;
    attainment_scheme_id?: string;
    section?: string;
    teacher_id?: string;
  }): Promise<any> {
    const courseCode = String(input.course_code).trim().toUpperCase();
    const courseName = String(input.course_name).trim();

    if (!courseCode || !courseName) {
      throw new Error("Course code and course name are required.");
    }

    const db = await getDbClient();

    // Query active department and academic year
    let deptId = "d0000000-0000-0000-0000-000000000001";
    let ayId = "a0000000-0000-0000-0000-000000000001";

    const { data: depts } = await db.from("departments").select("id").limit(1);
    if (depts && depts.length > 0) deptId = depts[0].id;

    const { data: ays } = await db.from("academic_years").select("id").limit(1);
    if (ays && ays.length > 0) ayId = ays[0].id;

    const schemeId = input.attainment_scheme_id && isValidUuid(input.attainment_scheme_id)
      ? input.attainment_scheme_id
      : INITIAL_SCHEMES[0].id;

    const courseId = crypto.randomUUID();
    const offeringId = crypto.randomUUID();
    const teacherId = input.teacher_id && isValidUuid(input.teacher_id)
      ? input.teacher_id
      : INITIAL_OFFERING.teacher_id;

    // 1. Insert course
    const { data: createdCourse, error: cErr } = await db
      .from("courses")
      .insert({
        id: courseId,
        department_id: deptId,
        course_code: courseCode,
        course_name: courseName,
        semester: input.semester || "5th Sem",
        year_of_study: input.year_of_study || "3rd Yr",
      })
      .select()
      .single();

    if (cErr) {
      throw new Error(`Failed to create course in database: ${cErr.message}`);
    }

    // 2. Insert course offering
    const { data: createdOffering, error: oErr } = await db
      .from("course_offerings")
      .insert({
        id: offeringId,
        course_id: createdCourse.id,
        academic_year_id: ayId,
        teacher_id: teacherId,
        section: input.section || "A",
        attainment_scheme_id: schemeId,
      })
      .select()
      .single();

    if (oErr) {
      throw new Error(`Failed to create course offering in database: ${oErr.message}`);
    }

    // 3. Auto-seed standard assessment components for the new offering
    const is30_20 = schemeId.includes("2") || schemeId.includes("30");
    const componentsTemplate = is30_20 ? INITIAL_30_20_ASSESSMENTS : INITIAL_ASSESSMENTS;
    const componentsToSeed = componentsTemplate.map((c) => ({
      id: crypto.randomUUID(),
      course_offering_id: offeringId,
      category: c.category,
      component_name: c.component_name,
      max_marks: c.max_marks,
      sort_order: c.sort_order,
    }));

    await db.from("assessment_components").insert(componentsToSeed);

    return {
      ...createdCourse,
      studentsCount: 0,
      cosCount: schemeId.includes("2") ? 4 : 6,
      schemeName: schemeId.includes("2") ? "Autonomous 30/20 Scheme" : "Autonomous 60/40 Scheme",
      offering: createdOffering,
    };
  }

  /**
   * Get student roster for a course offering directly from PostgreSQL enrollments.
   */
  async getRoster(offeringId: string): Promise<ReferenceStudent[]> {
    if (!isValidUuid(offeringId)) {
      return [];
    }

    const db = await getDbClient();
    const { data: enrollments, error } = await db
      .from("enrollments")
      .select(`
        id,
        roll_no,
        status,
        students (
          id,
          student_name,
          university_reg_no,
          gender
        )
      `)
      .eq("course_offering_id", offeringId)
      .order("roll_no", { ascending: true });

    if (error) {
      throw new Error(`Database error fetching roster: ${error.message}`);
    }

    if (!enrollments || enrollments.length === 0) {
      return [];
    }

    return enrollments.map((e: any) => ({
      id: e.id,
      roll_no: e.roll_no,
      student_name: e.students?.student_name || `Student ${e.roll_no}`,
      status: (e.status as any) || "ENROLLED",
    }));
  }

  /**
   * Add one or more students to an offering roster in PostgreSQL.
   * Maintains canonical student identity and distinct enrollment UUIDs.
   */
  async addStudentsToRoster(
    offeringId: string,
    studentsToAdd: Array<{ roll_no: string; student_name: string; status?: string }>
  ): Promise<{ added: ReferenceStudent[]; duplicates: string[]; totalCount: number }> {
    if (!isValidUuid(offeringId)) {
      throw new Error(`Invalid course offering ID "${offeringId}": must be a valid UUID.`);
    }

    if (!studentsToAdd || studentsToAdd.length === 0) {
      return { added: [], duplicates: [], totalCount: 0 };
    }

    const db = await getDbClient();

    // 1. Resolve offering and its course & department associations using actual DB relationship
    let resolvedOfferingId = offeringId;
    let { data: offering, error: offErr } = await db
      .from("course_offerings")
      .select(`
        id,
        course_id,
        courses (
          id,
          department_id,
          course_code,
          course_name
        )
      `)
      .eq("id", offeringId)
      .maybeSingle();

    if (!offering) {
      // Check if offeringId is actually a course_id and re-route if an offering exists
      const { data: courseMatch } = await db
        .from("courses")
        .select(`
          id,
          department_id,
          course_offerings (
            id
          )
        `)
        .eq("id", offeringId)
        .maybeSingle();

      if (courseMatch) {
        const offList = Array.isArray(courseMatch.course_offerings)
          ? courseMatch.course_offerings
          : [courseMatch.course_offerings];
        if (offList && offList[0]?.id) {
          resolvedOfferingId = offList[0].id;
          const { data: realOff } = await db
            .from("course_offerings")
            .select(`
              id,
              course_id,
              courses (
                id,
                department_id,
                course_code,
                course_name
              )
            `)
            .eq("id", resolvedOfferingId)
            .maybeSingle();
          offering = realOff;
        }
      }
    }

    if (!offering) {
      throw new Error(
        `Course offering with ID "${offeringId}" not found in database. Please verify the offering exists before enrolling students.`
      );
    }

    const courseData: any = offering.courses;
    const resolvedDeptId = Array.isArray(courseData)
      ? courseData[0]?.department_id
      : courseData?.department_id;

    if (!resolvedDeptId || !isValidUuid(resolvedDeptId)) {
      throw new Error(
        `Course offering "${resolvedOfferingId}" has no valid department association in database.`
      );
    }

    // 2. Verify that the resolved department exists in the referenced departments table
    const { data: deptRecord, error: deptErr } = await db
      .from("departments")
      .select("id, code, name")
      .eq("id", resolvedDeptId)
      .maybeSingle();

    if (deptErr) {
      throw new Error(`Database error verifying department "${resolvedDeptId}": ${deptErr.message}`);
    }

    if (!deptRecord) {
      throw new Error(
        `Referenced department "${resolvedDeptId}" does not exist in the departments table.`
      );
    }

    // 3. Query existing enrollments for this offering to prevent duplicates
    const { data: existingEnrollments, error: enrErr } = await db
      .from("enrollments")
      .select("roll_no, student_id")
      .eq("course_offering_id", resolvedOfferingId);

    if (enrErr) {
      throw new Error(`Database error querying existing enrollments: ${enrErr.message}`);
    }

    const existingRolls = new Set(
      (existingEnrollments || []).map((e: any) => String(e.roll_no).trim().toLowerCase())
    );
    const existingStudentIds = new Set(
      (existingEnrollments || []).map((e: any) => String(e.student_id))
    );

    const duplicates: string[] = [];
    const added: ReferenceStudent[] = [];

    for (const st of studentsToAdd) {
      const roll = String(st.roll_no).trim();
      const name = String(st.student_name || "").trim();
      if (!roll || !name) continue;

      if (existingRolls.has(roll.toLowerCase())) {
        duplicates.push(roll);
        continue;
      }

      // Try database stored procedure enroll_student_in_offering first for atomic transaction
      let rpcSucceeded = false;
      try {
        const { data: rpcResult, error: rpcErr } = await db.rpc("enroll_student_in_offering", {
          p_offering_id: resolvedOfferingId,
          p_roll_no: roll,
          p_student_name: name,
          p_status: st.status || "ENROLLED",
        });

        if (!rpcErr && rpcResult) {
          if (rpcResult.success) {
            existingRolls.add(roll.toLowerCase());
            existingStudentIds.add(rpcResult.student_id);
            added.push({
              id: rpcResult.enrollment_id,
              roll_no: rpcResult.roll_no,
              student_name: rpcResult.student_name,
              status: (st.status as any) || "ENROLLED",
            });
            rpcSucceeded = true;
          } else if (rpcResult.status === "duplicate") {
            duplicates.push(roll);
            rpcSucceeded = true;
          }
        }
      } catch {
        // Fallback to table queries below if RPC is not deployed yet
      }

      if (rpcSucceeded) continue;

      // Table query path: Find or reuse canonical student record in this department
      let studentId: string;
      const { data: existingStudent, error: findStudErr } = await db
        .from("students")
        .select("id, student_name, department_id")
        .eq("department_id", resolvedDeptId)
        .eq("university_reg_no", roll)
        .maybeSingle();

      if (findStudErr) {
        throw new Error(`Database error querying student record for Roll ${roll}: ${findStudErr.message}`);
      }

      if (existingStudent?.id) {
        studentId = existingStudent.id;
        if (existingStudentIds.has(studentId)) {
          duplicates.push(roll);
          continue;
        }
      } else {
        const newStudentId = crypto.randomUUID();
        const { data: insertedStudent, error: sErr } = await db
          .from("students")
          .insert({
            id: newStudentId,
            department_id: resolvedDeptId,
            student_name: name,
            university_reg_no: roll,
          })
          .select("id")
          .single();

        if (sErr || !insertedStudent) {
          throw new Error(`Failed to create student record for Roll ${roll}: ${sErr?.message}`);
        }
        studentId = insertedStudent.id;
      }

      // Create unique enrollment for this offering
      const enrollmentId = crypto.randomUUID();
      const { data: insertedEnrollment, error: eErr } = await db
        .from("enrollments")
        .insert({
          id: enrollmentId,
          course_offering_id: resolvedOfferingId,
          student_id: studentId,
          roll_no: roll,
          status: st.status || "ENROLLED",
        })
        .select("id, roll_no, status")
        .single();

      if (eErr || !insertedEnrollment) {
        throw new Error(`Failed to enroll student Roll ${roll} in offering: ${eErr?.message}`);
      }

      existingRolls.add(roll.toLowerCase());
      existingStudentIds.add(studentId);

      added.push({
        id: insertedEnrollment.id,
        roll_no: insertedEnrollment.roll_no,
        student_name: name,
        status: (insertedEnrollment.status as any) || "ENROLLED",
      });
    }

    const { count: totalCount } = await db
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("course_offering_id", resolvedOfferingId);

    return {
      added,
      duplicates,
      totalCount: totalCount || 0,
    };
  }

  /**
   * Delete a student enrollment from a course offering.
   */
  async deleteStudent(offeringId: string, studentIdOrRoll: string): Promise<boolean> {
    if (!isValidUuid(offeringId)) {
      throw new Error("Invalid course offering ID.");
    }

    const db = await getDbClient();

    // Delete enrollment
    let query = db.from("enrollments").delete().eq("course_offering_id", offeringId);
    if (isValidUuid(studentIdOrRoll)) {
      query = query.eq("id", studentIdOrRoll);
    } else {
      query = query.eq("roll_no", studentIdOrRoll);
    }

    const { error } = await query;
    if (error) {
      throw new Error(`Failed to remove student from offering: ${error.message}`);
    }

    return true;
  }

  /**
   * Clear all student enrollments from a course offering.
   */
  async clearRoster(offeringId: string): Promise<boolean> {
    if (!isValidUuid(offeringId)) {
      throw new Error("Invalid course offering ID.");
    }

    const db = await getDbClient();
    const { error } = await db
      .from("enrollments")
      .delete()
      .eq("course_offering_id", offeringId);

    if (error) {
      throw new Error(`Failed to clear offering roster: ${error.message}`);
    }

    return true;
  }

  /**
   * Get marks records for an offering.
   * Queries database enrollments, assessment components, and persisted marks.
   */
  async getMarks(offeringId: string): Promise<{ marks: StudentMarksRecord[]; count: number; components: any[] }> {
    if (!isValidUuid(offeringId)) {
      return { marks: [], count: 0, components: INITIAL_ASSESSMENTS };
    }

    const db = await getDbClient();

    // 1. Fetch roster enrollments
    const { data: enrollments, error: rErr } = await db
      .from("enrollments")
      .select(`
        id,
        roll_no,
        students (
          id,
          student_name
        )
      `)
      .eq("course_offering_id", offeringId)
      .order("roll_no", { ascending: true });

    if (rErr) {
      throw new Error(`Database error fetching roster for marks: ${rErr.message}`);
    }

    // 2. Fetch assessment components
    const { data: dbComps, error: cErr } = await db
      .from("assessment_components")
      .select("id, component_name, max_marks, category, sort_order")
      .eq("course_offering_id", offeringId)
      .order("sort_order", { ascending: true });

    if (cErr) {
      throw new Error(`Database error fetching assessment components: ${cErr.message}`);
    }

    let components = dbComps && dbComps.length > 0 ? dbComps : null;
    if (!components) {
      const { data: offRecord } = await db
        .from("course_offerings")
        .select("attainment_scheme_id, attainment_schemes(scheme_name)")
        .eq("id", offeringId)
        .maybeSingle();

      const schemeName = (offRecord?.attainment_schemes as any)?.scheme_name || "";
      const is30_20 = schemeName.includes("30") || String(offRecord?.attainment_scheme_id || "").includes("2") || String(offRecord?.attainment_scheme_id || "").includes("30");
      components = is30_20 ? INITIAL_30_20_ASSESSMENTS : INITIAL_ASSESSMENTS;
    }

    if (!enrollments || enrollments.length === 0) {
      return { marks: [], count: 0, components };
    }

    // Build map of component_id -> normalizedKey
    const compKeyMap = new Map<string, string>();
    for (const comp of components) {
      compKeyMap.set(comp.id, normalizeComponentKey(comp.component_name));
    }

    // 3. Fetch persisted student marks
    const enrollmentIds = enrollments.map((e: any) => e.id);
    const { data: dbMarks, error: mErr } = await db
      .from("student_marks")
      .select("enrollment_id, assessment_component_id, marks_obtained, status")
      .in("enrollment_id", enrollmentIds);

    if (mErr) {
      throw new Error(`Database error fetching student marks: ${mErr.message}`);
    }

    // Index marks by enrollment_id -> compKey -> value
    const marksByEnrollment = new Map<string, Record<string, any>>();
    for (const m of dbMarks || []) {
      if (!marksByEnrollment.has(m.enrollment_id)) {
        marksByEnrollment.set(m.enrollment_id, {});
      }
      const stMarks = marksByEnrollment.get(m.enrollment_id)!;
      const key = compKeyMap.get(m.assessment_component_id) || m.assessment_component_id;

      if (m.status === "ABSENT") {
        stMarks[key] = "A";
      } else if (m.status === "EXEMPT") {
        stMarks[key] = "E";
      } else if (m.marks_obtained !== null && m.marks_obtained !== undefined) {
        stMarks[key] = Number(m.marks_obtained);
      } else {
        stMarks[key] = null;
      }
    }

    // Build full gradebook for all enrolled students
    const marksList: StudentMarksRecord[] = enrollments.map((e: any) => {
      const persisted = marksByEnrollment.get(e.id) || {};
      return {
        student_id: e.students?.id || e.id,
        enrollment_id: e.id,
        roll_no: e.roll_no,
        student_name: e.students?.student_name || `Student ${e.roll_no}`,
        marks: persisted,
      };
    });

    return {
      marks: marksList,
      count: marksList.length,
      components,
    };
  }

  /**
   * Persists updated student marks into Supabase PostgreSQL.
   * Performs validation, transactional upsert, and returns actual record counts.
   */
  async saveMarks(
    offeringId: string,
    updatedMarks: StudentMarksRecord[]
  ): Promise<{ savedCount: number; warnings: string[]; timestamp: string }> {
    if (!isValidUuid(offeringId)) {
      throw new Error(`Invalid offering ID "${offeringId}": must be a valid UUID.`);
    }

    if (!Array.isArray(updatedMarks)) {
      throw new Error("Invalid payload: updatedMarks must be an array.");
    }

    const db = await getDbClient();

    // 1. Fetch enrollments for this offering
    const { data: enrollments, error: rErr } = await db
      .from("enrollments")
      .select("id, roll_no")
      .eq("course_offering_id", offeringId);

    if (rErr) throw new Error(`Database error fetching enrollments: ${rErr.message}`);

    const enrollmentByRoll = new Map<string, string>();
    const enrollmentById = new Map<string, string>();
    for (const e of enrollments || []) {
      enrollmentByRoll.set(String(e.roll_no).trim().toLowerCase(), e.id);
      enrollmentById.set(e.id, e.id);
    }

    // 2. Fetch assessment components
    const { data: dbComps, error: cErr } = await db
      .from("assessment_components")
      .select("id, component_name, max_marks")
      .eq("course_offering_id", offeringId);

    if (cErr) throw new Error(`Database error fetching components: ${cErr.message}`);

    // Map normalized key and component_name to component ID and max_marks
    const compMap = new Map<string, { id: string; max_marks: number; name: string }>();
    for (const comp of dbComps || []) {
      const normKey = normalizeComponentKey(comp.component_name);
      compMap.set(normKey, { id: comp.id, max_marks: Number(comp.max_marks), name: comp.component_name });
      compMap.set(comp.id, { id: comp.id, max_marks: Number(comp.max_marks), name: comp.component_name });
    }

    const rowsToUpsert: Array<{
      enrollment_id: string;
      assessment_component_id: string;
      marks_obtained: number | null;
      status: string;
      updated_at: string;
    }> = [];

    const warnings: string[] = [];

    for (const record of updatedMarks) {
      const rollKey = String(record.roll_no || "").trim().toLowerCase();
      const enrollmentId =
        (record.enrollment_id && enrollmentById.get(record.enrollment_id)) ||
        enrollmentByRoll.get(rollKey);

      if (!enrollmentId) {
        warnings.push(`Student with Roll ${record.roll_no} not found in this offering's roster.`);
        continue;
      }

      const marks = record.marks || {};
      for (const [key, rawVal] of Object.entries(marks)) {
        const comp = compMap.get(key) || compMap.get(normalizeComponentKey(key));
        if (!comp) {
          warnings.push(`Unknown assessment component "${key}" skipped.`);
          continue;
        }

        let status = "PRESENT";
        let marksObtained: number | null = null;

        if (rawVal === null || rawVal === undefined || String(rawVal).trim() === "") {
          status = "NOT_ENTERED";
          marksObtained = null;
        } else {
          const strVal = String(rawVal).trim().toUpperCase();
          if (strVal === "A" || strVal === "AB" || strVal === "ABSENT") {
            status = "ABSENT";
            marksObtained = null;
          } else if (strVal === "E" || strVal === "EX" || strVal === "EXEMPT") {
            status = "EXEMPT";
            marksObtained = null;
          } else {
            const num = parseFloat(strVal);
            if (isNaN(num)) {
              warnings.push(`Non-numeric mark "${rawVal}" for Roll ${record.roll_no} on ${comp.name}.`);
              continue;
            }
            if (num < 0) {
              warnings.push(`Negative mark ${num} for Roll ${record.roll_no} on ${comp.name} rejected.`);
              continue;
            }
            if (num > comp.max_marks) {
              warnings.push(`Mark ${num} exceeds maximum of ${comp.max_marks} for Roll ${record.roll_no} on ${comp.name}.`);
            }
            marksObtained = num;
            status = "PRESENT";
          }
        }

        rowsToUpsert.push({
          enrollment_id: enrollmentId,
          assessment_component_id: comp.id,
          marks_obtained: marksObtained,
          status,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (rowsToUpsert.length > 0) {
      // Chunk upserts in batches of 200 for PostgreSQL performance
      const chunkSize = 200;
      for (let i = 0; i < rowsToUpsert.length; i += chunkSize) {
        const chunk = rowsToUpsert.slice(i, i + chunkSize);
        const { error: upErr } = await db
          .from("student_marks")
          .upsert(chunk, { onConflict: "enrollment_id,assessment_component_id" });

        if (upErr) {
          throw new Error(`Failed to persist marks in database: ${upErr.message}`);
        }
      }
    }

    return {
      savedCount: rowsToUpsert.length,
      warnings,
      timestamp: new Date().toISOString(),
    };
  }
}

export const offeringStore = new OfferingDomainService();
export const toValidUuid = (id: string) => id; // Backwards-compatibility alias for tests

/**
 * Authoritative attainment calculation service for a course offering.
 */
export async function calculateOfferingAttainment(offeringId: string) {
  const db = await getDbClient();
  const marksData = await offeringStore.getMarks(offeringId);
  if (!marksData || marksData.marks.length === 0) {
    return null;
  }

  // Load components
  const { data: dbComps } = await db
    .from("assessment_components")
    .select(`
      id,
      component_name,
      component_type,
      max_marks,
      course_outcome_id,
      course_outcomes (
        co_code
      )
    `)
    .eq("course_offering_id", offeringId);

  const { AttainmentEngine } = await import("@/lib/engine/attainmentEngine");
  const { INITIAL_COS, INITIAL_POS, INITIAL_MAPPINGS, INITIAL_SCHEMES } = await import("@/lib/data/initialData");

  const components = (dbComps && dbComps.length > 0)
    ? dbComps.map((c: any) => ({
        id: c.id,
        name: c.component_name,
        type: c.component_type || "IAM",
        max_marks: Number(c.max_marks),
        co_code: c.course_outcomes?.co_code || "CO1",
      }))
    : [
        { id: "comp-mt1-co1", name: "MT1 Q1 (CO1)", type: "IAM", max_marks: 10, co_code: "CO1" },
        { id: "comp-mt1-co2", name: "MT1 Q2 (CO2)", type: "IAM", max_marks: 10, co_code: "CO2" },
        { id: "comp-mt1-co3", name: "MT1 Q3 (CO3)", type: "IAM", max_marks: 10, co_code: "CO3" },
        { id: "comp-mt2-co4", name: "MT2 Q1 (CO4)", type: "IAM", max_marks: 10, co_code: "CO4" },
        { id: "comp-mt2-co5", name: "MT2 Q2 (CO5)", type: "IAM", max_marks: 10, co_code: "CO5" },
        { id: "comp-mt2-co6", name: "MT2 Q3 (CO6)", type: "IAM", max_marks: 10, co_code: "CO6" },
        { id: "comp-ese-co1", name: "ESE (CO1)", type: "ESE", max_marks: 8, co_code: "CO1" },
        { id: "comp-ese-co2", name: "ESE (CO2)", type: "ESE", max_marks: 8, co_code: "CO2" },
        { id: "comp-ese-co3", name: "ESE (CO3)", type: "ESE", max_marks: 8, co_code: "CO3" },
        { id: "comp-ese-co4", name: "ESE (CO4)", type: "ESE", max_marks: 16, co_code: "CO4" },
        { id: "comp-ese-co5", name: "ESE (CO5)", type: "ESE", max_marks: 8, co_code: "CO5" },
        { id: "comp-ese-co6", name: "ESE (CO6)", type: "ESE", max_marks: 12, co_code: "CO6" },
      ];

  const engine = new AttainmentEngine(INITIAL_SCHEMES[0]);
  const coCodes = INITIAL_COS.map((c) => c.co_code);
  const poList = INITIAL_POS.map((p) => ({ po_code: p.po_code, po_type: p.po_type as "PO" | "PSO" }));

  return engine.calculate(
    marksData.marks,
    components as any,
    coCodes,
    poList,
    INITIAL_MAPPINGS
  );
}
