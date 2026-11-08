import test from "node:test";
import assert from "node:assert/strict";
import {
  listEmployeeAnalyticsNotes,
  createEmployeeAnalyticsNote,
  adminEmployeeTeamAverage,
  adminEmployeeComparison,
  adminEmployeeAnalytics,
} from "../controller/analyticsV2Controller.js";

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test("employee analytics notes reject non-admin reads before database access", async () => {
  const res = response();
  await listEmployeeAnalyticsNotes({ session: { role: "EMPLOYEE" }, params: { employeeId: "not-an-id" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, "Admin access required");
});

test("employee analytics notes validate employee IDs", async () => {
  const res = response();
  await listEmployeeAnalyticsNotes({ session: { role: "ADMIN" }, params: { employeeId: "bad-id" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /valid employee ID/i);
});

test("employee analytics note creation rejects non-admin writes", async () => {
  const res = response();
  await createEmployeeAnalyticsNote({ session: { role: "EMPLOYEE" }, params: { employeeId: "bad-id" }, body: { body: "private note" } }, res);
  assert.equal(res.statusCode, 403);
});

test("team average endpoint rejects invalid employee IDs", async () => {
  const res = response();
  await adminEmployeeTeamAverage({ session: { role: "ADMIN" }, query: { employeeId: "bad-id" } }, res);
  assert.equal(res.statusCode, 400);
});

test("employee analytics note schema rejects empty and oversized note bodies", async () => {
  const EmployeeAnalyticsNote = (await import("../models/EmployeeAnalyticsNote.js")).default;
  const mongoose = (await import("mongoose")).default;
  const ids = { employee: new mongoose.Types.ObjectId(), author: new mongoose.Types.ObjectId() };
  const empty = new EmployeeAnalyticsNote({ ...ids, body: "   " });
  await assert.rejects(empty.validate());
  const oversized = new EmployeeAnalyticsNote({ ...ids, body: "x".repeat(4001) });
  await assert.rejects(oversized.validate());
  const valid = new EmployeeAnalyticsNote({ ...ids, body: "Performance discussion follow-up" });
  await assert.doesNotReject(valid.validate());
});

test("employee comparison rejects non-admin access before database queries", async () => {
  const { adminEmployeeComparison } = await import("../controller/analyticsV2Controller.js");
  const res = response();
  await adminEmployeeComparison({ session: { role: "EMPLOYEE" }, query: {} }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, "Admin access required");
});

test("employee comparison validates custom date range before database queries", async () => {
  const { adminEmployeeComparison } = await import("../controller/analyticsV2Controller.js");
  const res = response();
  await adminEmployeeComparison({ session: { role: "ADMIN" }, query: { range: "custom", startDate: "not-a-date", endDate: "2026-10-31" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /custom startDate and endDate/i);
});

test("individual analytics rejects non-admin access before employee lookup", async () => {
  const { adminEmployeeAnalytics } = await import("../controller/analyticsV2Controller.js");
  const res = response();
  await adminEmployeeAnalytics({ session: { role: "EMPLOYEE" }, params: { employeeId: "not-an-id" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, "Admin access required");
});


test("comparison endpoint rejects non-admin access", async () => {
  const res = response();
  await adminEmployeeComparison({ session: { role: "EMPLOYEE" }, query: {} }, res);
  assert.equal(res.statusCode, 403);
});

test("individual analytics endpoint rejects non-admin access before querying employee data", async () => {
  const res = response();
  await adminEmployeeAnalytics({ session: { role: "EMPLOYEE" }, params: { employeeId: "bad-id" } }, res);
  assert.equal(res.statusCode, 403);
});

test("employee comparison rejects impossible calendar dates before database access", async () => {
  const { adminEmployeeComparison } = await import("../controller/analyticsV2Controller.js");
  const res = response();
  await adminEmployeeComparison({ session: { role: "ADMIN" }, query: { range: "custom", startDate: "2026-02-31", endDate: "2026-03-01" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /valid custom startDate/i);
});

test("employee comparison rejects unsupported employment types before database access", async () => {
  const { adminEmployeeComparison } = await import("../controller/analyticsV2Controller.js");
  const res = response();
  await adminEmployeeComparison({ session: { role: "ADMIN" }, query: { range: "30d", employmentType: "CASUAL" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /employment type/i);
});

test("employee model accepts supported employment classifications and rejects unknown values", async () => {
  const Employee = (await import("../models/Employee.js")).default;
  const mongoose = (await import("mongoose")).default;
  const valid = new Employee({
    userId: new mongoose.Types.ObjectId(), firstName: "Test", lastName: "Person",
    email: "test@example.com", phone: "9999999999", position: "Analyst",
    joinDate: new Date("2026-01-01"), employmentType: "FULL_TIME",
  });
  await assert.doesNotReject(valid.validate());
  const invalid = new Employee({
    userId: new mongoose.Types.ObjectId(), firstName: "Test", lastName: "Person",
    email: "test2@example.com", phone: "9999999999", position: "Analyst",
    joinDate: new Date("2026-01-01"), employmentType: "CASUAL",
  });
  await assert.rejects(invalid.validate());
});
