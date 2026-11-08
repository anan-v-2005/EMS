
import React from "react";
import { AlertTriangle } from "lucide-react";
import {
  amountInWords,
  deductionRows,
  earningRows,
  money,
} from "../../utils/format";

const Stat = ({ label, value }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
    <p className="text-[11px] text-slate-400">{label}</p>
    <p className="break-words text-sm font-semibold text-slate-700">
      {value}
    </p>
  </div>
);

// Renders a calculation result (preview) - same shape the server returns from /payslips/preview.
const PayslipBreakdown = ({ data }) => {
  if (!data) return null;

  const a = data.attendance;
  const earnings = earningRows(data.earnings);
  const deductions = deductionRows(data.deductions);

  return (
    <div className="min-w-0 space-y-4">
      {data.warnings?.length > 0 && (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3">
          {data.warnings.map((w, i) => (
            <p key={i} className="flex gap-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{w}</span>
            </p>
          ))}
        </div>
      )}

      {a && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">
            Attendance summary
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Working days" value={a.workingDays} />
            <Stat label="Present" value={a.present} />
            <Stat label="Paid leave" value={a.paidLeaves} />
            <Stat label="LOP days" value={a.lopDays} />
            <Stat label="Late marks" value={a.lateMarks} />
            <Stat label="Overtime hrs" value={a.overtimeHours} />
            <Stat
              label="Paid days"
              value={`${a.payableDays} / ${a.payDaysDivisor}`}
            />
            <Stat label="Per-day pay" value={money(a.perDaySalary)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Earnings */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200">
          <p className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
            Earnings
          </p>

          {earnings.map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between gap-3 border-t border-slate-100 px-4 py-2 text-sm"
            >
              <span className="min-w-0 break-words text-slate-600">
                {label}
              </span>
              <span className="shrink-0 text-right text-slate-800">
                {money(value)}
              </span>
            </div>
          ))}

          <div className="flex items-start justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium">
            <span>Total earnings</span>
            <span className="shrink-0 text-right">
              {money(data.earnings?.total)}
            </span>
          </div>
        </div>

        {/* Deductions */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200">
          <p className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
            Deductions
          </p>

          {deductions.length === 0 && (
            <p className="border-t border-slate-100 px-4 py-2 text-sm text-slate-400">
              No deductions
            </p>
          )}

          {deductions.map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between gap-3 border-t border-slate-100 px-4 py-2 text-sm"
            >
              <span className="min-w-0 break-words text-slate-600">
                {label}
              </span>
              <span className="shrink-0 text-right text-rose-500">
                −{money(value)}
              </span>
            </div>
          ))}

          <div className="flex items-start justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium">
            <span>Total deductions</span>
            <span className="shrink-0 text-right">
              {money(data.deductions?.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Net Pay */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 sm:p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-emerald-700">
            Net pay
          </p>

          <p className="mt-0.5 max-w-[260px] break-words text-[11px] text-slate-500">
            {amountInWords(data.netPay)}
          </p>
        </div>

        <p className="shrink-0 text-lg font-semibold text-slate-800 sm:text-xl">
          {money(data.netPay)}
        </p>
      </div>
    </div>
  );
};

export default PayslipBreakdown;
