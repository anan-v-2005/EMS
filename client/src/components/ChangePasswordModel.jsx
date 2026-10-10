import React, { useState } from "react";
import { Loader2Icon, LockIcon, X } from "lucide-react";
import api from "../api/axios";

const ChangePasswordModel = ({ open, onClose }) => {
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
      if (!data.success) throw new Error(data.error || "Failed");
      setMessage({type:"success",text:"Password Updated Successfully ..."})
      e.target.reset();
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.error || error.message || "Failed to change password" });
    }finally{
      setLoading(false)
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="flex items-center gap-3 text-lg font-medium text-slate-900">
            <LockIcon className="h-5 w-5 text-slate-800" /> Change Password
          </h2>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="p-6 space-y-5" onSubmit={handleSubmit}>
          {message.text && (
            <div
              className={`p-3 rounded-xl text-sm flex items-start gap-3 ${
                message.type === "success"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-rose-100 text-rose-800 border border-rose-200"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-2xl mt-1.5 shrink-0 ${
                  message.type === "success" ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />

              {message.text}
            </div>
          )}

          <div>
            <label className="">Current Password</label>
            <input type="password" name="currentPassword" required />
          </div>

          <div>
            <label className="">New Password</label>
            <input type="password" name="newPassword" required />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex flex-1 justify-center items-center gap-2"
            >
              {loading && <Loader2Icon className="w-4 h-4 animate-spin" />}
              Change Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModel;
