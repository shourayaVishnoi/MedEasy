"use client";

import { CloudCheck, CloudOff, LoaderCircle, RotateCw } from "lucide-react";
import { retrySync, useSyncStatus } from "@/lib/cloud/sync";
import { getState } from "@/lib/store";

/** Save state for signed-in accounts. Errors stay visible until a save succeeds. */
export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const s = useSyncStatus();
  if (s.state === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted" role="status">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
      </span>
    );
  if (s.state === "error" || s.state === "offline")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger" role="alert">
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        {compact ? "Not saved" : s.state === "offline" ? "Offline – changes not saved yet" : (s.message ?? "Changes not saved")}
        <button className="inline-flex items-center gap-1 underline underline-offset-2" onClick={() => retrySync(getState())}>
          <RotateCw className="h-3 w-3" aria-hidden /> Retry
        </button>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" role="status">
      <CloudCheck className="h-3.5 w-3.5 text-ok" aria-hidden /> {compact ? "Saved" : "All changes saved"}
    </span>
  );
}

/** Small-screen banner: only shown when changes couldn't be saved. */
export function SyncErrorBanner() {
  const s = useSyncStatus();
  if (s.state !== "error" && s.state !== "offline") return null;
  return (
    <div className="mb-4 sm:hidden">
      <SyncStatus />
    </div>
  );
}
