import { NextRequest, NextResponse } from "next/server";
import { isValidUuid } from "@/lib/domain/offeringStore";
import { getAuthenticatedUser, authorizeOfferingAccess } from "@/lib/auth/authHelper";
import { generateMarksTemplate } from "@/lib/excel/templateGenerator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return NextResponse.json(
      { error: `Invalid offering ID "${id}": must be a valid RFC 4122 UUID.` },
      { status: 400 }
    );
  }

  try {
    const authCtx = await getAuthenticatedUser(request);
    if (!authCtx) {
      return NextResponse.json(
        { error: "Authentication required to download marks import template." },
        { status: 401 }
      );
    }

    const authCheck = await authorizeOfferingAccess(authCtx, id);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || "Unauthorized to access template for this course offering." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const formatParam = url.searchParams.get("format")?.toLowerCase();
    const format = formatParam === "csv" ? "csv" : "xlsx";
    const prefill = url.searchParams.get("prefill") !== "false";

    const result = await generateMarksTemplate(id, {
      format,
      prefillExistingMarks: prefill,
    });

    const response = new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.buffer.length.toString(),
        "X-OutcomeX-Schema": "outcomeX-marks-template-v1.0",
        "X-OutcomeX-Offering-Id": id,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to generate marks import template" },
      { status: 500 }
    );
  }
}
