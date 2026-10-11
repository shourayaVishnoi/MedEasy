import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** OAuth (Google) redirect target: exchanges the code for a session cookie. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/app";
  // Only allow same-site relative redirects.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";
  const sb = await supabaseServer();
  if (!sb || !code) return NextResponse.redirect(new URL("/auth/sign-in?error=oauth", url.origin));
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/auth/sign-in?error=oauth", url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
