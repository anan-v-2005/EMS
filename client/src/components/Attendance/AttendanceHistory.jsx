import React from "react";
import {
  getDayTypeDisplay,
  getWorkingHoursDisplay,
} from "../../assets/assets";
import { format } from "date-fns";

const AttendanceHistory = ({ history }) => {
  return (
    <div className="mt-8 bg-white border rounded-2xl shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-5 border-b">
        <h3 className="text-sm font-semibold text-slate-800">
          Recent Activity
        </h3>

        <p className="text-xs text-slate-500">
          Live attendance records
        </p>
      </div>

      {/* TABLE WRAPPER */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* TABLE HEADER */}
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left">Date</th>
              <th className="px-6 py-3 text-left">Check In</th>
              <th className="px-6 py-3 text-left">Check Out</th>
              <th className="px-6 py-3 text-left">Hours</th>
              <th className="px-6 py-3 text-left">Type</th>
              <th className="px-6 py-3 text-left">Status</th>
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="divide-y divide-slate-100">
            {history.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="text-center py-10 text-slate-500"
                >
                  No records found
                </td>
              </tr>
            ) : (
              history.map((i) => {
                const dayType = getDayTypeDisplay(i);

                return (
                  <tr
                    key={i._id || i.id}
                    className="hover:bg-slate-50 transition-all duration-200 group animate-fade-in"
                  >
                    {/* DATE */}
                    <td className="px-6 py-4 text-slate-700">
                      {i.date
                        ? format(
                            new Date(i.date),
                            "MMM dd, yyyy"
                          )
                        : "-"}
                    </td>

                    {/* CHECK IN */}
                    <td className="px-6 py-4 text-slate-600">
                      {i.checkIn
                        ? format(
                            new Date(i.checkIn),
                            "hh:mm a"
                          )
                        : "-"}
                    </td>

                    {/* CHECK OUT */}
                    <td className="px-6 py-4 text-slate-600">
                      {i.checkOut
                        ? format(
                            new Date(i.checkOut),
                            "hh:mm a"
                          )
                        : "-"}
                    </td>

                    {/* HOURS */}
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {getWorkingHoursDisplay(i)}
                    </td>

                    {/* TYPE */}
                    <td className="px-6 py-4">
                      {dayType.label !== "-" ? (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 group-hover:scale-105 ${dayType.className}`}
                        >
                          {dayType.label}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 group-hover:scale-105 ${
                          i.status === "PRESENT"
                            ? "bg-emerald-100 text-emerald-700"
                            : i.status === "LATE"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceHistory;