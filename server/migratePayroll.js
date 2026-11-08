// One-time, idempotent migration: copies legacy PayrollSnapshot documents into the unified Payslip collection.
//   npm run migrate:payroll
// Safe to run repeatedly - snapshots already migrated (legacySnapshotId) or conflicting with an existing payslip
// for the same employee/month are skipped and reported. Original snapshots are never modified or deleted.
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import PayrollSnapshot from "./models/PayrollSnapshot.js";
import Payslip from "./models/Payslip.js";

await connectDB();
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
let migrated = 0, skipped = 0;
for await (const snap of PayrollSnapshot.find({}).lean()) {
  const already = await Payslip.exists({ $or: [{ legacySnapshotId: snap._id }, { employeeId: snap.employee, month: snap.month, year: snap.year }] });
  if (already) { skipped++; console.log(`skip ${snap._id}: payslip already exists for ${snap.month}/${snap.year}`); continue; }
  const d = snap.deductions || {}, s = snap.salary || {};
  const deductionTotal = round2((d.lop || 0) + (d.pf || 0) + (d.professionalTax || 0) + (d.tds || 0) + (d.other || 0));
  const earningsTotal = round2((s.gross || 0) + (snap.overtimePay || 0) + (snap.bonus || 0));
  await Payslip.create({
    employeeId: snap.employee, month: snap.month, year: snap.year,
    basicSalary: s.basic || 0, allowances: round2(earningsTotal - (s.basic || 0)), deductions: deductionTotal, netSalary: snap.netPay,
    status: snap.status === "finalized" ? "finalized" : "draft", mode: "AUTO",
    payslipNumber: snap.status === "finalized" ? `PS-${snap.year}${String(snap.month).padStart(2, "0")}-${String(snap.employee).slice(-6).toUpperCase()}` : undefined,
    salary: { basic: s.basic || 0, hra: s.hra || 0, allowances: s.allowances || 0, gross: s.gross || 0, source: "STRUCTURE" },
    attendance: { ...(snap.attendance || {}), calendarDays: new Date(snap.year, snap.month, 0).getDate() },
    breakdown: {
      earnings: { basic: s.basic || 0, hra: s.hra || 0, allowances: s.allowances || 0, overtime: snap.overtimePay || 0, bonus: snap.bonus || 0, otherEarnings: [], total: earningsTotal },
      deductions: { lop: d.lop || 0, pf: d.pf || 0, esi: 0, professionalTax: d.professionalTax || 0, tds: d.tds || 0, otherDeductions: d.other ? [{ label: "Other deductions", amount: d.other }] : [], total: deductionTotal },
      employer: { pf: 0, esi: 0 },
    },
    warnings: ["Migrated from a legacy payroll snapshot."],
    generatedAt: snap.generatedAt, generatedBy: snap.generatedBy, finalizedAt: snap.finalizedAt, legacySnapshotId: snap._id,
    history: [{ action: "MIGRATED", by: snap.generatedBy, at: new Date(), note: "From PayrollSnapshot" }],
  });
  migrated++;
}
console.log(`Payroll migration complete. Migrated: ${migrated}, skipped: ${skipped}.`);
await mongoose.disconnect();
