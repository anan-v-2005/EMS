import React, { useCallback, useEffect, useState } from "react";
import { Clock3, Users, CalendarCheck2 } from "lucide-react";
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
  const [isDeleted, setIsDeleted] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/attendance");
      setHistory(res.data.data || []);
      setIsDeleted(Boolean(res.data.employee?.isDeleted));
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Loading />;

  if (isAdmin) {
    const completed = history.filter((item) => item.checkOut);
    const hours = completed.reduce((sum, item) => sum + (Number(item.workingHours) || 0), 0);
    const late = history.filter((item) => item.status === "LATE").length;

    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-2 sm:p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Attendance Overview</h1>
          <p className="mt-1 text-sm text-slate-500">Review recent employee check-ins, status, and working hours.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            [Users, history.length, "Recent records"],
            [CalendarCheck2, late, "Late arrivals"],
            [Clock3, `${hours.toFixed(1)}h`, "Tracked hours"],
          ].map(([Icon, value, label]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">{React.createElement(Icon, { className: "h-5 w-5" })}</div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                  <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-400">No attendance records yet.</td></tr>
                ) : history.map((item) => (
                  <tr key={item.id || item._id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-700">{item.employee?.firstName} {item.employee?.lastName}</td>
                    <td className="px-5 py-4 text-slate-500">{format(new Date(item.date), "dd MMM yyyy")}</td>
                    <td className="px-5 py-4 text-slate-500">{item.checkIn ? format(new Date(item.checkIn), "hh:mm a") : "—"}</td>
                    <td className="px-5 py-4 text-slate-500">{item.checkOut ? format(new Date(item.checkOut), "hh:mm a") : "—"}</td>
                    <td className="px-5 py-4 font-medium text-slate-700">{item.workingHours != null ? `${item.workingHours}h` : "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.status === "LATE" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                      }`}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRecords = history.find((record) => new Date(record.date).toDateString() === today.toDateString());

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-2 sm:p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Attendance</h1>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">Track your daily attendance and work activity.</p>
      </div>

      {isDeleted ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-medium text-rose-600">
          This account has been deactivated. Attendance actions are disabled.
        </div>
      ) : (
        <CheckInButton onAction={fetchData} todayRecords={todayRecords} />
      )}

      <AttendanceStats history={history} />
      <AttendanceHistory history={history} />
    </div>
  );
};

export default Attendance;
