"use client";

/**
 * Client-side text extraction used in demo mode. The production pipeline runs
 * the same parsers server-side behind a replaceable OCR/document provider
 * (src/lib/server/providers.ts).
 */

export const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/heic": "HEIC",
  "image/heif": "HEIC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.docx,.txt," + Object.keys(ACCEPTED_TYPES).join(",");
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function detectMime(file: File): string {
  if (file.type && ACCEPTED_TYPES[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return (
    { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" }[ext ?? ""] ??
    file.type
  );
}

export function validateFile(file: File): string | null {
  const mime = detectMime(file);
  if (!ACCEPTED_TYPES[mime]) return `“${file.name}” isn’t a supported format. Use PDF, JPEG, PNG, HEIC, DOCX or TXT.`;
  if (file.size > MAX_FILE_BYTES) return `“${file.name}” is larger than 20 MB.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

export type ExtractOutcome =
  | { kind: "text"; pages: string[]; method: "text" | "pdf-text" | "docx" }
  | { kind: "needs_ocr"; reason: string }
  | { kind: "failed"; reason: string };

export async function extractText(file: File): Promise<ExtractOutcome> {
  const mime = detectMime(file);
  try {
    if (mime === "text/plain") return { kind: "text", pages: [await file.text()], method: "text" };
    if (mime === "application/pdf") {
      const pages = await pdfText(file);
      if (pages.join("").trim().length < 20) return { kind: "needs_ocr", reason: "This PDF has no text layer (it looks scanned), so it needs OCR." };
      return { kind: "text", pages, method: "pdf-text" };
    }
    if (mime.includes("wordprocessingml")) return { kind: "text", pages: [await docxText(file)], method: "docx" };
    return { kind: "needs_ocr", reason: "Images need OCR to read their text." };
  } catch {
    return { kind: "failed", reason: "The file was stored, but its text could not be read." };
  }
}

async function pdfText(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 50); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines from text items using their vertical position.
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: item.transform[4], s: item.str });
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.s).join("   ").replace(/\s{4,}/g, "   "));
    pages.push(lines.join("\n"));
  }
  return pages;
}

/** Minimal DOCX reader: finds word/document.xml in the zip and inflates it with DecompressionStream. */
async function docxText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip");
  let p = view.getUint32(eocd + 16, true);
  const count = view.getUint16(eocd + 10, true);
  for (let n = 0; n < count; n++) {
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (name === "word/document.xml") {
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtra = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtra;
      const data = buf.subarray(start, start + compSize);
      let xml: string;
      if (method === 0) xml = new TextDecoder().decode(data);
      else {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        xml = await new Response(stream).text();
      }
      return xml
        .replace(/<w:tab\/>/g, "   ")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("document.xml not found");
}

/** SHA-256 of a file's bytes, hex (recorded with the stored original). */
export async function fileSha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
