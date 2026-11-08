
import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  FileText,
  Loader2,
  SendIcon,
  X,
} from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const ApplyLeaveModel = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const [formValues, setFormValues] = useState({
    type: "",
    startDate: "",
    endDate: "",
    halfDay: false,
  });

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  useEffect(() => {
    if (
      !open ||
      !formValues.type ||
      !formValues.startDate ||
      !formValues.endDate
    ) {
      setPreview(null);
      return;
    }

    let active = true;

    setPreviewLoading(true);

    api
      .get("/enterprise/leave-preview", {
        params: formValues,
      })
      .then(({ data }) => {
        if (active) setPreview(data);
      })
      .catch(() => {
        if (active) setPreview(null);
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, formValues]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      await api.post("/leave", data);

      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.error || error.message,
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-2 backdrop-blur-md transition-all sm:p-4"
      onClick={onClose}
    >
      <div
        className="my-auto flex max-h-[calc(100dvh-16px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.18)] sm:max-h-[calc(100vh-32px)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-7">
          <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
            <div className="shrink-0 rounded-xl border border-violet-100 bg-violet-50 p-2.5">
              <CalendarDays
                size={18}
                className="text-violet-600"
              />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-slate-800">
                Apply for Leave
              </h2>

              <p className="mt-0.5 text-xs text-slate-400">
                Submit your leave request for approval
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close leave application"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:space-y-5 sm:px-7 sm:py-6"
        >
          {/* Leave Type */}
          <div className="relative group">
            <select
              name="type"
              required
              value={formValues.type}
              onChange={(e) =>
                setFormValues((v) => ({
                  ...v,
                  type: e.target.value,
                }))
              }
              className="peer w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pb-2.5 pt-6 text-sm text-slate-700 outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50"
            >
              <option value="" disabled />
              <option value="SICK">🤒 Sick Leave</option>
              <option value="CASUAL">☂️ Casual Leave</option>
              <option value="ANNUAL">🌴 Annual Leave</option>
              <option value="EMERGENCY">🚨 Emergency Leave</option>
            </select>

            <label className="absolute left-3.5 top-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 transition-all peer-focus:text-violet-500">
              Leave Type
            </label>

            <FileText className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
          </div>

          {/* Duration */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              <CalendarDays
                size={11}
                className="text-violet-400"
              />
              Duration
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {/* From */}
              <div className="relative min-w-0">
                <input
                  type="date"
                  name="startDate"
                  required
                  min={minDate}
                  value={formValues.startDate}
                  onChange={(e) =>
                    setFormValues((v) => ({
                      ...v,
                      startDate: e.target.value,
                      endDate:
                        v.endDate &&
                        v.endDate < e.target.value
                          ? e.target.value
                          : v.endDate,
                    }))
                  }
                  className="peer w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 pb-2 pt-6 text-xs text-slate-700 outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50 sm:px-3 sm:text-sm"
                />

                <label className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 peer-focus:text-violet-500">
                  From
                </label>
              </div>

              {/* To */}
              <div className="relative min-w-0">
                <input
                  type="date"
                  name="endDate"
                  required
                  min={formValues.startDate || minDate}
                  value={formValues.endDate}
                  onChange={(e) =>
                    setFormValues((v) => ({
                      ...v,
                      endDate: e.target.value,
                    }))
                  }
                  className="peer w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 pb-2 pt-6 text-xs text-slate-700 outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50 sm:px-3 sm:text-sm"
                />

                <label className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 peer-focus:text-violet-500">
                  To
                </label>
              </div>
            </div>
          </div>

          {/* Half Day */}
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
            <input
              type="checkbox"
              name="halfDay"
              value="true"
              checked={formValues.halfDay}
              onChange={(e) =>
                setFormValues((v) => ({
                  ...v,
                  halfDay: e.target.checked,
                }))
              }
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />

            <span>
              Half-day request
              <span className="mt-0.5 block text-xs text-slate-400">
                Only applies to a single working day
              </span>
            </span>
          </label>

          {/* Leave Balance Preview */}
          {previewLoading && (
            <p className="text-xs text-slate-400">
              Checking leave balance…
            </p>
          )}

          {preview && !previewLoading && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">
                Leave balance preview
              </p>

              <div className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <p className="text-emerald-700">Requested</p>
                  <p className="mt-0.5 font-bold">
                    {preview.requestedDays} day(s)
                  </p>
                </div>

                <div>
                  <p className="text-emerald-700">Paid leave</p>
                  <p className="mt-0.5 font-bold">
                    {preview.paidDays} day(s)
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <p className="text-emerald-700">Loss of Pay</p>
                  <p className="mt-0.5 font-bold">
                    {preview.lopDays} day(s)
                  </p>
                </div>
              </div>

              {preview.lopDays > 0 && (
                <p className="mt-2 text-xs leading-5">
                  Warning: {preview.paidDays} day(s) will use paid
                  leave balance and {preview.lopDays} day(s) will
                  be Loss of Pay.
                </p>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="relative">
            <textarea
              name="reason"
              required
              rows={3}
              placeholder=" "
              className="peer w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pb-2.5 pt-6 text-sm text-slate-700 outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50 placeholder:text-slate-300"
            />

            <label className="absolute left-3.5 top-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 peer-focus:text-violet-500">
              Reason
            </label>
          </div>

          <div className="border-t border-slate-100" />

          {/* Buttons */}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:bg-violet-500 hover:shadow-violet-500/40 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendIcon className="h-4 w-4" />
              )}

              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyLeaveModel;
