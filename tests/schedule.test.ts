import { describe, expect, it } from "vitest";
import { occurrencesOn, occurrenceState, scheduleAppliesOn, validateSchedule } from "@/lib/meds/schedule";
import type { Medicine } from "@/lib/types";
import { zonedToUtc } from "@/lib/util";

const med = (p: Omit<Partial<Medicine>, "schedule"> & { schedule?: Partial<Medicine["schedule"]> } = {}): Medicine => ({
  id: "m1", profileId: "p1", name: "Sample", dose: "1 tablet", status: "active", createdAt: "",
  ...p,
  schedule: { times: ["08:00", "20:00"], weekdays: [], startDate: "2026-03-01", timezone: "UTC", ...p.schedule },
});

describe("medication schedules", () => {
  it("respects start and end dates", () => {
    const m = med({ schedule: { endDate: "2026-03-10" } });
    expect(occurrencesOn([m], "2026-02-28")).toHaveLength(0);
    expect(occurrencesOn([m], "2026-03-01")).toHaveLength(2);
    expect(occurrencesOn([m], "2026-03-10")).toHaveLength(2);
    expect(occurrencesOn([m], "2026-03-11")).toHaveLength(0);
  });

  it("supports selected weekdays and one-time reminders", () => {
    const weekly = med({ schedule: { weekdays: [0] } }); // Sundays
    expect(scheduleAppliesOn(weekly.schedule, "2026-03-01")).toBe(true); // a Sunday
    expect(scheduleAppliesOn(weekly.schedule, "2026-03-02")).toBe(false);
    const once = med({ schedule: { oneTime: true } });
    expect(occurrencesOn([once], "2026-03-01")).toHaveLength(2);
    expect(occurrencesOn([once], "2026-03-02")).toHaveLength(0);
  });

  it("paused and completed medicines generate no doses", () => {
    expect(occurrencesOn([med({ status: "paused" })], "2026-03-05")).toHaveLength(0);
    expect(occurrencesOn([med({ status: "completed" })], "2026-03-05")).toHaveLength(0);
  });

  it("converts local times across daylight-saving changes", () => {
    // New York: EST (UTC-5) before 8 Mar 2026, EDT (UTC-4) after.
    expect(zonedToUtc("2026-03-07", "08:00", "America/New_York").toISOString()).toBe("2026-03-07T13:00:00.000Z");
    expect(zonedToUtc("2026-03-09", "08:00", "America/New_York").toISOString()).toBe("2026-03-09T12:00:00.000Z");
    expect(zonedToUtc("2026-06-01", "09:30", "Asia/Kolkata").toISOString()).toBe("2026-06-01T04:00:00.000Z");
  });

  it("keeps the same local time after a timezone change", () => {
    const [a] = occurrencesOn([med({ schedule: { times: ["08:00"], timezone: "Europe/London" } })], "2026-07-01");
    const [b] = occurrencesOn([med({ schedule: { times: ["08:00"], timezone: "Asia/Tokyo" } })], "2026-07-01");
    expect(a.time).toBe(b.time);
    expect(a.scheduledFor.getTime()).not.toBe(b.scheduledFor.getTime());
  });

  it("never assumes an unrecorded past dose was taken or missed", () => {
    const [o] = occurrencesOn([med()], "2026-03-05");
    expect(occurrenceState(o, undefined, new Date("2026-03-05T07:00:00Z"))).toBe("upcoming");
    expect(occurrenceState(o, undefined, new Date("2026-03-05T08:30:00Z"))).toBe("due");
    expect(occurrenceState(o, undefined, new Date("2026-03-05T12:00:00Z"))).toBe("not_recorded");
    const log = { id: "l", profileId: "p1", medicineId: "m1", occurrenceKey: o.key, scheduledFor: "", status: "skipped" as const, recordedAt: "" };
    expect(occurrenceState(o, log, new Date("2026-03-05T12:00:00Z"))).toBe("skipped");
  });

  it("requires user-chosen times and valid dates", () => {
    expect(validateSchedule({ times: [], startDate: "2026-01-01", timezone: "UTC" }).join()).toMatch(/at least one time/);
    expect(validateSchedule({ times: ["25:00"], startDate: "2026-01-01", timezone: "UTC" }).join()).toMatch(/not a valid time/);
    expect(validateSchedule({ times: ["08:00"], startDate: "2026-02-01", endDate: "2026-01-01", timezone: "UTC" }).join()).toMatch(/before the start/);
    expect(validateSchedule({ times: ["08:00", "08:00"], startDate: "2026-01-01", timezone: "UTC" }).join()).toMatch(/twice/);
    expect(validateSchedule({ times: ["08:00"], startDate: "2026-01-01", timezone: "UTC" })).toEqual([]);
  });
});
