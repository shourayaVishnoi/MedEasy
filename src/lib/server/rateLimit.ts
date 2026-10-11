import "server-only";

import { supabaseService } from "@/lib/supabase/server";

/**
 * Fixed-window limiter. Uses the database (shared by every server instance)
 * when the service key is configured, and falls back to per-instance memory.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfter: number }> {
  const db = supabaseService();
  if (db) {
    const { data, error } = await db.rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: Math.ceil(windowMs / 1000) });
    if (!error && typeof data === "number") return { ok: data === 0, retryAfter: data };
  }
  return memoryLimit(key, limit, windowMs);
}

function memoryLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  return b.count > limit ? { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) } : { ok: true, retryAfter: 0 };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
