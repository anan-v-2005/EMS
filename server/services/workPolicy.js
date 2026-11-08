// One source of truth for "is this a working day?" used by attendance, leave and payroll.
import Holiday from "../models/Holiday.js";
import { getWeeklyOffDays } from "./payrollSettings.js";

// Local helper (kept here, not imported from attendanceSummary, to avoid a circular import).
const istKey = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export { getWeeklyOffDays };

// Company-wide days off in [from, to). OPTIONAL holidays are employee-choice days, so they are
// deliberately NOT treated as a day off for everyone.
export async function getOffHolidayKeys(from, to) {
  const rows = await Holiday.find({
    date: { $gte: from, $lt: to },
    type: { $ne: "OPTIONAL" },
  })
    .select("date")
    .lean();
  return new Set(rows.map((h) => istKey(h.date)));
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const SHORT_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// ---- Working-day helpers (used by scheduled jobs so they never fire on days off) ----
export const istDayKey = (date = new Date()) => istKey(date);

export const istDayRange = (dayKey) => {
  const start = new Date(`${dayKey}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

// true when `dayKey` (YYYY-MM-DD, IST) is neither a weekly off nor a company-wide holiday.
export async function isWorkingDay(dayKey = istDayKey()) {
  const { start, end } = istDayRange(dayKey);
  const [weeklyOffs, holidayKeys] = await Promise.all([
    getWeeklyOffDays(),
    getOffHolidayKeys(start, end),
  ]);
  const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return !weeklyOffs.includes(weekday) && !holidayKeys.has(dayKey);
}
