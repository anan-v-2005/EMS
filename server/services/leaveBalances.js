import LeaveBalance from "../models/LeaveBalance.js";
import Employee from "../models/Employee.js";
import { buildBalances } from "./leaveAllocation.js";
import { getOffHolidayKeys, getWeeklyOffDays } from "./workPolicy.js";

const typeMap = { SICK: "sick", CASUAL: "casual", EMERGENCY: "emergency", ANNUAL: "annual" };
export function normalizeISTDate(value) { const d = new Date(value); if (!Number.isFinite(d.getTime())) throw new Error("Invalid leave date"); return new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) + "T00:00:00+05:30"); }
export async function countLeaveDays(startValue, endValue, halfDay = false) {
 const start=normalizeISTDate(startValue), end=normalizeISTDate(endValue); if(end<start)throw new Error("Leave end date must not be before start date");
 const [weeklyOffs, holidayKeys] = await Promise.all([getWeeklyOffDays(), getOffHolidayKeys(start, new Date(end.getTime()+86400000))]);
 const keyOf=(d)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
 let days=0;
 for(let cursor=start.getTime();cursor<=end.getTime();cursor+=86400000){
  const d=new Date(cursor); const key=keyOf(d);
  const weekday=new Date(`${key}T00:00:00Z`).getUTCDay();
  if(!weeklyOffs.includes(weekday)&&!holidayKeys.has(key))days++;
 }
 return {start,end,days:halfDay&&start.getTime()===end.getTime()?0.5:days};
}
export function currentISTYear(value = new Date()) { return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(value)); }
export async function ensureLeaveBalance(employee, year = currentISTYear()) {
 const existing = await LeaveBalance.findOne({ employee, year });
 if (existing) return existing;
 const emp = await Employee.findById(employee).select("joinDate").lean();
 if (!emp) throw new Error("Employee not found while initializing leave balance");
 return LeaveBalance.findOneAndUpdate({employee,year},{$setOnInsert:{employee,year,balances:buildBalances({joinDate:emp?.joinDate,year})}},{upsert:true,returnDocument:"after",setDefaultsOnInsert:true});
}
export async function reserveLeaveBalance(employee, year, type, days) {
 const key=typeMap[type]; if(!key)throw new Error("Unsupported leave type");
 for (let attempt = 0; attempt < 5; attempt++) {
  const balance=await ensureLeaveBalance(employee,year); const bucket=balance.balances[key];
  const paidDays=Math.min(days,Math.max(0,bucket.total-bucket.used-bucket.pending));
  const lopDays=Math.max(0,Number((days-paidDays).toFixed(2)));
  if (paidDays <= 0) return { paidDays: 0, lopDays };
  const result = await LeaveBalance.findOneAndUpdate(
   { employee, year, $expr: { $lte: [{ $add: [`$balances.${key}.used`, `$balances.${key}.pending`, paidDays] }, `$balances.${key}.total`] } },
   { $inc: { [`balances.${key}.pending`]: paidDays, [`balances.${key}.remaining`]: -paidDays } },
   { returnDocument: "after" },
  );
  if (result) return { paidDays, lopDays };
 }
 throw new Error("Leave balance changed while submitting. Please retry the request.");
}

export async function releaseLeaveBalance(employee, year, type, paidDays, action) {
 const key=typeMap[type]; if(!key)return;
 const days=Number(paidDays||0); if(days<=0)return;
 await ensureLeaveBalance(employee,year);
 let filter = { employee, year };
 let update;
 if(action === "APPROVE") {
  filter[`balances.${key}.pending`] = { $gte: days };
  update = { $inc: { [`balances.${key}.pending`]: -days, [`balances.${key}.used`]: days } };
 } else {
  filter[`balances.${key}.pending`] = { $gte: days };
  update = { $inc: { [`balances.${key}.pending`]: -days, [`balances.${key}.remaining`]: days } };
 }
 const result = await LeaveBalance.updateOne(filter, update);
 if (!result.modifiedCount) throw new Error("Leave balance could not be updated safely; please retry or inspect the balance record.");
}

export async function reverseApprovedLeaveBalance(employee, year, type, paidDays) {
 const key=typeMap[type]; const days=Number(paidDays||0); if(!key||days<=0)return;
 const result = await LeaveBalance.updateOne({ employee, year, [`balances.${key}.used`]: { $gte: days } }, { $inc: { [`balances.${key}.used`]: -days, [`balances.${key}.remaining`]: days } });
 if (!result.modifiedCount) throw new Error("Approved leave balance could not be reversed safely.");
}
