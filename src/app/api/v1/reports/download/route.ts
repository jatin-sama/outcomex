import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json({ error: "filename query param is required" }, { status: 400 });
  }

  // Prevent directory traversal
  const safeFilename = path.basename(filename);
  let filePath = path.join(process.cwd(), "exports", safeFilename);
  if (!fs.existsSync(filePath)) {
    const tmpExportsPath = path.join(require("os").tmpdir(), "exports", safeFilename);
    if (fs.existsSync(tmpExportsPath)) {
      filePath = tmpExportsPath;
    }
  }

  if (!fs.existsSync(filePath)) {
    // If not in exports, check reference directory
    const refPath = path.join(process.cwd(), "reference", safeFilename);
    if (!fs.existsSync(refPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    const fileBuffer = fs.readFileSync(refPath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
