import { NextRequest, NextResponse } from "next/server";
import { offeringStore, isValidUuid } from "@/lib/domain/offeringStore";
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

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to view student marks." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized to access marks for this offering." },
        { status: 403 }
      );
    }

    const { marks, count, components } = await offeringStore.getMarks(id);

    return NextResponse.json({
      offering_id: id,
      count,
      components,
      marks,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load marks" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
        { error: "Authentication required to update marks." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized to update marks for this offering." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { updatedMarks } = body;

    if (!Array.isArray(updatedMarks)) {
      return NextResponse.json(
        { error: "Invalid updatedMarks payload. Expected an array of student marks." },
        { status: 400 }
      );
    }

    const result = await offeringStore.saveMarks(id, updatedMarks);

    return NextResponse.json({
      success: true,
      offering_id: id,
      saved_count: result.savedCount,
      has_validation_warnings: result.warnings.length > 0,
      validation_warnings: result.warnings,
      last_saved_at: result.timestamp,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update marks grid" },
      { status: 500 }
    );
  }
}
