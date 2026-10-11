import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { aiConfigured, explainWithProvider } from "@/lib/server/ai";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";
import { requireUserForAi } from "@/lib/server/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  mode: z.enum(["simple", "detailed", "result", "terms", "summary", "questions", "language"]),
  language: z.string().max(40).optional(),
  focusTest: z.string().max(120).optional(),
  document: z.object({
    id: z.string().max(80),
    title: z.string().max(200),
    date: z.string().max(20).optional(),
    pages: z.array(z.string().max(20000)).max(20),
  }),
});

export async function POST(req: Request) {
  if (!aiConfigured()) return NextResponse.json({ error: "AI provider not configured" }, { status: 503 });
  const denied = await requireUserForAi();
  if (denied) return denied;
  const rl = await rateLimit(`ai:${clientKey(req)}`, 20, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    return NextResponse.json(await explainWithProvider(parsed.data));
  } catch (e) {
    // Never echo document content or provider internals back to the client or logs.
    const status = e instanceof Anthropic.RateLimitError ? 429 : 502;
    console.error("ai.explain failed", e instanceof Anthropic.APIError ? e.status : "network");
    return NextResponse.json({ error: "AI service unavailable" }, { status });
  }
}
