"use client";

import { useEffect, useState } from "react";
import { activeProfileId, useAppState } from "./store";
import type { AppState, Profile } from "./types";

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export interface Workspace {
  state: AppState;
  profileId: string;
  profile: Profile;
}

/** Current workspace scoped to the active profile. Every page reads data through this. */
export function useWorkspace(): Workspace | null {
  const state = useAppState();
  if (!state) return null;
  const profileId = activeProfileId(state);
  const profile = state.profiles.find((p) => p.id === profileId)!;
  return { state, profileId, profile };
}

/** Tick every `ms` so time-dependent views (due doses) stay current. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
