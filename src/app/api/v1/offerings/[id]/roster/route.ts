import { NextRequest, NextResponse } from "next/server";
import { offeringStore, isValidUuid } from "@/lib/domain/offeringStore";
import { getDbClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json(
      { error: `Invalid offering ID "${id}": must be a valid UUID.` },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") || "").toLowerCase().trim();
  const statusFilter = searchParams.get("status");

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to view student roster." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized access to this offering." },
        { status: 403 }
      );
    }

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

  if (!isValidUuid(id)) {
    return NextResponse.json(
      { error: `Invalid offering ID "${id}": must be a valid UUID.` },
      { status: 400 }
    );
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to add students." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized access to this offering." },
        { status: 403 }
      );
    }

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

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid course offering ID." }, { status: 400 });
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.reason || "Unauthorized." }, { status: 403 });
    }

    const body = await request.json();
    const { student_id, status } = body;

    if (!student_id || !["ENROLLED", "DROPPED", "DETAINED"].includes(status)) {
      return NextResponse.json(
        { error: "Valid student_id and status ('ENROLLED', 'DROPPED', 'DETAINED') are required." },
        { status: 400 }
      );
    }

    const db = await getDbClient();
    const { data: updated, error } = await db
      .from("enrollments")
      .update({ status, updated_at: new Date().toISOString() })
      .match({ course_offering_id: id, id: student_id })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error updating student status: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      student: updated,
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

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid course offering ID." }, { status: 400 });
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.reason || "Unauthorized." }, { status: 403 });
    }

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
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete student from roster" },
      { status: 500 }
    );
  }
}
