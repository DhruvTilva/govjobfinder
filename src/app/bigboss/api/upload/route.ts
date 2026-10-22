import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { audit, currentAdmin } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, saveUpload, UploadError, uploadPath, validatePdf } from "@/lib/storage";
import { pdfToText } from "@/pipeline/documents";
import { suggestFromText } from "@/lib/content-suggest";

export const runtime = "nodejs";

/**
 * Uploads an official notification PDF for the content editor and returns suggested field
 * values extracted from its text. Nothing is published here: the editor reviews the
 * suggestions in the form and saves explicitly.
 */
export async function POST(req: NextRequest) {
  const user = await currentAdmin();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  // Cross-site request protection (session cookie is SameSite=Strict as well).
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (req.headers.get("sec-fetch-site") === "cross-site" || (origin && host && new URL(origin).host !== host)) {
    return NextResponse.json({ error: "Cross-site upload refused." }, { status: 403 });
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return NextResponse.json({ error: `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` }, { status: 413 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Choose a PDF file." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  let warning: string | undefined;
  try {
    // Validate before parsing so a non-PDF never reaches the PDF parser.
    validatePdf(bytes, file.name);
    text = await pdfToText(bytes).catch(() => "");
    if (text.length < 200) warning = "Little or no text could be extracted (the PDF may be scanned). Fill in the fields by hand.";
    const db = await getDb();
    const saved = await saveUpload(db, { bytes, name: file.name, extractedText: text, userId: user.id });
    await audit(user.id, "upload", "file", String(saved.id), { name: saved.fileName, size: saved.size });
    return NextResponse.json({ id: saved.id, fileName: saved.fileName, size: saved.size, url: uploadPath(saved), textChars: text.length, suggestions: text.length >= 200 ? suggestFromText(text) : {}, warning });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
