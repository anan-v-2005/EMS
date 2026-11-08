
import {
  AlertCircleIcon,
  CalendarIcon,
  ClockIcon,
} from "lucide-react";
import React from "react";

const AttendanceStats = ({ history }) => {
  const totalPresent = history.filter(
    (h) => h.status === "PRESENT" || h.status === "LATE",
  ).length;

  const totalLate = history.filter((h) => h.status === "LATE").length;

  const completed = history.filter((h) =>
    Number.isFinite(h.workingHours),
  );

  const avgHours = completed.length
    ? (
        completed.reduce((sum, h) => sum + h.workingHours, 0) /
        completed.length
      ).toFixed(2)
    : "0.00";

  const stats = [
    {
      label: "Present Days",
      value: totalPresent,
      icon: CalendarIcon,
      desc: "Total attendance marked",
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Late Arrivals",
      value: totalLate,
      icon: AlertCircleIcon,
      desc: "Arrived after time",
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Avg Work Hours",
      value: `${avgHours} Hrs`,
      icon: ClockIcon,
      desc: "Daily working average",
      color: "text-blue-600 bg-blue-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {stats.map((item, index) => {
        const Icon = item.icon;

        return (
          <div
            key={item.label}
            className={`group rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 sm:p-5 sm:hover:-translate-y-1 sm:hover:shadow-lg ${
              index === 2 ? "col-span-2 lg:col-span-1" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 sm:h-12 sm:w-12 sm:group-hover:scale-105 ${item.color}`}
                >
                  <Icon className="size-5" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    {item.label}
                  </p>

                  <p className="mt-1 break-words text-xl font-semibold text-slate-800 sm:text-2xl">
                    {item.value}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {item.desc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AttendanceStats;
