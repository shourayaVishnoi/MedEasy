import { NextResponse } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Permanently deletes the signed-in account: original files first, then the
 * auth user (every table cascades from it). Profiles shared *with* this account
 * belong to someone else and are not touched.
 */
export async function POST(req: Request) {
  // Same-origin only: a cross-site form can't trigger this.
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") return NextResponse.json({ error: "Confirmation missing" }, { status: 400 });

  const sb = await supabaseServer();
  const admin = supabaseService();
  if (!sb || !admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profiles } = await admin.from("health_profiles").select("id").eq("owner_id", user.id);
  const ids = (profiles ?? []).map((p) => p.id as string);
  if (ids.length) {
    const { data: docs } = await admin.from("documents").select("id, document_versions(storage_path)").in("profile_id", ids);
    const paths = (docs ?? []).flatMap((d) => ((d.document_versions as { storage_path: string }[] | null) ?? []).map((v) => v.storage_path));
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from("medical-documents").remove(paths.slice(i, i + 100));
      if (error) return NextResponse.json({ error: "Files couldn’t be deleted; nothing else was removed. Please try again." }, { status: 502 });
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Account couldn’t be deleted. Please try again." }, { status: 502 });
  await sb.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
