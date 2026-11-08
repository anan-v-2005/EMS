import PayrollSettings from "../models/PayrollSettings.js";
import { mergeSettings, validateSettingsInput } from "./payrollSettingsLogic.js";

const TTL_MS = 30_000;
let cache = null;
let cachedAt = 0;

export async function getPayrollSettings({ force = false } = {}) {
  if (!force && cache && Date.now() - cachedAt < TTL_MS) return cache;
  const doc = await PayrollSettings.findOne({ key: "default" }).lean();
  cache = mergeSettings(doc?.data || {});
  cachedAt = Date.now();
  return cache;
}

export async function savePayrollSettings(body, userId) {
  const clean = validateSettingsInput(body);
  await PayrollSettings.findOneAndUpdate(
    { key: "default" },
    { $set: { data: clean, updatedBy: userId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  cache = mergeSettings(clean);
  cachedAt = Date.now();
  return cache;
}

export const getWeeklyOffDays = async () => (await getPayrollSettings()).weeklyOffDays;
