import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/** Refreshes the Supabase session cookie on each request when auth is configured. */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  if (!isSupabaseConfigured) return res;
  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  await sb.auth.getUser();
  return res;
}

export const config = { matcher: ["/app/:path*", "/auth/:path*", "/api/:path*"] };
