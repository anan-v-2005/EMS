import test from "node:test";
import assert from "node:assert/strict";
import { getIndiaWeekday } from "../utils/date.js";

test("IST weekday calculation does not shift midnight dates to the previous UTC weekday", () => {
  assert.equal(getIndiaWeekday(new Date("2026-10-30T19:00:00.000Z")), 6); // 31 Oct, Saturday in IST
  assert.equal(getIndiaWeekday(new Date("2026-10-31T19:00:00.000Z")), 0); // 1 Nov, Sunday in IST
});
