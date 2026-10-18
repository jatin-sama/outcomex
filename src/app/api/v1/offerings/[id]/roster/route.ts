import { NextRequest, NextResponse } from "next/server";
import { REFERENCE_STUDENTS, ReferenceStudent } from "@/lib/data/referenceStudents";

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

  let roster = currentRosters[id] || [...REFERENCE_STUDENTS];

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

    for (const student of studentsToAdd) {
      const roll = String(student.roll_no).trim();
      const name = String(student.student_name || "").trim();

      if (!roll || !name) continue;

      if (existingRolls.has(roll)) {
        duplicates.push(roll);
      } else {
        existingRolls.add(roll);
        const newStudent: ReferenceStudent = {
          id: `s-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          roll_no: roll,
          student_name: name,
          status: (student.status as any) || "ENROLLED",
        };
        added.push(newStudent);
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
