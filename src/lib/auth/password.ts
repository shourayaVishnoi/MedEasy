export interface PasswordCheck {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  problems: string[];
}

const COMMON = ["password", "123456", "qwerty", "letmein", "welcome", "healthos", "iloveyou", "admin"];

/** Client-side strength guidance. The auth provider enforces its own policy and hashes passwords; we never store them. */
export function checkPassword(pw: string, context: string[] = []): PasswordCheck {
  const problems: string[] = [];
  if (pw.length < 10) problems.push("Use at least 10 characters.");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) problems.push("Mix upper- and lower-case letters, numbers or symbols.");
  const lower = pw.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) problems.push("Avoid common words like “password”.");
  if (context.some((c) => c && c.length >= 3 && lower.includes(c.toLowerCase()))) problems.push("Don’t include your name, email or phone number.");
  if (/(.)\1{3,}/.test(pw)) problems.push("Avoid repeating the same character.");
  const score = Math.max(0, Math.min(4, (pw.length >= 14 ? 2 : pw.length >= 10 ? 1 : 0) + (classes >= 3 ? 1 : 0) + (classes === 4 ? 1 : 0) - (problems.length > 1 ? 1 : 0))) as PasswordCheck["score"];
  return { ok: problems.length === 0, score, problems };
}
