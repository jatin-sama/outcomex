import { NextRequest, NextResponse } from "next/server";
import { offeringStore } from "@/lib/domain/offeringStore";
import { getDbClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") || "").toLowerCase().trim();
  const statusFilter = searchParams.get("status");

  try {
    let roster = await offeringStore.getRoster(id);

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

    const allStudents = await offeringStore.getRoster(id);

    return NextResponse.json({
      offering_id: id,
      total_count: allStudents.length,
      filtered_count: roster.length,
      roster,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load roster" },
      { status: 500 }
    );
  }
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

    if (!studentsToAdd.length || !studentsToAdd[0]?.roll_no) {
      return NextResponse.json(
        { error: "Roll number and student name are required." },
        { status: 400 }
      );
    }

    const result = await offeringStore.addStudentsToRoster(id, studentsToAdd);

    if (result.duplicates.length > 0 && result.added.length === 0) {
      return NextResponse.json(
        {
          error: `Roll number(s) already enrolled in this offering: ${result.duplicates.join(", ")}`,
          duplicates: result.duplicates,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      offering_id: id,
      added_count: result.added.length,
      skipped_duplicates: result.duplicates,
      total_roster_count: result.totalCount,
      added: result.added,
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

    const roster = await offeringStore.getRoster(id);
    const target = roster.find((s) => s.id === student_id || s.roll_no === student_id);

    if (!target) {
      return NextResponse.json({ error: "Student not found in roster." }, { status: 404 });
    }

    target.status = status;

    // Persist to Supabase if possible
    try {
      const db = await getDbClient();
      await db.from("enrollments").update({ status }).eq("id", target.id);
    } catch {}

    return NextResponse.json({
      success: true,
      student: target,
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
  const clearAll = searchParams.get("all") === "true" || searchParams.get("clear_all") === "true";

  if (clearAll) {
    await offeringStore.clearRoster(id);
    return NextResponse.json({
      success: true,
      cleared: true,
      remaining_count: 0,
    });
  }

  if (!studentId) {
    return NextResponse.json({ error: "student_id query param is required." }, { status: 400 });
  }

  await offeringStore.deleteStudent(id, studentId);
  const remaining = await offeringStore.getRoster(id);

  return NextResponse.json({
    success: true,
    deleted_id: studentId,
    remaining_count: remaining.length,
  });
}
