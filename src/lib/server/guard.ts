import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Paid AI routes require a signed-in user whenever Supabase auth is configured,
 * so anonymous visitors can't spend the provider budget. Set
 * AI_ALLOW_ANONYMOUS=true to let demo visitors use them (rate limits still apply).
 */
export async function requireUserForAi(): Promise<NextResponse | null> {
  if (process.env.AI_ALLOW_ANONYMOUS === "true") return null;
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ? null : NextResponse.json({ error: "Sign in to use the AI provider" }, { status: 401 });
}
