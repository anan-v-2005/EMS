
import { Loader, Save, User } from "lucide-react";
import React, { useState } from "react";
import api from "../api/axios";

const ProfileForm = ({ initialData, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(e.currentTarget);

    try {
      await api.post("/profile", formData);
      setMessage("Profile Updated Successfully ... ");
      onSuccess?.();
    } catch (error) {
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <form onSubmit={handleSubmit} className="min-w-0 space-y-5">

        {/* Header */}
        <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <User className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              Public Profile
            </h2>

            <p className="text-sm text-slate-500">
              View and manage your profile details
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
            <div className="break-words text-sm font-medium text-red-600">
              {error}
            </div>
          </div>
        )}

        {/* Success Message */}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
            <div className="break-words text-sm font-medium text-emerald-700">
              {message}
            </div>
          </div>
        )}

        {/* Profile Fields */}
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Name */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Full Name
            </label>

            <input
              disabled
              value={`${initialData.firstName} ${initialData.lastName}`}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 cursor-not-allowed focus:outline-none"
            />
          </div>

          {/* Email */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>

            <input
              disabled
              value={initialData.email}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 cursor-not-allowed focus:outline-none"
            />
          </div>

          {/* Position */}
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Position
            </label>

            <input
              disabled
              value={initialData.position}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 cursor-not-allowed focus:outline-none"
            />
          </div>

          {/* Bio */}
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Bio
            </label>

            <textarea
              disabled={initialData.isDeleted}
              name="bio"
              defaultValue={initialData.bio || ""}
              placeholder="Write a brief Bio..."
              className={`min-h-[120px] w-full min-w-0 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                initialData.isDeleted
                  ? "cursor-not-allowed bg-slate-50 text-slate-400"
                  : "bg-white"
              }`}
            />

            <p className="mt-1 text-xs text-slate-500">
              This will be displayed on your public profile.
            </p>
          </div>

          {initialData.isDeleted ? (
            <div className="pt-2 sm:col-span-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">
                  Account Deactivated
                </p>

                <p className="mt-1 text-sm text-rose-600">
                  You can no longer update your account.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-end pt-2 sm:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {loading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                Save Changes
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;
