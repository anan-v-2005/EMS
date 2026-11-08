import test from "node:test";
import assert from "node:assert/strict";
import { validateMoney, validatePhone } from "../utils/validation.js";

test("phone: accepts normal numbers and common separators", () => {
  for (const ok of ["9876543210", "+91 98765 43210", "+1 (415) 555-0132", "022-2345-6789", "1234567"]) {
    assert.equal(validatePhone(ok).error, undefined, ok);
  }
});

test("phone: rejects the excessively long number from the bug report, letters and too-short values", () => {
  assert.match(validatePhone("455656549845465646849848464565465454").error, /between 7 and 15 digits/);
  assert.ok(validatePhone("98765abc10").error);
  assert.ok(validatePhone("12345").error);
  assert.ok(validatePhone("   ").error);
  assert.ok(validatePhone("98+76543210").error, "+ only allowed at the start");
});

test("money: accepts realistic values and rounds to 2 decimals", () => {
  assert.deepEqual(validateMoney("50000", "Basic salary"), { value: 50000 });
  assert.deepEqual(validateMoney(45000.5, "Basic salary"), { value: 45000.5 });
  assert.deepEqual(validateMoney("", "Allowances"), { value: 0 });
  assert.deepEqual(validateMoney(undefined, "Allowances"), { value: 0 });
  assert.deepEqual(validateMoney("10000000", "Basic salary"), { value: 10000000 });
});

test("money: rejects the unrealistic salary from the bug report and other bad input", () => {
  assert.match(validateMoney("1000001212120", "Basic salary").error, /cannot exceed/);
  assert.match(validateMoney(1000001212120, "Basic salary").error, /cannot exceed/);
  assert.ok(validateMoney("10000001", "Basic salary").error);
  assert.ok(validateMoney("-5", "Basic salary").error);
  assert.ok(validateMoney("abc", "Basic salary").error);
  assert.ok(validateMoney("1e9", "Basic salary").error);
  assert.ok(validateMoney("₹10,00,00,01,21,212.00", "Basic salary").error);
  assert.ok(validateMoney("100.123", "Basic salary").error);
  assert.ok(validateMoney("", "Basic salary", { required: true }).error);
});
