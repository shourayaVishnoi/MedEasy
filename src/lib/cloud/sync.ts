"use client";

/**
 * Keeps a signed-in account's workspace in Supabase. The app edits the
 * in-memory workspace as in demo mode; this module loads it from the database
 * and writes back only the rows that changed. RLS on every table decides what
 * this account can read and write.
 */
import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseBrowser } from "../supabase/client";
import type { AppState } from "../types";
import { TABLES, diffRows, fromRows, toRows, type Rows } from "./tables";

export const BUCKET = "medical-documents";
const PAGE = 1000;
const ACTIVE_KEY = "healthos-active-profile";

let client: SupabaseClient | null = null;
export function cloudClient() {
  client ??= supabaseBrowser();
  return client;
}

// ------------------------------------------------------------------ status

export interface SyncStatus {
  state: "idle" | "saving" | "error" | "offline";
  message?: string;
  savedAt?: string;
}
let status: SyncStatus = { state: "idle" };
const statusListeners = new Set<() => void>();
function setStatus(s: SyncStatus) {
  status = s;
  for (const l of statusListeners) l();
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => status,
    () => status,
  );
}

// ------------------------------------------------------------------ load

async function selectAll(sb: SupabaseClient, table: string): Promise<Rows[string]> {
  const out: Rows[string] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select("*").range(from, from + PAGE - 1);
    if (table === "audit_logs") q = q.order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(`Couldn’t load your records (${table}).`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE || table === "audit_logs") break;
  }
  return out;
}

let synced: Rows | null = null;
let userId = "";

/** Loads everything this account can see. Creates a first profile for a new account. */
export async function loadCloudWorkspace(): Promise<AppState> {
  const sb = cloudClient();
  if (!sb) throw new Error("Not configured");
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  userId = auth.user.id;
  await sb.rpc("accept_pending_grants").then(
    () => undefined,
    () => undefined,
  );
  const rows: Rows = {};
  for (const t of TABLES) rows[t.name] = await selectAll(sb, t.name);
  let active: string | undefined;
  try {
    active = localStorage.getItem(`${ACTIVE_KEY}:${userId}`) ?? undefined;
  } catch {}
  const state = fromRows(rows, userId, active);
  // What the database holds now, in the same shape toRows produces.
  synced = toRows(state, userId);
  if (!rows.accounts.length) synced.accounts = [];
  if (!rows.notification_preferences.length) synced.notification_preferences = [];

  if (!state.profiles.some((p) => p.ownerId === userId)) {
    const meta = auth.user.user_metadata as { full_name?: string; name?: string } | undefined;
    const name = meta?.full_name ?? meta?.name ?? "";
    const id = crypto.randomUUID();
    state.profiles = [{ id, ownerId: userId, displayName: name || "Me", relationship: "self", createdAt: new Date().toISOString() }, ...state.profiles];
    state.activeProfileId = id;
    state.settings = { ...state.settings, name: state.settings.name || name.split(" ")[0] || "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", reminderEmail: state.settings.reminderEmail ?? auth.user.email ?? undefined, reminderPhone: state.settings.reminderPhone ?? (auth.user.phone ? `+${auth.user.phone.replace(/^\+/, "")}` : undefined) };
    queueMicrotask(() => persistCloud(state));
  }
  setStatus({ state: "idle", savedAt: new Date().toISOString() });
  return state;
}

// ------------------------------------------------------------------ save

let pending: AppState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;

/** Called by the store after every change in cloud mode. Writes are batched briefly. */
export function persistCloud(state: AppState) {
  if (state.mode !== "cloud" || !state.userId) return;
  try {
    localStorage.setItem(`${ACTIVE_KEY}:${state.userId}`, state.activeProfileId);
  } catch {}
  pending = state;
  // Show "Saving…" from the moment there's something unsaved, not only while the request runs.
  if (status.state === "idle") setStatus({ ...status, state: "saving" });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 250);
}

let loop: Promise<void> | null = null;

/** Writes pending changes. Single-flight: concurrent callers share one run. */
export function flush(): Promise<void> {
  loop ??= (async () => {
    while (pending) {
      const state = pending;
      pending = null;
      if (!(await writeOnce(state))) break;
    }
  })().finally(() => {
    loop = null;
  });
  return loop;
}

