import "dotenv/config";
import connectDB from "./config/db.js";
import Attendance from "./models/Attendance.js";
import Employee from "./models/Employee.js";
import { initializeLeaveBalances } from "./services/leaveBalanceJobs.js";

const dateKey = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
await connectDB();
const legacyRows = await Attendance.find({ $or: [{ dateKey: { $exists: false } }, { dateKey: null }, { dateKey: "" }] }).select("_id employeeId date").lean();
let migrated = 0; let conflicts = 0;
for (const row of legacyRows) {
  const key = dateKey(row.date);
  const duplicate = await Attendance.exists({ _id: { $ne: row._id }, employeeId: row.employeeId, dateKey: key });
  if (duplicate) { console.warn(`Skipped attendance ${row._id}: duplicate employee/dateKey ${key}`); conflicts++; continue; }
  await Attendance.updateOne({ _id: row._id, $or: [{ dateKey: { $exists: false } }, { dateKey: null }, { dateKey: "" }] }, { $set: { dateKey: key } });
  migrated++;
}
const balances = await initializeLeaveBalances();
console.log(JSON.stringify({ attendanceDateKeysMigrated: migrated, attendanceDateKeyConflicts: conflicts, leaveBalancesCreated: balances.initialized }, null, 2));
process.exit(0);
