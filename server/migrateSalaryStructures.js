// One-time, idempotent migration: copies the legacy salary stored on each Employee
// (basicSalary + allowance) into a proper Salary structure, so the Salary collection becomes the
// single source of truth for pay.
//
//   npm run migrate:salary            # dry run: only prints what would change
//   npm run migrate:salary -- --apply # actually writes
//
// - Employees that already have a Salary structure are skipped.
// - Employee.basicSalary / allowance / deductions are NOT modified or deleted.
// - Employee.deductions is still used as a "recurring deduction" by payslip generation, so keep it
//   until you have moved those amounts somewhere else.
import "dotenv/config";
import connectDB from "./config/db.js";
import Employee from "./models/Employee.js";
import Salary from "./models/Salary.js";
import User from "./models/User.js";

const apply = process.argv.includes("--apply");
await connectDB();

const admin = await User.findOne({ role: "ADMIN" }).select("_id").lean();
if (!admin) { console.error("No admin user found; cannot set Salary.createdBy."); process.exit(1); }

let created = 0, skipped = 0, empty = 0;
for await (const employee of Employee.find({ isDeleted: { $ne: true } }).lean()) {
  const basic = Number(employee.basicSalary || 0);
  const allowances = Number(employee.allowance || 0);
  if (basic + allowances <= 0) { empty++; continue; }
  if (await Salary.exists({ employee: employee._id })) { skipped++; continue; }

  console.log(`${apply ? "create" : "would create"}: ${employee.firstName} ${employee.lastName} basic=${basic} allowances=${allowances} effectiveFrom=${new Date(employee.joinDate).toISOString().slice(0, 10)}`);
  if (apply) {
    await Salary.create({
      employee: employee._id, basic, hra: 0, allowances,
      fixedMonthlyGross: basic + allowances,
      effectiveFrom: employee.joinDate, isActive: true, createdBy: admin._id,
    });
  }
  created++;
}

console.log(`\n${apply ? "Created" : "Would create"} ${created} structure(s); skipped ${skipped} (already have one); ${empty} had no legacy salary.`);
if (!apply && created) console.log("Run again with --apply to write these changes.");
process.exit(0);
