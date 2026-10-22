import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { uploads } from "@/db/schema";

/**
 * Storage for editor uploads (official notification PDFs).
 *
 * The deployment target (Vercel functions + Supabase Postgres) has no writable disk, so files
 * are kept in the `uploads` table by default (bounded by MAX_UPLOAD_BYTES). When
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set they go to a private Supabase Storage
 * bucket instead and only the key is stored. Either way files are served by /files/<id>/…,
 * which checks that the notice using the file is public.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const BUCKET = process.env.SUPABASE_UPLOAD_BUCKET?.trim() || "notice-files";

export class UploadError extends Error {}

/** Only PDFs are accepted, recognised by content (not by the claimed name or type). */
export function validatePdf(bytes: Uint8Array, name: string) {
  if (bytes.byteLength === 0) throw new UploadError("The file is empty.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadError(`The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const head = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (head !== "%PDF-") throw new UploadError("Only PDF files can be uploaded (the file content is not a PDF).");
  if (!/\.pdf$/i.test(name)) throw new UploadError("The file name must end in .pdf.");
}

/** A file name safe for storage keys and Content-Disposition headers. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "notice.pdf";
  const stem = base.replace(/\.pdf$/i, "").normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80);
  return `${stem || "notice"}.pdf`;
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

export async function saveUpload(db: DB, input: { bytes: Uint8Array; name: string; extractedText?: string | null; userId: number | null }) {
  validatePdf(input.bytes, input.name);
  return storeBytes(db, { ...input, fileName: safeFileName(input.name), contentType: "application/pdf" });
}

/** Stores an already-validated file (PDFs via saveUpload, logos re-encoded by src/lib/logos.ts). */
export async function storeBytes(db: DB, input: { bytes: Uint8Array; fileName: string; contentType: string; extractedText?: string | null; userId: number | null }) {
  const fileName = input.fileName;
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const sb = supabaseConfig();
  let storageKey: string | null = null;
  if (sb) {
    storageKey = `${sha256.slice(0, 2)}/${sha256}/${fileName}`;
    const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${storageKey}`, {
      method: "POST",
      headers: { authorization: `Bearer ${sb.key}`, "content-type": input.contentType, "x-upsert": "true" },
      body: Buffer.from(input.bytes),
    });
    if (!res.ok) throw new UploadError(`Storage upload failed (HTTP ${res.status}).`);
  }
  const [row] = await db
    .insert(uploads)
    .values({
      fileName,
      contentType: input.contentType,
      size: input.bytes.byteLength,
      sha256,
      storage: sb ? "supabase" : "database",
      storageKey,
      data: sb ? null : Buffer.from(input.bytes),
      extractedText: input.extractedText ? input.extractedText.slice(0, 20_000) : null,
      uploadedBy: input.userId,
    })
    .returning({ id: uploads.id, fileName: uploads.fileName, size: uploads.size });
  return row;
}

export async function readUpload(db: DB, id: number): Promise<{ fileName: string; contentType: string; bytes: Uint8Array } | null> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id));
  if (!row) return null;
  if (row.storage === "database") return row.data ? { fileName: row.fileName, contentType: row.contentType, bytes: new Uint8Array(row.data) } : null;
  const sb = supabaseConfig();
  if (!sb || !row.storageKey) return null;
  const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${row.storageKey}`, { headers: { authorization: `Bearer ${sb.key}` } });
  if (!res.ok) return null;
  return { fileName: row.fileName, contentType: row.contentType, bytes: new Uint8Array(await res.arrayBuffer()) };
}

/** Public URL path for an uploaded file (served by src/app/files/[id]/[name]/route.ts). */
export const uploadPath = (u: { id: number; fileName: string }) => `/files/${u.id}/${encodeURIComponent(u.fileName)}`;
