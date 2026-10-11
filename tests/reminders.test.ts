import { describe, expect, it } from "vitest";
import { inQuietHours, MAX_ATTEMPTS, planReminders, recordAttempt } from "@/lib/meds/reminders";
import type { Medicine } from "@/lib/types";

const med: Medicine = { id: "m1", profileId: "p1", name: "Sample", dose: "1 tablet", status: "active", createdAt: "", schedule: { times: ["08:00", "23:00"], weekdays: [], startDate: "2026-01-01", timezone: "UTC" } };
const prefs = { channels: ["browser" as const, "email" as const], timezone: "UTC", quietHours: { start: "22:30", end: "07:00" } };

describe("reminder planning", () => {
  it("plans each occurrence once per channel", () => {
    const ev = planReminders([med], prefs, new Set(), new Date("2026-03-05T07:50:00Z"));
    expect(ev.map((e) => e.idempotencyKey)).toEqual(["m1|2026-03-05|08:00|browser", "m1|2026-03-05|08:00|email"]);
  });

  it("does not duplicate reminders when the job is retried", () => {
    const keys = new Set<string>();
    const first = planReminders([med], prefs, keys, new Date("2026-03-05T07:50:00Z"));
    const retry = planReminders([med], prefs, keys, new Date("2026-03-05T07:52:00Z"));
    expect(first).toHaveLength(2);
    expect(retry).toHaveLength(0);
  });

  it("holds reminders during quiet hours instead of dropping them", () => {
    const ev = planReminders([med], prefs, new Set(), new Date("2026-03-05T22:50:00Z"));
    expect(ev.every((e) => e.status === "held_quiet_hours")).toBe(true);
    expect(inQuietHours(new Date("2026-03-05T06:59:00Z"), prefs)).toBe(true);
    expect(inQuietHours(new Date("2026-03-05T07:00:00Z"), prefs)).toBe(false);
  });

  it("respects end dates and paused medicines", () => {
    expect(planReminders([{ ...med, schedule: { ...med.schedule, endDate: "2026-03-04" } }], prefs, new Set(), new Date("2026-03-05T07:50:00Z"))).toHaveLength(0);
    expect(planReminders([{ ...med, status: "paused" }], prefs, new Set(), new Date("2026-03-05T07:50:00Z"))).toHaveLength(0);
  });

  it("retries failed deliveries, then records the failure", () => {
    let e = planReminders([med], prefs, new Set(), new Date("2026-03-05T07:50:00Z"))[0];
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      e = recordAttempt(e, false, "timeout");
      expect(e.status).toBe("queued");
    }
    e = recordAttempt(e, false, "timeout");
    expect(e.status).toBe("failed");
    expect(e.lastError).toBe("timeout");
    expect(recordAttempt({ ...e, status: "queued" }, true).status).toBe("sent");
  });
});
