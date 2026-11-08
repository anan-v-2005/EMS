import test from "node:test";
import assert from "node:assert/strict";
import { attendanceCreditForRecord } from "../services/attendanceMath.js";

test("attendance credit weights full, late, three-quarter and half days consistently", () => {
  assert.equal(attendanceCreditForRecord({ status: "PRESENT", dayType: "Full Day" }), 1);
  assert.equal(attendanceCreditForRecord({ status: "LATE", dayType: "Full Day" }), 1);
  assert.equal(attendanceCreditForRecord({ status: "PRESENT", dayType: "Three Quarter Day" }), 0.75);
  assert.equal(attendanceCreditForRecord({ status: "PRESENT", dayType: "Half Day" }), 0.5);
});

test("absent and short days do not receive attendance credit", () => {
  assert.equal(attendanceCreditForRecord({ status: "ABSENT", dayType: "Short Day" }), 0);
  assert.equal(attendanceCreditForRecord({ status: "ABSENT", dayType: "Full Day" }), 0);
});