async function writeOnce(state: AppState): Promise<boolean> {
  const sb = cloudClient();
  if (!sb || !synced) return true;
  const plan = diffRows(synced, toRows(state, userId));
  if (!plan.upserts.length && !plan.deletes.length) {
    if (!pending) setStatus({ state: "idle", savedAt: status.savedAt });
    return true;
  }
  setStatus({ ...status, state: "saving" });
  try {
    for (const { table, rows } of plan.upserts) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from(table.name).upsert(rows.slice(i, i + 500), { onConflict: table.pk.join(","), ignoreDuplicates: !!table.appendOnly });
        if (error) throw new Error(error.code === "42501" ? "You don’t have permission to change this record." : "Some changes couldn’t be saved.");
      }
      // Record progress per table so a retry doesn't resend what already landed.
      synced[table.name] = mergeTable(synced[table.name] ?? [], rows, table.pk);
    }
    for (const { table, keys } of plan.deletes) {
      if (table.pk.length === 1) {
        const k = table.pk[0];
        const { error } = await sb.from(table.name).delete().in(k, keys.map((x) => x[k] as string));
        if (error) throw new Error("Some deletions couldn’t be saved.");
      } else {
        for (const key of keys) {
          const { error } = await sb.from(table.name).delete().match(key);
          if (error) throw new Error("Some deletions couldn’t be saved.");
        }
      }
      const gone = new Set(keys.map((x) => table.pk.map((k) => String(x[k])).join("|")));
      synced[table.name] = (synced[table.name] ?? []).filter((row) => !gone.has(table.pk.map((k) => String(row[k])).join("|")));
    }
    retryDelay = 2000;
    if (!pending) setStatus({ state: "idle", savedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    setStatus({ state: offline ? "offline" : "error", message: e instanceof Error ? e.message : "Changes couldn’t be saved." });
    pending ??= state;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
    return false;
  }
}

function mergeTable(current: Rows[string], written: Rows[string], pk: string[]) {
  const key = (r: Rows[string][number]) => pk.map((k) => String(r[k])).join("|");
  const byKey = new Map(current.map((r) => [key(r), r]));
  for (const r of written) byKey.set(key(r), r);
  return [...byKey.values()];
}

/** Retry now (e.g. from the "couldn't save" banner). */
export function retrySync(state: AppState | null) {
  retryDelay = 2000;
  if (state) pending ??= state;
  void flush();
}

export function hasUnsavedChanges() {
  return !!pending || status.state === "saving" || status.state === "error" || status.state === "offline";
}

export async function signOutCloud() {
  await flush().catch(() => undefined);
  synced = null;
  pending = null;
  userId = "";
  await cloudClient()?.auth.signOut();
}

// ------------------------------------------------------------------ files

const safeName = (n: string) => n.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-120) || "file";

export function storagePath(profileId: string, documentId: string, fileName: string) {
  return `${profileId}/${documentId}/1/${safeName(fileName)}`;
}

export async function uploadOriginal(path: string, blob: Blob) {
  const sb = cloudClient();
  if (!sb) throw new Error("Not configured");
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
  if (error) throw new Error("Upload failed");
}

export async function downloadOriginal(path: string): Promise<Blob | undefined> {
  const { data } = (await cloudClient()?.storage.from(BUCKET).download(path)) ?? {};
  return data ?? undefined;
}

export async function removeOriginal(path: string) {
  await cloudClient()?.storage.from(BUCKET).remove([path]);
}

/** Read-only packet for a share link (anyone with the token; no sign-in needed). */
export async function loadSharedPacket(token: string) {
  const sb = cloudClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc("shared_packet", { token });
  if (error || !data) return null;
  const { link, ...rows } = data as Rows & { link: Record<string, unknown> };
  const state = fromRows(rows as Rows, "", String(link.profile_id));
  return {
    state,
    link: {
      id: String(link.id), profileId: String(link.profile_id), token: "", label: String(link.label), documentIds: (link.document_ids as string[]) ?? [],
      includeMedications: !!link.include_medications, includeAppointments: !!link.include_appointments, expiresAt: String(link.expires_at), createdAt: "",
    },
  };
}
