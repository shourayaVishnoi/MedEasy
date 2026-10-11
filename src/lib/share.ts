import type { ShareLink } from "./types";

export type ShareLinkState = "active" | "expired" | "revoked" | "invalid";

export function shareLinkState(link: ShareLink | undefined, now = new Date()): ShareLinkState {
  if (!link) return "invalid";
  if (link.revokedAt) return "revoked";
  if (new Date(link.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

/** Constant-time lookup by token so timing doesn't reveal partial matches. */
export function findShareLink(links: ShareLink[], token: string): ShareLink | undefined {
  let found: ShareLink | undefined;
  for (const l of links) {
    if (l.token.length !== token.length) continue;
    let diff = 0;
    for (let i = 0; i < token.length; i++) diff |= l.token.charCodeAt(i) ^ token.charCodeAt(i);
    if (diff === 0) found = l;
  }
  return found;
}

export const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
];
