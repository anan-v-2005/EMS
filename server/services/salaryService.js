// Salary single source of truth.
//
//   Salary collection (salary structures)  = the ONLY place pay is stored.
//   Employee.basicSalary / Employee.allowance = a read-only mirror of the CURRENT structure, kept in
//   sync by syncEmployeeMirror() so older code paths and exports never show stale numbers.
//   Employee.deductions = recurring deduction (not part of a structure); stays on the Employee.
//
// Every write path (employee create/edit, Salary Structure screen) goes through this file.
import Employee from "../models/Employee.js";
import Salary from "../models/Salary.js";
import User from "../models/User.js";
import { MAX_MONTHLY_AMOUNT } from "../constants/limits.js";
import { pickCurrent, planSalaryChange, round2, toKey } from "./salaryLogic.js";

export { pickCurrent };

const istMidnight = (key) => new Date(`${key}T00:00:00+05:30`);

// Map<employeeId string, structure> of the structure in force today.
export async function getCurrentSalaryMap(employeeIds) {
  const rows = await Salary.find({ employee: { $in: employeeIds } }).sort({ effectiveFrom: 1 }).lean();
  const byEmployee = new Map();
  for (const row of rows) {
    const key = String(row.employee);
    if (!byEmployee.has(key)) byEmployee.set(key, []);
    byEmployee.get(key).push(row);
  }
  const current = new Map();
  for (const [key, list] of byEmployee) {
    const picked = pickCurrent(list);
    if (picked) current.set(key, picked);
  }
  return current;
}

// Overlays the structure in force onto Employee-shaped objects (basicSalary + allowance, where
// allowance = HRA + allowances). Employees without a structure keep their stored values.
export async function withCurrentSalary(employees) {
  const list = Array.isArray(employees) ? employees : [employees];
  const ids = list.filter(Boolean).map((e) => e._id);
  if (!ids.length) return employees;
  const map = await getCurrentSalaryMap(ids);
  for (const e of list) {
    const s = e && map.get(String(e._id));
    if (!s) continue;
    e.basicSalary = s.basic;
    e.allowance = round2(s.hra + s.allowances);
  }
  return employees;
}

// Copies the structure in force onto the Employee mirror fields.
export async function syncEmployeeMirror(employeeId) {
  const map = await getCurrentSalaryMap([employeeId]);
  const s = map.get(String(employeeId));
  if (!s) return null;
  await Employee.updateOne({ _id: employeeId }, { $set: { basicSalary: s.basic, allowance: round2(s.hra + s.allowances) } });
  return s;
}

const deactivateOthers = (employeeId, exceptId) =>
  Salary.updateMany({ employee: employeeId, isActive: true, _id: { $ne: exceptId } }, { $set: { isActive: false } });

// Used by Employee create/edit (form fields: Basic salary + Allowances).
//   effectiveFrom : join date on create; today (or join date if later) on edit.
// No-op when the pay did not change, so saving an unrelated field never creates a revision.
export async function setEmployeeSalary({ employeeId, basic, allowance, effectiveFrom, createdBy }) {
  const existing = await Salary.find({ employee: employeeId }).sort({ effectiveFrom: 1 });
  const plan = planSalaryChange({ structures: existing, basic, allowance, effectiveKey: toKey(effectiveFrom) });

  if (plan.action === "none") {
    if (plan.current) await syncEmployeeMirror(employeeId);
    return { changed: false, structure: plan.current };
  }
  let doc;
  if (plan.action === "update") { plan.target.set(plan.fields); doc = await plan.target.save(); }
  else doc = await Salary.create({ employee: employeeId, ...plan.fields, effectiveFrom: istMidnight(plan.effectiveKey), createdBy });
  await deactivateOthers(employeeId, doc._id);
  await syncEmployeeMirror(employeeId);
  return { changed: true, structure: doc };
}

export async function deleteEmployeeSalaries(employeeId) {
  await Salary.deleteMany({ employee: employeeId });
}

// Startup self-heal: employees saved before this fix have pay only on the Employee record (so the
// Salary Structure screen showed nothing). Creates the missing structure for them. Idempotent;
// skips values outside the allowed range instead of importing them.
export async function backfillSalaryStructures() {
  const admin = await User.findOne({ role: "ADMIN" }).select("_id").lean();
  if (!admin) return { created: 0, skipped: 0 };
  let created = 0, skipped = 0;
  const candidates = await Employee.find({ isDeleted: { $ne: true }, $or: [{ basicSalary: { $gt: 0 } }, { allowance: { $gt: 0 } }] }).lean();
  for (const e of candidates) {
    if (await Salary.exists({ employee: e._id })) continue;
    const basic = round2(e.basicSalary), allowance = round2(e.allowance);
    if (basic > MAX_MONTHLY_AMOUNT || allowance > MAX_MONTHLY_AMOUNT || basic + allowance > MAX_MONTHLY_AMOUNT) {
      console.warn(`Salary backfill skipped ${e.firstName} ${e.lastName} (${e._id}): stored pay is outside the allowed range. Correct it from Employees -> Edit.`);
      skipped++; continue;
    }
    await Salary.create({ employee: e._id, basic, hra: 0, allowances: allowance, fixedMonthlyGross: round2(basic + allowance), effectiveFrom: istMidnight(toKey(e.joinDate || e.createdAt)), isActive: true, createdBy: admin._id });
    created++;
  }
  return { created, skipped };
}
