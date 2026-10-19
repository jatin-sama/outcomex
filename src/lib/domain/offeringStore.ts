/**
 * OutcomeX — Canonical Domain Offering Store
 * 
 * Centralized, authoritative single source of truth for course offerings,
 * rosters, marks, assessment components, and mappings.
 * Bridges Supabase PostgreSQL persistence with guaranteed in-memory consistency.
 */

import { REFERENCE_STUDENTS, ReferenceStudent } from "@/lib/data/referenceStudents";
import { REFERENCE_MARKS, StudentMarksRecord } from "@/lib/data/referenceMarks";
import { INITIAL_OFFERING, INITIAL_ASSESSMENTS, INITIAL_COURSE } from "@/lib/data/initialData";
import { getDbClient } from "@/lib/supabase/admin";

export const DEFAULT_OFFERING_ID = INITIAL_OFFERING.id; // "o0000000-0000-0000-0000-000000000001"

// Helper to convert arbitrary string IDs (e.g. "s029" or "o000...") to valid Postgres UUIDs
export function toValidUuid(rawId: string, fallbackSeed: string | number = "1"): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) {
    return rawId;
  }
  // Replace non-hex prefix chars ('o', 's', 'u', etc.) with valid hex ('f', 'e', 'b', etc.)
  if (rawId.startsWith("o0000000-")) return "f" + rawId.slice(1);
  if (rawId.startsWith("s0000000-")) return "e" + rawId.slice(1);
  if (rawId.startsWith("u0000000-")) return "b" + rawId.slice(1);

  const digits = String(fallbackSeed).replace(/\D/g, "") || String(rawId).replace(/\D/g, "") || "1";
  const num = parseInt(digits, 10);
  const hexNum = (isNaN(num) ? 1 : num).toString(16).padStart(12, "0");
  return `00000000-0000-0000-0001-${hexNum}`;
}

// Global in-memory storage holding synchronized offering state across API routes
class OfferingDomainStore {
  private rosters: Map<string, ReferenceStudent[]> = new Map();
  private marks: Map<string, StudentMarksRecord[]> = new Map();
  private assessments: Map<string, any[]> = new Map();

  constructor() {
    // Seed default offering (IDS 25UCS623T)
    this.rosters.set(DEFAULT_OFFERING_ID, JSON.parse(JSON.stringify(REFERENCE_STUDENTS)));
    this.marks.set(DEFAULT_OFFERING_ID, JSON.parse(JSON.stringify(REFERENCE_MARKS)));
    this.assessments.set(DEFAULT_OFFERING_ID, JSON.parse(JSON.stringify(INITIAL_ASSESSMENTS)));
  }

  /**
   * Get student roster for an offering.
   * If database has enrolled students, reconciles with database;
   * otherwise uses the canonical in-memory offering roster.
   */
  async getRoster(offeringId: string): Promise<ReferenceStudent[]> {
    const validOfferingUuid = toValidUuid(offeringId);

    try {
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
        .eq("course_offering_id", validOfferingUuid)
        .order("roll_no", { ascending: true });

      if (!error && enrollments && enrollments.length > 0) {
        const dbRoster: ReferenceStudent[] = enrollments.map((e: any) => ({
          id: e.id,
          roll_no: e.roll_no,
          student_name: e.students?.student_name || `Student ${e.roll_no}`,
          status: (e.status as any) || "ENROLLED",
        }));
        this.rosters.set(offeringId, dbRoster);
        return dbRoster;
      }
    } catch {
      // Fallback to memory store
    }

    if (!this.rosters.has(offeringId)) {
      if (offeringId === DEFAULT_OFFERING_ID) {
        this.rosters.set(offeringId, JSON.parse(JSON.stringify(REFERENCE_STUDENTS)));
      } else {
        this.rosters.set(offeringId, []);
      }
    }

    return this.rosters.get(offeringId)!;
  }

