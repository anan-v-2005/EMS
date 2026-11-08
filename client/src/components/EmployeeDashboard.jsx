
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Clock3,
  FileText,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api/axios";

const Card = ({ children, className = "" }) => (
  <div
    className={`rounded-2xl border border-[#E2E7E1] bg-white shadow-sm ${className}`}
  >
    {children}
  </div>
);

export default function EmployeeDashboard({ data }) {
  const [leaveBalance, setLeaveBalance] = useState(null);

  useEffect(() => {
    let active = true;

    api
      .get("/enterprise/leave-balances")
      .then(({ data: response }) => {
        if (active) setLeaveBalance(response?.data?.[0] || null);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const e = data?.employee;
  const today = data?.today;
  const s = data?.summary || {};

  const todayLabel = today
    ? today.checkOut
      ? "Checked out"
      : "Checked in"
    : "Not checked in";

  return (
    <div className="min-w-0 space-y-4 animate-fade-in sm:space-y-6">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-5 sm:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#5E8064]/15 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
            Personal workspace
          </p>

          <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {e?.firstName || "there"}
          </h1>

          <p className="mt-2 text-sm text-[#637066]">
            {e?.position || "Employee"} · {e?.department || "No department"}
          </p>
        </div>
      </section>

      {/* Statistics */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Today's status"
          value={todayLabel}
          hint={
            today?.workingHours != null
              ? `${today.workingHours}h worked`
              : "Start your workday with Check In"
          }
          icon={CalendarCheck}
        />

        <Stat
          label="Attendance"
          value={`${s.presentDays ?? 0} days`}
          hint={`${s.lateDays ?? 0} late this month`}
          icon={Clock3}
        />

        <Stat
          label="Average hours"
          value={`${s.avgHours ?? 0}h`}
          hint="Completed working days"
          icon={Clock3}
        />

        <Stat
          label="Pending leave"
          value={e?.pendingLeaves ?? 0}
          hint="Requests awaiting review"
          icon={FileText}
        />
      </div>

      {/* Leave balance */}
      {leaveBalance && (
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8A968C]">
                Leave allowance
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Your annual balance
              </h2>
            </div>

            <p className="text-sm font-semibold text-[#4A6F52]">
              {["sick", "casual", "emergency", "annual"].reduce(
                (sum, key) =>
                  sum + Number(leaveBalance.balances?.[key]?.remaining || 0),
                0,
              )}{" "}
              of 20 days remaining
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { key: "sick", label: "Sick leave" },
              { key: "casual", label: "Casual leave" },
              { key: "emergency", label: "Emergency leave" },
              { key: "annual", label: "Annual leave" },
            ].map((item) => {
              const bucket = leaveBalance.balances?.[item.key] || {};

              const pct =
                Number(bucket.total || 0) > 0
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        (Number(bucket.remaining || 0) /
                          Number(bucket.total)) *
                          100,
                      ),
                    )
                  : 0;

              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-[#E5EAE3] bg-[#FAFBF9] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#394939]">
                      {item.label}
                    </p>

                    <p className="text-sm font-bold text-[#4A7C59]">
                      {bucket.remaining ?? 0}
                    </p>
                  </div>

                  <p className="mt-1 text-xs text-[#839083]">
                    of {bucket.total ?? 0} days available
                  </p>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E6ECE5]">
                    <div
                      className="h-full rounded-full bg-[#6B9B6E] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Link
            to="/people-operations"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#4A6F52]"
          >
            View leave details <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      )}

      {/* Attendance and AI assistant */}
      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8A968C]">
                Today
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Attendance status
              </h2>
            </div>

            <span className="shrink-0 rounded-full bg-[#EDF4EE] px-3 py-1 text-xs font-semibold text-[#4A6F52]">
              {today?.status || "NOT MARKED"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3">
            <Mini
              label="Check in"
              value={
                today?.checkIn
                  ? new Date(today.checkIn).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"
              }
            />

            <Mini
              label="Check out"
              value={
                today?.checkOut
                  ? new Date(today.checkOut).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"
              }
            />

            <Mini
              label="Hours"
              value={
                today?.workingHours != null
                  ? `${today.workingHours}h`
                  : "—"
              }
            />

            <Mini label="Day type" value={today?.dayType || "—"} />
          </div>

          <Link
            to="/attendance"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#4A6F52]"
          >
            Open attendance <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF4EE] text-[#4A6F52]">
              <Sparkles className="h-5 w-5" />
            </span>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8A968C]">
                Smart assistant
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Ask about your work data
              </h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-[#637066]">
            Ask the EMS AI assistant about attendance, leave, working hours or
            your latest payslip. It only receives data you are authorized to
            see.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              "How was my attendance this month?",
              "Did my attendance improve?",
            ].map((q) => (
              <button
                key={q}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("ems-ai-prompt", { detail: q }),
                  )
                }
                className="rounded-xl border border-[#E2E7E1] bg-[#FAFBF9] px-3 py-3 text-left text-xs font-medium hover:border-[#9DB6A2] hover:bg-[#EDF4EE]"
              >
                {q}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8A968C]">
              Quick actions
            </p>

            <h2 className="mt-1 text-lg font-semibold">
              Everything you need
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          <Link to="/attendance" className="action min-w-0 text-xs sm:text-sm">
            <CalendarCheck className="h-4 w-4 shrink-0" />
            <span>Attendance</span>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
          </Link>

          <Link to="/leave" className="action min-w-0 text-xs sm:text-sm">
            <FileText className="h-4 w-4 shrink-0" />
            <span>Apply leave</span>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
          </Link>

          <Link to="/payslips" className="action min-w-0 text-xs sm:text-sm">
            <FileText className="h-4 w-4 shrink-0" />
            <span>Latest payslip</span>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
          </Link>

          <Link to="/analytics" className="action min-w-0 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span>My analytics</span>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#E2E7E1] bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8A968C]">
            {label}
          </p>

          <p className="mt-2 break-words text-xl font-semibold sm:text-2xl">
            {value}
          </p>

          <p className="mt-1 text-xs text-[#637066]">{hint}</p>
        </div>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF4EE] text-[#4A6F52] sm:h-10 sm:w-10">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#F7F8F5] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#8A968C]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
