export const getIndiaDayRange = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const day = formatter.format(date);
  const start = new Date(`${day}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
};

export const getIndiaMonthRange = (date = new Date()) => {
  return getIndiaMonthRangeForOffset(0, date);
};

export const getIndiaMonthRangeForOffset = (offset = 0, date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  const currentYear = Number(parts.find((p) => p.type === "year")?.value);
  const currentMonth = Number(parts.find((p) => p.type === "month")?.value);
  const first = new Date(Date.UTC(currentYear, currentMonth - 1 + offset, 1));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth() + 1;
  const next = new Date(Date.UTC(year, month, 1));

  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`);
  const endYear = next.getUTCFullYear();
  const endMonth = next.getUTCMonth() + 1;
  const end = new Date(`${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00+05:30`);

  return { start, end };
};

// "30 Oct 2026, 6:30 pm IST" - used in email content.
export const istStamp = (date = new Date()) =>
  `${new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} IST`;

// "30 Oct 2026"
export const istDateLabel = (date) =>
  date ? new Date(date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "";

// Returns the weekday index (0=Sunday ... 6=Saturday) for the calendar date in IST.
// Do not use getUTCDay() directly on an IST-midnight Date: that instant is 18:30 UTC
// on the previous calendar day and would shift the weekday backwards.
export const getIndiaWeekday = (date = new Date()) => {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${key}T00:00:00Z`).getUTCDay();
};
