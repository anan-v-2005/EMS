
import React, { useState } from "react";
import { Loader2Icon, LockIcon, X } from "lucide-react";
import api from "../api/axios";

const ChangePasswordModel = ({
  open,
  onClose,
  forced = false,
  onChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");

    try {
      const { data } = await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      if (!data.success) {
        throw new Error(data.error || "Failed");
      }

      // Keep this browser signed in with the fresh token.
      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      setMessage({
        type: "success",
        text: "Password Updated Successfully ...",
      });

      e.target.reset();

      if (onChanged) {
        await onChanged();
      }
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.error ||
          error.message ||
          "Failed to change password",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={forced ? undefined : onClose}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative my-auto w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 pb-0 sm:p-6 sm:pb-0">
          <h2 className="flex min-w-0 items-center gap-3 text-base font-medium text-slate-900 sm:text-lg">
            <LockIcon className="h-5 w-5 shrink-0 text-slate-800" />
            <span className="min-w-0">
              {forced
                ? "Set a new password to continue"
                : "Change Password"}
            </span>
          </h2>

          {!forced && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <form
          className="space-y-5 p-4 sm:p-6"
          onSubmit={handleSubmit}
        >
          {message.text && (
            <div
              className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
                message.type === "success"
                  ? "border border-emerald-200 bg-emerald-100 text-emerald-800"
                  : "border border-rose-200 bg-rose-100 text-rose-800"
              }`}
            >
              <div
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-2xl ${
                  message.type === "success"
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
              />

              <span className="min-w-0 break-words">
                {message.text}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-700">
              Current Password
            </label>
            <input
              type="password"
              name="currentPassword"
              className="w-full min-w-0"
              required
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700">
              New Password
            </label>
            <input
              type="password"
              name="newPassword"
              className="w-full min-w-0"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-slate-500">
              At least 8 characters, with a letter and a number.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            {!forced && (
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full flex-1 sm:w-auto"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full flex-1 items-center justify-center gap-2 sm:w-auto"
            >
              {loading && (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              )}
              Change Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModel;
