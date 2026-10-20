import { NextRequest, NextResponse } from "next/server";
import { offeringStore } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser } from "@/lib/auth/authHelper";

export async function GET() {
  try {
    const courses = await offeringStore.getCourses();
    return NextResponse.json({ courses });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch courses", courses: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to create a course." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { course_code, course_name, semester, year_of_study, attainment_scheme_id, section } = body;

    if (!course_code || !course_name) {
      return NextResponse.json(
        { error: "Course code and course name are required." },
        { status: 400 }
      );
    }

    const createdCourse = await offeringStore.createCourse({
      course_code,
      course_name,
      semester,
      year_of_study,
      attainment_scheme_id,
      section,
      teacher_id: authCtx.user.id !== "00000000-0000-0000-0000-000000000000" ? authCtx.user.id : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        course: createdCourse,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create course" },
      { status: 500 }
    );
  }
}
