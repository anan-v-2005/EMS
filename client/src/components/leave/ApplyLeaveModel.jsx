import React, { useState } from "react";
import { CalendarDays, FileText, Loader2, SendIcon, X } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const ApplyLeaveModel = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const today = new Date();
  const tommorow = new Date(today);
  tommorow.setDate(today.getDate() + 1);
  const minDate = tommorow.toISOString().split("T")[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())
    try {
      await api.post('/leave',data)
      onSuccess();
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-100 bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-7 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-100">
              <CalendarDays size={18} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800 tracking-tight">
                Apply for Leave
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Submit your leave request for approval
              </p>
            </div>
          </div>
          <button
            className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          {/* Leave Type */}
          <div className="relative group">
            <select
              name="type"
              required
              defaultValue=""
              className="peer w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3.5 pt-6 pb-2.5 outline-none focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all appearance-none cursor-pointer"
            >
              <option value="" disabled />
              <option value="SICK">🤒  Sick Leave</option>
              <option value="CASUAL">☂️  Casual Leave</option>
              <option value="ANNUAL">🌴  Annual Leave</option>
            </select>
            <label className="absolute left-3.5 top-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest transition-all peer-focus:text-violet-500">
              Leave Type
            </label>
            <FileText className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
          </div>

          {/* Duration */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              <CalendarDays size={11} className="text-violet-400" />
              Duration
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* From */}
              <div className="relative">
                <input
                  type="date"
                  name="startDate"
                  required
                  min={minDate}
                  className="peer w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 pt-6 pb-2 outline-none focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all"
                />
                <label className="absolute left-3 top-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest peer-focus:text-violet-500">
                  From
                </label>
              </div>

              {/* To */}
              <div className="relative">
                <input
                  type="date"
                  name="endDate"
                  required
                  min={minDate}
                  className="peer w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 pt-6 pb-2 outline-none focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all"
                />
                <label className="absolute left-3 top-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest peer-focus:text-violet-500">
                  To
                </label>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="relative">
            <textarea
              name="reason"
              required
              rows={3}
              placeholder=" "
              className="peer w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3.5 pt-6 pb-2.5 outline-none focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all resize-none placeholder:text-slate-300"
            />
            <label className="absolute left-3.5 top-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest peer-focus:text-violet-500">
              Reason
            </label>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Buttons */}
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SendIcon className="w-4 h-4" />
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