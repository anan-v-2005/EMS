
import React, { useCallback, useEffect, useState } from "react";
import {
  Clock3,
  Users,
  CalendarCheck2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import Loading from "../components/Loading";
import CheckInButton from "../components/Attendance/CheckInButton";
import AttendanceStats from "../components/Attendance/AttendanceStats";
import AttendanceHistory from "../components/Attendance/AttendanceHistory";
import api from "../api/axios.js";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const Attendance = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const [adminPeriod, setAdminPeriod] = useState("7d");
  const [employeePeriod, setEmployeePeriod] = useState("7d");

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);

      const res = await api.get("/attendance", {
        params: {
          period: isAdmin ? adminPeriod : employeePeriod,
          limit: 500,
          _refresh: Date.now(),
        },
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      setHistory(res.data.data || []);
      setIsDeleted(Boolean(res.data.employee?.isDeleted));
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to load attendance",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, adminPeriod, employeePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <Loading />;
  }

  const RefreshButton = () => (
    <button
      type="button"
      onClick={fetchData}
      disabled={refreshing}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {refreshing && <Loader2 className="h-4 w-4 animate-spin" />}
      {refreshing ? "Refreshing..." : "Refresh"}
    </button>
  );

  const PeriodSelector = ({ value, onChange, options }) => (
    <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-slate-600 sm:flex-row sm:items-center sm:gap-3">
      <span>View attendance</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-500 sm:w-auto"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  // ADMIN ATTENDANCE
  if (isAdmin) {
    const completed = history.filter((item) => item.checkOut);

    const hours = completed.reduce(
      (sum, item) => sum + (Number(item.workingHours) || 0),
      0,
    );

    const late = history.filter((item) => item.status === "LATE").length;

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 p-2 sm:space-y-6 sm:p-4"
      >
        {/* Page heading */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Operations
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Attendance Overview
          </h1>

          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Review recent employee check-ins, status, and working hours.
          </p>
        </div>

        {/* Filters and refresh */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <PeriodSelector
            value={adminPeriod}
            onChange={setAdminPeriod}
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
              { value: "1y", label: "Last 1 year" },
              {
                value: "all",
                label: "All recorded days (latest 500)",
              },
            ]}
          />

          <RefreshButton />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            [Users, history.length, "Recent records"],
            [CalendarCheck2, late, "Late arrivals"],
            [Clock3, `${hours.toFixed(1)}h`, "Tracked hours"],
          ].map(([Icon, value, label], index) => (
            <div
              key={label}
              className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${
                index === 2 ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-11 sm:w-11">
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    {label}
                  </p>

                  <p className="break-words text-xl font-bold text-slate-900 sm:text-2xl">
                    {value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Attendance table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold text-slate-800">
              Attendance records
            </h2>

            <span className="text-xs text-slate-500">
              {history.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Check In</th>
                  <th className="px-5 py-4">Check Out</th>
                  <th className="px-5 py-4">Hours</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-5 py-12 text-center text-slate-400"
                    >
                      No attendance records yet.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr
                      key={item.id || item._id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-medium text-slate-700">
                        {item.employee?.firstName}{" "}
                        {item.employee?.lastName}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {format(new Date(item.date), "dd MMM yyyy")}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {item.checkIn
                          ? format(new Date(item.checkIn), "hh:mm a")
                          : "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {item.checkOut
                          ? format(new Date(item.checkOut), "hh:mm a")
                          : "—"}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {item.workingHours != null
                          ? `${item.workingHours}h`
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.status === "ABSENT"
                              ? "bg-rose-50 text-rose-700"
                              : item.status === "LEAVE"
                                ? "bg-blue-50 text-blue-700"
                                : item.status === "LATE"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    );
  }

  // EMPLOYEE ATTENDANCE
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayRecords = history.find(
    (record) =>
      new Date(record.date).toDateString() === today.toDateString(),
  );

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 p-2 sm:space-y-6 sm:p-4">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Attendance
        </h1>

        <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
          Track your daily attendance and work activity.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <PeriodSelector
            value={employeePeriod}
            onChange={setEmployeePeriod}
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 1 month" },
              { value: "150d", label: "Last 5 months" },
              { value: "all", label: "All records" },
            ]}
          />

          <RefreshButton />
        </div>
      </div>

      {isDeleted ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-sm font-medium text-rose-600 sm:p-6">
          This account has been deactivated. Attendance actions are disabled.
        </div>
      ) : (
        <CheckInButton
          onAction={fetchData}
          todayRecords={todayRecords}
        />
      )}

      <AttendanceStats history={history} />

      <AttendanceHistory history={history} />
    </div>
  );
};

export default Attendance;
