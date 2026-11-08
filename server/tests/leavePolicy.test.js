import test from "node:test";
import assert from "node:assert/strict";
import { leavePolicy } from "../config/leavePolicy.js";

test("leave allocations total exactly twenty days", () => {
  assert.equal(leavePolicy.sick + leavePolicy.casual + leavePolicy.emergency + leavePolicy.annual, 20);
  assert.equal(leavePolicy.total, 20);
});
