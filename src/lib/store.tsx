"use client";

import { useSyncExternalStore } from "react";
import type { AppState, ID } from "./types";
import { createDemoState } from "./demo/seed";
import { uid } from "./util";

/**
 * Workspace store. Two modes, never mixed:
 * - demo: lives only in this browser (localStorage, files in IndexedDB);
 * - cloud: a signed-in account. Loaded from Supabase and written back by
 *   src/lib/cloud/sync.ts; medical data is kept in memory only, not in localStorage.
 */

const KEY = "healthos-demo-v1";
let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch {
    return null;
  }
}

let cloudPersister: ((s: AppState) => void) | null = null;

/** Registered by the cloud sync layer. */
export function setCloudPersister(fn: ((s: AppState) => void) | null) {
  cloudPersister = fn;
}

function persist() {
  if (state?.mode === "cloud") {
    cloudPersister?.(state);
    return;
  }
  try {
    if (state) window.localStorage.setItem(KEY, JSON.stringify(state));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage full or blocked: the in-memory state still works for this session.
  }
}

function emit() {
  for (const l of listeners) l();
}

export function getState(): AppState | null {
  if (state === null && typeof window !== "undefined") state = load();
  return state;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && state?.mode !== "cloud") {
      state = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getState, () => null);
}

/** Apply an update; `audit` records sensitive operations (no medical content in the detail). */
export function update(fn: (s: AppState) => AppState, audit?: { action: string; detail: string }) {
  const current = getState();
  if (!current) return;
  let next = fn(current);
  if (audit) next = { ...next, audit: [{ id: uid("a"), at: new Date().toISOString(), ...audit }, ...next.audit].slice(0, 500) };
  state = next;
  persist();
  emit();
}

/** Switch to a signed-in account's workspace (loaded from the database). */
export function setCloudState(s: AppState) {
  state = s;
  emit();
}

/** Leave the signed-in workspace (after sign-out); falls back to any demo workspace in this browser. */
export function clearCloudState() {
  state = load();
  emit();
}

export function startDemo() {
  state = createDemoState();
  persist();
  emit();
}

export function startBlankWorkspace(name: string) {
  const s = createDemoState();
  const profileId = uid("p");
  state = {
    ...s,
    activeProfileId: profileId,
    settings: { ...s.settings, name, onboarded: false },
    profiles: [{ id: profileId, displayName: name || "Me", relationship: "self", createdAt: new Date().toISOString() }],
    grants: [],
    documents: [],
    observations: [],
    prescriptions: [],
    medicines: [],
    doseLogs: [],
    appointments: [],
    healthEntries: [],
    shareLinks: [],
    chat: [],
    audit: [{ id: uid("a"), at: new Date().toISOString(), action: "workspace.created", detail: "Empty demo workspace created" }],
  };
  persist();
  emit();
}

export function resetWorkspace() {
  if (state?.mode === "cloud") return; // live data is deleted through the privacy page, never by a local reset
  state = null;
  persist();
  emit();
}

export function activeProfileId(s: AppState): ID {
  return s.profiles.some((p) => p.id === s.activeProfileId) ? s.activeProfileId : s.profiles[0]?.id;
}