  /**
   * Add one or more students to an offering roster.
   * Crucial: IMMEDIATELY creates corresponding entries in the marks store
   * so the student is instantly visible on Marks Entry.
   */
  async addStudentsToRoster(
    offeringId: string,
    studentsToAdd: Array<{ roll_no: string; student_name: string; status?: string }>
  ): Promise<{ added: ReferenceStudent[]; duplicates: string[]; totalCount: number }> {
    const currentRoster = await this.getRoster(offeringId);
    const existingRolls = new Set(currentRoster.map((s) => String(s.roll_no).trim()));

    const duplicates: string[] = [];
    const added: ReferenceStudent[] = [];

    const validOfferingUuid = toValidUuid(offeringId);

    // Prepare DB client
    let db: any = null;
    let deptId = "d0000000-0000-0000-0000-000000000001";
    try {
      db = await getDbClient();
      const { data: depts } = await db.from("departments").select("id").limit(1);
      if (depts && depts.length > 0) deptId = depts[0].id;
    } catch {}

    for (const st of studentsToAdd) {
      const roll = String(st.roll_no).trim();
      const name = String(st.student_name || "").trim();
      if (!roll || !name) continue;

      if (existingRolls.has(roll)) {
        duplicates.push(roll);
        continue;
      }

      existingRolls.add(roll);
      const studentUuid = toValidUuid(`s-${roll}`, roll);
      const enrollmentUuid = toValidUuid(`e-${roll}`, roll);

      // Attempt DB persistence
      if (db) {
        try {
          const { data: newStudent } = await db
            .from("students")
            .upsert({
              id: studentUuid,
              department_id: deptId,
              student_name: name,
              university_reg_no: roll,
            }, { onConflict: "id" })
            .select()
            .single();

          if (newStudent?.id) {
            await db
              .from("enrollments")
              .upsert({
                id: enrollmentUuid,
                course_offering_id: validOfferingUuid,
                student_id: newStudent.id,
                roll_no: roll,
                status: st.status || "ENROLLED",
              }, { onConflict: "id" });
          }
        } catch {
          // Graceful fallback to domain store
        }
      }

      const newStudentObj: ReferenceStudent = {
        id: enrollmentUuid,
        roll_no: roll,
        student_name: name,
        status: (st.status as any) || "ENROLLED",
      };

      added.push(newStudentObj);
    }

    // Update roster
    const updatedRoster = [...currentRoster, ...added];
    this.rosters.set(offeringId, updatedRoster);

    // CRITICAL: Synchronize marks store immediately!
    const currentMarks = this.marks.get(offeringId) || [];
    const existingMarksRolls = new Set(currentMarks.map((m) => String(m.roll_no).trim()));

    for (const addedStudent of added) {
      if (!existingMarksRolls.has(addedStudent.roll_no)) {
        currentMarks.push({
          student_id: addedStudent.id,
          roll_no: addedStudent.roll_no,
          student_name: addedStudent.student_name,
          marks: {}, // Empty marks ready for faculty entry
        });
        existingMarksRolls.add(addedStudent.roll_no);
      }
    }
    this.marks.set(offeringId, currentMarks);

    return {
      added,
      duplicates,
      totalCount: updatedRoster.length,
    };
  }

  /**
   * Get marks records for an offering.
   * GUARANTEE: Marks are DRIVEN by the current roster.
   * Every student in the roster appears in the marks records.
   */
  async getMarks(offeringId: string): Promise<{ marks: StudentMarksRecord[]; count: number }> {
    const roster = await this.getRoster(offeringId);
    let marksList: StudentMarksRecord[] = this.marks.get(offeringId) || [];

    if (!this.marks.has(offeringId)) {
      if (offeringId === DEFAULT_OFFERING_ID) {
        marksList = JSON.parse(JSON.stringify(REFERENCE_MARKS));
      } else {
        marksList = [];
      }
      this.marks.set(offeringId, marksList);
    }

    // Attempt to load saved marks from Supabase
    const validOfferingUuid = toValidUuid(offeringId);
    try {
      const db = await getDbClient();
      const { data: dbComps } = await db
        .from("assessment_components")
        .select("id, component_name")
        .eq("course_offering_id", validOfferingUuid);

      const { data: dbMarks, error } = await db
        .from("student_marks")
        .select(`
          id,
          marks_obtained,
          status,
          assessment_component_id,
          enrollments!inner (
            id,
            roll_no,
            course_offering_id,
            students (
              student_name
            )
          )
        `)
        .eq("enrollments.course_offering_id", validOfferingUuid);

      if (!error && dbMarks && dbMarks.length > 0 && dbComps) {
        const compMap = new Map(dbComps.map((c: any) => [c.id, c.component_name]));
        const markByRoll = new Map<string, Record<string, any>>();

        for (const row of dbMarks as any[]) {
          const roll = String(row.enrollments?.roll_no);
          const compName = compMap.get(row.assessment_component_id) || row.assessment_component_id;
          if (!markByRoll.has(roll)) markByRoll.set(roll, {});
          const val = row.status === "ABSENT" ? "AB" : row.marks_obtained;
          markByRoll.get(roll)![compName] = val;
        }

        // Merge DB marks into memory marksList
        for (const rec of marksList) {
          const dbScores = markByRoll.get(rec.roll_no);
          if (dbScores) {
            rec.marks = { ...rec.marks, ...dbScores };
          }
        }
      }
    } catch {
      // Memory fallback
    }

    // RECONCILE: Ensure EVERY student in roster is present in marks
    const marksByRoll = new Map(marksList.map((m) => [String(m.roll_no).trim(), m]));
    const reconciledMarks: StudentMarksRecord[] = [];

    for (const student of roster) {
      const roll = String(student.roll_no).trim();
      const existing = marksByRoll.get(roll);
      if (existing) {
        // Ensure student name is up to date with roster
        existing.student_name = student.student_name;
        reconciledMarks.push(existing);
      } else {
        // Newly added student from roster without marks yet
        const newRecord: StudentMarksRecord = {
          student_id: student.id,
          roll_no: student.roll_no,
          student_name: student.student_name,
          marks: {},
        };
        reconciledMarks.push(newRecord);
        marksByRoll.set(roll, newRecord);
      }
    }

    this.marks.set(offeringId, reconciledMarks);

    return {
      marks: reconciledMarks,
      count: reconciledMarks.length,
    };
  }

