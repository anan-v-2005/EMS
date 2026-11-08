import test from "node:test";
import assert from "node:assert/strict";
import { leaveWorkdayEntries } from "../services/analyticsLeaveDays.js";

const ist = (day) => new Date(`${day}T00:00:00+05:30`);

test("leave workday calculation clips a leave request to the selected date range", () => {
  const entries = leaveWorkdayEntries(
    { startDate: ist("2026-09-30"), endDate: ist("2026-10-03") },
    ist("2026-10-01"), ist("2026-10-04"), [0, 6], new Set(),
  );
  assert.deepEqual(entries.map((entry) => entry.date), ["2026-10-01", "2026-10-02"]);
  assert.equal(entries.reduce((sum, entry) => sum + entry.days, 0), 2);
});

test("leave workday calculation excludes configured weekly offs and company holidays", () => {
  const entries = leaveWorkdayEntries(
    { startDate: ist("2026-10-01"), endDate: ist("2026-10-04") },
    ist("2026-10-01"), ist("2026-10-05"), [0, 6], new Set(["2026-10-02"]),
  );
  assert.deepEqual(entries.map((entry) => entry.date), ["2026-10-01"]);
});

test("single-day half-day leave contributes one half day", () => {
  const entries = leaveWorkdayEntries(
    { startDate: ist("2026-10-02"), endDate: ist("2026-10-02"), halfDay: true },
    ist("2026-10-01"), ist("2026-10-05"), [0, 6], new Set(),
  );
  assert.deepEqual(entries, [{ date: "2026-10-02", days: 0.5 }]);
});

test("half-day flag on a multi-day request does not halve the full range", () => {
  const entries = leaveWorkdayEntries(
    { startDate: ist("2026-10-01"), endDate: ist("2026-10-02"), halfDay: true },
    ist("2026-10-01"), ist("2026-10-03"), [0, 6], new Set(),
  );
  assert.equal(entries.reduce((sum, entry) => sum + entry.days, 0), 2);
});
