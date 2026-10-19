import { NextRequest, NextResponse } from "next/server";
import { REFERENCE_STUDENTS, ReferenceStudent } from "@/lib/data/referenceStudents";
import { getDbClient } from "@/lib/supabase/admin";

let currentRosters: Record<string, ReferenceStudent[]> = {
  "o0000000-0000-0000-0000-000000000001": JSON.parse(JSON.stringify(REFERENCE_STUDENTS)),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") || "").toLowerCase().trim();
  const statusFilter = searchParams.get("status");

  let roster: ReferenceStudent[] = currentRosters[id] || [...REFERENCE_STUDENTS];

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
      .eq("course_offering_id", id)
      .order("roll_no", { ascending: true });

    if (!error && enrollments && enrollments.length > 0) {
      roster = enrollments.map((e: any) => ({
        id: e.id,
        roll_no: e.roll_no,
        student_name: e.students?.student_name || `Student ${e.roll_no}`,
        university_reg_no: e.students?.university_reg_no || e.roll_no,
        gender: e.students?.gender || "M",
        status: (e.status as any) || "ENROLLED",
      }));
      currentRosters[id] = roster;
    }
  } catch {
    // Fallback to cache/reference
  }

  if (query) {
    roster = roster.filter(
      (s) =>
        s.roll_no.toLowerCase().includes(query) ||
        s.student_name.toLowerCase().includes(query)
    );
  }

  if (statusFilter && statusFilter !== "ALL") {
    roster = roster.filter((s) => s.status === statusFilter);
  }

  return NextResponse.json({
    offering_id: id,
    total_count: (currentRosters[id] || REFERENCE_STUDENTS).length,
    filtered_count: roster.length,
    roster,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const studentsToAdd: Array<{ roll_no: string; student_name: string; status?: string }> =
      Array.isArray(body.students) ? body.students : [body];

    if (!studentsToAdd.length || !studentsToAdd[0].roll_no) {
      return NextResponse.json(
        { error: "Roll number and student name are required." },
        { status: 400 }
      );
    }

    const currentRoster = currentRosters[id] || [...REFERENCE_STUDENTS];
    const existingRolls = new Set(currentRoster.map((s) => s.roll_no.trim()));

    const duplicates: string[] = [];
    const added: ReferenceStudent[] = [];

    const db = await getDbClient();

    // Get a department ID
    let departmentId = "d0000000-0000-0000-0000-000000000001";
    try {
      const { data: depts } = await db.from("departments").select("id").limit(1);
      if (depts && depts.length > 0) departmentId = depts[0].id;
    } catch {}

    for (const student of studentsToAdd) {
      const roll = String(student.roll_no).trim();
      const name = String(student.student_name || "").trim();

      if (!roll || !name) continue;

      if (existingRolls.has(roll)) {
        duplicates.push(roll);
      } else {
        existingRolls.add(roll);

        let studentRecordId = `s-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        let enrollmentRecordId = studentRecordId;

        // Persist to Supabase
        try {
          const { data: newStudent } = await db
            .from("students")
            .insert({
              department_id: departmentId,
              student_name: name,
              university_reg_no: roll,
            })
            .select()
            .single();

          if (newStudent?.id) {
            studentRecordId = newStudent.id;
            const { data: newEnrollment } = await db
              .from("enrollments")
              .insert({
                course_offering_id: id,
                student_id: newStudent.id,
                roll_no: roll,
                status: (student.status as any) || "ENROLLED",
              })
              .select()
              .single();

            if (newEnrollment?.id) {
              enrollmentRecordId = newEnrollment.id;
            }
          }
        } catch {
          // Graceful local cache fallback
        }

        const newStudentObj: ReferenceStudent = {
          id: enrollmentRecordId,
          roll_no: roll,
          student_name: name,
          status: (student.status as any) || "ENROLLED",
        };
        added.push(newStudentObj);
      }
    }

    if (duplicates.length > 0 && added.length === 0) {
      return NextResponse.json(
        {
          error: `Roll number(s) already enrolled in this offering: ${duplicates.join(", ")}`,
          duplicates,
        },
        { status: 409 }
      );
    }

    currentRosters[id] = [...currentRoster, ...added];

    return NextResponse.json({
      success: true,
      offering_id: id,
      added_count: added.length,
      skipped_duplicates: duplicates,
      total_roster_count: currentRosters[id].length,
      added,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to add student(s) to roster" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { student_id, status } = body;

    if (!student_id || !["ENROLLED", "DROPPED", "DETAINED"].includes(status)) {
      return NextResponse.json(
        { error: "Valid student_id and status ('ENROLLED', 'DROPPED', 'DETAINED') are required." },
        { status: 400 }
      );
    }

    // Persist to Supabase
    try {
      const db = await getDbClient();
      await db
        .from("enrollments")
        .update({ status })
        .eq("id", student_id);
    } catch {}

    const currentRoster = currentRosters[id] || [...REFERENCE_STUDENTS];
    const index = currentRoster.findIndex((s) => s.id === student_id);

    if (index === -1) {
      return NextResponse.json({ error: "Student not found in roster." }, { status: 404 });
    }

    currentRoster[index].status = status;
    currentRosters[id] = [...currentRoster];

    return NextResponse.json({
      success: true,
      student: currentRoster[index],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update student status" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get("student_id");

  if (!studentId) {
    return NextResponse.json({ error: "student_id query param is required." }, { status: 400 });
  }

  // Persist deletion to Supabase
  try {
    const db = await getDbClient();
    await db.from("enrollments").delete().eq("id", studentId);
  } catch {}

  const currentRoster = currentRosters[id] || [...REFERENCE_STUDENTS];
  const initialLen = currentRoster.length;
  currentRosters[id] = currentRoster.filter((s) => s.id !== studentId);

  if (currentRosters[id].length === initialLen) {
    return NextResponse.json({ error: "Student not found in roster." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    deleted_id: studentId,
    remaining_count: currentRosters[id].length,
  });
}
