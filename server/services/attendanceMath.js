import { attendancePolicy } from "../config/attendancePolicy.js";
export function classifyWorkHours(hours) {
  if (hours >= attendancePolicy.FULL_DAY_MIN_HOURS) return "Full Day";
  if (hours >= attendancePolicy.HALF_DAY_MIN_HOURS) return "Half Day";
  return "Short Day";
}
export function calculateAttendance(checkIn, checkOut, { automatic = false, existingStatus = "PRESENT" } = {}) {
  const start = new Date(checkIn).getTime(); const end = new Date(checkOut).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("Invalid attendance timestamps");
  const workingHours = Number(((end - start) / 3600000).toFixed(2));
  return { checkOut: new Date(checkOut), workingHours, dayType: classifyWorkHours(workingHours), status: workingHours < 4 ? "ABSENT" : existingStatus === "LATE" ? "LATE" : "PRESENT", ...(automatic ? { autoCheckedOut: true, needsReview: true } : {}) };
}

// Attendance credit is used by analytics so half/partial days are not counted as full days.
export function attendanceCreditForRecord(record = {}) {
  if (record.status === "ABSENT") return 0;
  if (record.dayType === "Three Quarter Day") return 0.75;
  if (record.dayType === "Half Day") return 0.5;
  if (record.dayType === "Short Day") return 0;
  return 1;
}
