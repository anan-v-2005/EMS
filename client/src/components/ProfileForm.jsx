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
      await api.post("/profile",formData)
      setMessage("Profile Updated Successfully ... ")
      onSuccess?.()
    } catch (error) {
      setError(error.response?.data?.error || error.message)
    }finally{
      setLoading(false)
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="h-11 w-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
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
            <div className="text-sm font-medium text-red-600">{error}</div>
          </div>
        )}

        {/* Success Message */}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
            <div className="text-sm font-medium text-emerald-700">
              {message}
            </div>
          </div>
        )}

        {/* Profile Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Full Name
            </label>
            <input
              disabled
              value={`${initialData.firstName} ${initialData.lastName}`}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 cursor-not-allowed bg-slate-50 text-slate-700 text-sm font-medium focus:outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              disabled
              value={initialData.email}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 cursor-not-allowed bg-slate-50 text-slate-700 text-sm font-medium focus:outline-none"
            />
          </div>

          {/* Position */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Position
            </label>
            <input
              disabled
              value={initialData.position}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 cursor-not-allowed bg-slate-50 text-slate-700 text-sm font-medium focus:outline-none"
            />
          </div>

          {/* Bio */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bio
            </label>
            <textarea
              disabled={initialData.isDeleted}
              name="bio"
              defaultValue={initialData.bio || ""}
              placeholder="Write a brief Bio..."
              className={`w-full min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 transition resize-none ${
                initialData.isDeleted
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white"
              }`}
            ></textarea>
            <p className="text-xs text-slate-500 mt-1">
              This will be displayed on your public profile.
            </p>
          </div>

          {initialData.isDeleted ? (
            <div className="sm:col-span-2 pt-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">
                  Account Deactivated
                </p>
                <p className="text-sm text-rose-600 mt-1">
                  You can no longer update your account.
                </p>
              </div>
            </div>
          ) : (
            <div className="sm:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-3 transition disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
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
