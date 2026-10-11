"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { getState } from "@/lib/store";
import { findShareLink, shareLinkState } from "@/lib/share";
import type { AppState, ShareLink } from "@/lib/types";
import { PacketView } from "@/components/PacketView";
import { Logo } from "@/components/Logo";
import { LoadingPage } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadSharedPacket } from "@/lib/cloud/sync";

/**
 * Read-only view for a private share link. The token is in the URL fragment,
 * so it isn't sent to the server or written to access logs. In demo mode the
 * link resolves only against this browser's workspace.
 */
export default function SharedView() {
  const [result, setResult] = useState<{ state: AppState; link: ShareLink } | "invalid" | "expired" | "revoked" | null>(null);
  useEffect(() => {
    const token = window.location.hash.slice(1);
    const state = getState();
    const link = state?.mode === "demo" && token ? findShareLink(state.shareLinks, token) : undefined;
    if (link || !isSupabaseConfigured || !token) {
      const st = shareLinkState(link);
      setResult(st === "active" && state && link ? { state, link } : st === "active" ? "invalid" : st);
      return;
    }
    // Live link: the server checks the token's fingerprint, expiry and revocation.
    loadSharedPacket(token)
      .then((r) => setResult(r ?? "invalid"))
      .catch(() => setResult("invalid"));
  }, []);

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8">
      <Logo />
      <div className="mt-6">
        {result === null && <LoadingPage />}
        {typeof result === "string" && (
          <div className="rounded-3xl border border-line bg-surface p-8 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-warn" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold">{result === "expired" ? "This link has expired" : result === "revoked" ? "This link was revoked" : "This link isn’t valid or is no longer available"}</h1>
            <p className="mt-1 text-sm text-muted">Ask the person who shared it to send a new link.</p>
          </div>
        )}
        {result && typeof result === "object" && (
          <PacketView state={result.state} profileId={result.link.profileId} documentIds={result.link.documentIds} meds={result.link.includeMedications} appts={result.link.includeAppointments} heading={`Shared records · link expires ${new Date(result.link.expiresAt).toLocaleString()}`} />
        )}
      </div>
    </main>
  );
}
