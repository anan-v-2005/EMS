import Employee from "../models/Employee.js";
import LeaveBalance from "../models/LeaveBalance.js";
import { buildBalances, computeCarryForward } from "./leaveAllocation.js";

const currentIstYear = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(new Date()));

export async function initializeLeaveBalances(year = currentIstYear()) {
  const employees = await Employee.find({ isDeleted: { $ne: true } }).select("_id joinDate").lean();
  if (!employees.length) return { initialized: 0 };
  const operations = employees.map(({ _id: employee, joinDate }) => ({
    updateOne: { filter: { employee, year }, update: { $setOnInsert: { employee, year, balances: buildBalances({ joinDate, year }) } }, upsert: true },
  }));
  const result = await LeaveBalance.bulkWrite(operations, { ordered: false });
  return { initialized: result.upsertedCount || 0 };
}

// Runs on 1 January: new-year balances, plus capped carry-forward of unused days (see config/leavePolicy.js).
export async function resetLeaveBalancesForYear(year) {
  const employees = await Employee.find({ isDeleted: { $ne: true } }).select("_id joinDate").lean();
  const previous = await LeaveBalance.find({ employee: { $in: employees.map((e) => e._id) }, year: year - 1 }).select("employee balances").lean();
  const previousByEmployee = new Map(previous.map((row) => [String(row.employee), row.balances]));

  const operations = employees.map(({ _id: employee, joinDate }) => ({
    updateOne: {
      filter: { employee, year },
      update: { $set: { balances: buildBalances({ joinDate, year, carried: computeCarryForward(previousByEmployee.get(String(employee))) }) } },
      upsert: true,
    },
  }));
  if (operations.length) await LeaveBalance.bulkWrite(operations, { ordered: false });
  return { reset: operations.length, year };
}