  /**
   * Save marks for an offering.
   */
  async saveMarks(
    offeringId: string,
    updatedMarks: StudentMarksRecord[]
  ): Promise<{ savedCount: number; warnings: any[]; timestamp: string }> {
    const maxMarksMap: Record<string, number> = {
      mt1_co1: 10, mt1_co2: 10, mt1_co3: 10,
      mt2_co4: 10, mt2_co5: 10, mt2_co6: 10,
      ese_co1: 10, ese_co2: 12, ese_co3: 12,
      ese_co4: 10, ese_co5: 8, ese_co6: 8,
      ta: 10,
    };

    const warnings: Array<{ roll_no: string; component: string; value: number; max: number }> = [];

    for (const record of updatedMarks) {
      if (record.marks && typeof record.marks === "object") {
        for (const [comp, val] of Object.entries(record.marks)) {
          if (typeof val === "number") {
            const max = maxMarksMap[comp] ?? 10;
            if (val > max) {
              warnings.push({
                roll_no: record.roll_no,
                component: comp,
                value: val,
                max,
              });
            }
          }
        }
      }
    }

    // Save in canonical memory store
    this.marks.set(offeringId, updatedMarks);

    // Persist to Supabase
    const validOfferingUuid = toValidUuid(offeringId);
    try {
      const db = await getDbClient();
      const { data: enrollments } = await db
        .from("enrollments")
        .select("id, roll_no")
        .eq("course_offering_id", validOfferingUuid);

      const { data: components } = await db
        .from("assessment_components")
        .select("id, component_name")
        .eq("course_offering_id", validOfferingUuid);

      if (enrollments && components && enrollments.length > 0 && components.length > 0) {
        const enrollMap = new Map(enrollments.map((e: any) => [e.roll_no, e.id]));
        const compMap = new Map(components.map((c: any) => [c.component_name, c.id]));

        const marksToUpsert: Array<{
          enrollment_id: string;
          assessment_component_id: string;
          marks_obtained: number | null;
          status: string;
        }> = [];

        for (const record of updatedMarks) {
          const enrollId = enrollMap.get(record.roll_no);
          if (!enrollId) continue;

          for (const [compName, val] of Object.entries(record.marks || {})) {
            const compId = compMap.get(compName);
            if (!compId) continue;

            const isAbsent = val === "AB" || val === "A";
            const numVal = typeof val === "number" ? val : null;

            marksToUpsert.push({
              enrollment_id: enrollId,
              assessment_component_id: compId,
              marks_obtained: isAbsent ? null : numVal,
              status: isAbsent ? "ABSENT" : "PRESENT",
            });
          }
        }

        if (marksToUpsert.length > 0) {
          await db
            .from("student_marks")
            .upsert(marksToUpsert, { onConflict: "enrollment_id,assessment_component_id" });
        }
      }

      // Record audit log
      try {
        await db.from("audit_logs").insert({
          action: "UPDATE_MARKS",
          entity: "student_marks",
          entity_id: validOfferingUuid,
          payload: {
            offeringId,
            recordsCount: updatedMarks.length,
            warningsCount: warnings.length,
          },
        });
      } catch {}
    } catch {
      // Memory fallback
    }

    return {
      savedCount: updatedMarks.length,
      warnings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Delete student from roster and marks
   */
  async deleteStudent(offeringId: string, rollNo: string): Promise<boolean> {
    const roster = await this.getRoster(offeringId);
    const filteredRoster = roster.filter((s) => String(s.roll_no).trim() !== String(rollNo).trim());
    this.rosters.set(offeringId, filteredRoster);

    const marks = this.marks.get(offeringId) || [];
    const filteredMarks = marks.filter((m) => String(m.roll_no).trim() !== String(rollNo).trim());
    this.marks.set(offeringId, filteredMarks);

    // Delete in DB if reachable
    try {
      const db = await getDbClient();
      const validOfferingUuid = toValidUuid(offeringId);
      await db
        .from("enrollments")
        .delete()
        .eq("course_offering_id", validOfferingUuid)
        .eq("roll_no", rollNo);
    } catch {}

    return true;
  }
}

// Global singleton instance across Next.js API routes in the same Node.js process
const globalForOffering = global as unknown as { __offeringDomainStore?: OfferingDomainStore };
export const offeringStore = globalForOffering.__offeringDomainStore || new OfferingDomainStore();
if (process.env.NODE_ENV !== "production") globalForOffering.__offeringDomainStore = offeringStore;
