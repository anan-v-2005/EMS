
import React from "react";
import { X } from "lucide-react";

// Shared modal chrome for payslip dialogs.
const ModalShell = ({
  title,
  subtitle,
  icon: Icon,
  onClose,
  busy = false,
  wide = false,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:p-6"
    onClick={() => !busy && onClose()}
  >
    <div
      className={`max-h-[calc(100dvh-1rem)] w-full ${
        wide ? "max-w-3xl" : "max-w-lg"
      } overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[92vh]`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-emerald-700">
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-800">
              {title}
            </h3>

            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => !busy && onClose()}
          disabled={busy}
          aria-label="Close"
          className="shrink-0 rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {children}
    </div>
  </div>
);

export const labelClass =
  "mb-2 block text-sm font-medium text-slate-700";

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60";

export const primaryBtn =
  "flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryBtn =
  "rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50";

export default ModalShell;
