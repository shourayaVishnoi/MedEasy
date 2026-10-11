import { NextResponse } from "next/server";
import { aiConfigured, transcribeImage } from "@/lib/server/ai";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";
import { requireUserForAi } from "@/lib/server/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX = 8 * 1024 * 1024;

/** OCR through the configured AI provider. Only called after the user explicitly asks. */
export async function POST(req: Request) {
  if (!aiConfigured()) return NextResponse.json({ error: "OCR provider not configured" }, { status: 503 });
  const denied = await requireUserForAi();
  if (denied) return denied;
  const rl = await rateLimit(`ocr:${clientKey(req)}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size > MAX) return NextResponse.json({ error: "Unsupported image" }, { status: 400 });
  try {
    const text = await transcribeImage(Buffer.from(await file.arrayBuffer()).toString("base64"), file.type as "image/jpeg");
    return NextResponse.json({ pages: [text] });
  } catch {
    return NextResponse.json({ error: "OCR failed" }, { status: 502 });
  }
}
