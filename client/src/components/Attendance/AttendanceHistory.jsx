
import React from "react";
import {
  getDayTypeDisplay,
  getWorkingHoursDisplay,
} from "../../assets/assets";
import { format } from "date-fns";

const AttendanceHistory = ({ history }) => {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm sm:mt-8">
      {/* HEADER */}
      <div className="flex flex-col gap-1 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <h3 className="text-sm font-semibold text-slate-800">
          Recent Activity
        </h3>

        <p className="text-xs text-slate-500">
          Live attendance records
        </p>
      </div>

      {/* TABLE WRAPPER */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          {/* TABLE HEADER */}
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
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
                  className="py-10 text-center text-slate-500"
                >
                  No records found
                </td>
              </tr>
            ) : (
              history.map((item) => {
                const dayType = getDayTypeDisplay(item);

                return (
                  <tr
                    key={
                      item.dateKey ||
                      item._id ||
                      item.id ||
                      item.date
                    }
                    className="group animate-fade-in transition-all duration-200 hover:bg-slate-50"
                  >
                    {/* DATE */}
                    <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                      {item.date
                        ? format(new Date(item.date), "MMM dd, yyyy")
                        : "-"}
                    </td>

                    {/* CHECK IN */}
                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                      {item.checkIn
                        ? format(new Date(item.checkIn), "hh:mm a")
                        : "-"}
                    </td>

                    {/* CHECK OUT */}
                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                      {item.checkOut
                        ? format(new Date(item.checkOut), "hh:mm a")
                        : "-"}
                    </td>

                    {/* HOURS */}
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-700">
                      {getWorkingHoursDisplay(item)}
                    </td>

                    {/* TYPE */}
                    <td className="whitespace-nowrap px-6 py-4">
                      {dayType.label !== "-" ? (
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${dayType.className}`}
                        >
                          {dayType.label}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.status === "PRESENT"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "LATE"
                              ? "bg-amber-100 text-amber-700"
                              : item.status === "LEAVE"
                                ? "bg-blue-100 text-blue-700"
                                : item.status === "ABSENT"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.status || "—"}
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
