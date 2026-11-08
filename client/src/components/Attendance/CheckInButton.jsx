
import React, { useState } from "react";
import {
  LogOutIcon,
  Loader2Icon,
  LogInIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";

const CheckInButton = ({ todayRecords, onAction }) => {
  const [loading, setLoading] = useState(false);

  const handleAttendance = async () => {
    if (loading) return;

    setLoading(true);

    try {
      await api.post("/attendance");

      if (typeof onAction === "function") {
        await onAction();
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Attendance action failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const floatingPosition =
    "fixed bottom-4 right-3 z-50 sm:bottom-5 sm:right-5";

  // Work day completed
  if (todayRecords?.checkOut) {
    return (
      <div className={floatingPosition}>
        <div className="max-w-[calc(100vw-1.5rem)] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <h3 className="text-sm font-semibold text-emerald-700">
            Work Day Completed
          </h3>

          <p className="mt-1 text-xs text-emerald-600">
            You have successfully completed today’s shift
          </p>
        </div>
      </div>
    );
  }

  // Approved leave
  if (todayRecords?.status === "LEAVE") {
    return (
      <div className={floatingPosition}>
        <div className="max-w-[calc(100vw-1.5rem)] rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <h3 className="text-sm font-semibold text-blue-700">
            Leave Day
          </h3>

          <p className="mt-1 text-xs text-blue-600">
            You have approved leave today.
          </p>
        </div>
      </div>
    );
  }

  // Attendance already marked absent
  if (todayRecords?.status === "ABSENT") {
    return (
      <div className={floatingPosition}>
        <div className="max-w-[calc(100vw-1.5rem)] rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
          <h3 className="text-sm font-semibold text-rose-700">
            Marked Absent
          </h3>

          <p className="mt-1 text-xs text-rose-600">
            Your attendance has already been marked absent today.
          </p>
        </div>
      </div>
    );
  }

  // Normal check-in / check-out
  const isCheckedIn = !!todayRecords?.checkIn;

  return (
    <div className={floatingPosition}>
      <button
        type="button"
        onClick={handleAttendance}
        disabled={loading}
        className={`
          flex w-[min(220px,calc(100vw-1.5rem))] items-center gap-3
          rounded-2xl px-4 py-3 text-white shadow-lg
          transition-all duration-200 active:scale-[0.97]
          disabled:cursor-not-allowed disabled:opacity-60
          sm:w-auto sm:min-w-[220px] sm:gap-4 sm:px-5 sm:py-4
          ${
            isCheckedIn
              ? "bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800"
              : "bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-600"
          }
        `}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          {loading ? (
            <Loader2Icon className="size-5 animate-spin" />
          ) : isCheckedIn ? (
            <LogOutIcon className="size-5" />
          ) : (
            <LogInIcon className="size-5" />
          )}
        </div>

        <div className="flex min-w-0 flex-col text-left">
          <h2 className="text-sm font-semibold">
            {loading
              ? "Processing..."
              : isCheckedIn
                ? "Clock Out"
                : "Clock In"}
          </h2>

          <p className="text-xs opacity-80">
            {isCheckedIn ? "End your shift" : "Start your work day"}
          </p>
        </div>
      </button>
    </div>
  );
};

export default CheckInButton;
