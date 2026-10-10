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
