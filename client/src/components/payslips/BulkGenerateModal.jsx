
import React, { useState } from "react";
import { Users, Loader2Icon } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import ModalShell, {
  inputClass,
  labelClass,
  primaryBtn,
  secondaryBtn,
} from "./ModalShell";
import {
  MONTHS,
  errorText,
  isMonthOver,
  money,
} from "../../utils/format";

const now = new Date();

const BADGE = {
  created: "badge-success",
  updated: "badge-success",
  skipped: "badge-warning",
  error: "badge-danger",
};

const BulkGenerateModal = ({ open, onClose, onSuccess }) => {
  const [month, setMonth] = useState(
    now.getMonth() === 0 ? 12 : now.getMonth(),
  );

  const [year, setYear] = useState(
    now.getMonth() === 0
      ? now.getFullYear() - 1
      : now.getFullYear(),
  );

  const [allowEarly, setAllowEarly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!open) return null;

  const over = isMonthOver(month, year);

  const run = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post("/payslips/bulk", {
        month: Number(month),
        year: Number(year),
        allowEarly,
      });

      setResult(data);

      toast.success(
        `${data.summary.created + data.summary.updated} draft payslip(s) ready for review`,
      );

      await onSuccess?.({
        month: Number(month),
        year: Number(year),
      });
    } catch (error) {
      toast.error(
        errorText(error, "Bulk generation failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setResult(null);
    onClose();
  };

  return (
    <ModalShell
      title="Bulk Generate Payslips"
      subtitle="Create draft payslips for every active employee"
      icon={Users}
      onClose={close}
      busy={loading}
      wide={Boolean(result)}
    >
      {!result ? (
        <form
          onSubmit={run}
          className="space-y-5 p-4 sm:p-6"
        >
          {/* Month and Year */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0">
              <label className={labelClass}>
                Month
              </label>

              <select
                className={`${inputClass} w-full min-w-0`}
                value={month}
                onChange={(e) =>
                  setMonth(Number(e.target.value))
                }
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className={labelClass}>
                Year
              </label>

              <input
                className={`${inputClass} w-full min-w-0`}
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={(e) =>
                  setYear(e.target.value)
                }
              />
            </div>
          </div>

          {/* Early Generation */}
          {!over && (
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-slate-600">
              <input
                type="checkbox"
                style={{
                  width: "auto",
                  marginTop: 2,
                  flexShrink: 0,
                }}
                checked={allowEarly}
                onChange={(e) =>
                  setAllowEarly(e.target.checked)
                }
              />

              <span className="leading-5">
                This month has not ended. Generate early
                (remaining days are assumed paid).
              </span>
            </label>
          )}

          {/* Information */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 text-sm leading-6 text-slate-600 sm:p-4">
            Drafts are calculated from salary structures,
            attendance, approved leave and holidays.
            Existing drafts are refreshed (any bonus/TDS
            you added by hand is reset), finalized payslips
            are never touched, and nothing is visible to
            employees until you finalize.
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end sm:gap-3 sm:pt-2">
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className={`${secondaryBtn} w-full justify-center sm:w-auto`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || (!over && !allowEarly)}
              className={`${primaryBtn} min-h-10 w-full justify-center sm:w-auto sm:min-w-[140px]`}
            >
              {loading ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Working...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Generate drafts
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 p-4 sm:p-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              ["Created", result.summary.created],
              ["Updated", result.summary.updated],
              ["Skipped", result.summary.skipped],
              ["Errors", result.summary.errors],
            ].map(([l, v]) => (
              <div
                key={l}
                className="rounded-xl border border-slate-200 bg-slate-50 py-3"
              >
                <p className="text-lg font-semibold text-slate-800">
                  {v}
                </p>

                <p className="text-xs text-slate-500">
                  {l}
                </p>
              </div>
            ))}
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[480px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {result.results.map((r) => (
                  <tr key={r.employeeId}>
                    <td className="px-4 py-2.5 text-slate-700">
                      {r.name}
                    </td>

                    <td className="px-4 py-2.5">
                      <span
                        className={`badge ${BADGE[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 text-right text-xs text-slate-500">
                      {r.net != null
                        ? money(r.net)
                        : r.reason}

                      {r.warnings
                        ? ` · ${r.warnings} warning(s)`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-slate-100 pt-3 sm:pt-2">
            <button
              onClick={close}
              className={`${primaryBtn} w-full justify-center sm:w-auto`}
            >
              Review drafts
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
};

export default BulkGenerateModal;
