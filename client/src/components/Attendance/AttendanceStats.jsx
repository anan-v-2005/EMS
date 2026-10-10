import { AlertCircleIcon, CalendarIcon, ClockIcon } from "lucide-react";
import React from "react";

const AttendanceStats = ({ history }) => {
  const totalPresent = history.filter(
    (h) => h.status === "PRESENT" || h.status === "LATE"
  ).length;

  const totalLate = history.filter((h) => h.status === "LATE").length;

  const completed = history.filter((h) => Number.isFinite(h.workingHours));
  const avgHours = completed.length
    ? (completed.reduce((sum, h) => sum + h.workingHours, 0) / completed.length).toFixed(2)
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

      {stats.map((i) => {
        const Icon = i.icon;

        return (
          <div
            key={i.label}
            className="group bg-white border rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer"
          >
            
            <div className="flex items-start justify-between">

              {/* LEFT SIDE */}
              <div className="flex items-center gap-4">

                {/* ICON */}
                <div
                  className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105 ${i.color}`}
                >
                  <Icon className="size-5" />
                </div>

                {/* TEXT */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    {i.label}
                  </p>

                  <p className="text-2xl font-semibold text-slate-800 mt-1">
                    {i.value}
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    {i.desc}
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