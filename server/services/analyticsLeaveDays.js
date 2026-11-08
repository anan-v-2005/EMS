// Counts only the leave workdays that overlap a selected IST date range.
// The caller supplies the company's weekly-off weekdays and holiday keys so
// this helper stays deterministic and easy to test.
export function istDateKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function leaveWorkdayEntries(leave, from, to, weeklyOffs = [], holidayKeys = new Set()) {
  if (!leave?.startDate || !leave?.endDate || !(from instanceof Date) || !(to instanceof Date) || to <= from) return [];
  const first = [istDateKey(leave.startDate), istDateKey(from)].sort().at(-1);
  const last = [istDateKey(leave.endDate), istDateKey(new Date(to.getTime() - 1))].sort()[0];
  if (first > last) return [];

  const cursor = new Date(`${first}T00:00:00Z`);
  const endDate = new Date(`${last}T00:00:00Z`);
  const entries = [];
  for (; cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    if (!weeklyOffs.includes(cursor.getUTCDay()) && !holidayKeys.has(date)) entries.push({ date, days: 1 });
  }

  if (leave.halfDay && istDateKey(leave.startDate) === istDateKey(leave.endDate) && entries.length) entries[0].days = 0.5;
  return entries;
}
