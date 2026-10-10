import React, { useState } from "react";
import { DEPARTMENTS } from "../assets/assets";
import { Loader2Icon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";

const EmployeeFrom = ({ initialData, onSuccess, onCancel }) => {
  const isEditMode = !!initialData;
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(initialData?.profilePhotoUrl || "");

  const navigate = useNavigate();

  const input =
    "w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-slate-300 focus:outline-none text-sm bg-white";

  const label = "block text-xs font-medium text-slate-500 mb-1";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    if (isEditMode) {
      const pwd = formData.get("password");

      if (!pwd) {
        formData.delete("password");
      }
    }

    try {
      const url = isEditMode
        ? `/employees/${initialData.id}`
        : "/employees";

      const method = isEditMode ? "put" : "post";

      await api[method](url, formData);

      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/employees");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* TOP GRID */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* PERSONAL INFO */}
        <div className="bg-slate-50 p-5 rounded-xl border space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-200">
            Personal Info
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>First name</label>

              <input
                name="firstName"
                className={input}
                defaultValue={initialData?.firstName || ""}
                placeholder="First name"
                required
              />
            </div>

            <div>
              <label className={label}>Last name</label>

              <input
                name="lastName"
                className={input}
                defaultValue={initialData?.lastName || ""}
                placeholder="Last name"
                required
              />
            </div>
          </div>

          <div>
            <label className={label}>Phone</label>

            <input
              name="phone"
              className={input}
              defaultValue={initialData?.phone || ""}
              placeholder="Phone"
              required
            />
          </div>

          <div>
            <label className={label}>Join date</label>

            <input
              name="joinDate"
              className={input}
              type="date"
              defaultValue={
                initialData?.joinDate
                  ? new Date(initialData.joinDate)
                      .toISOString()
                      .split("T")[0]
                  : ""
              }
              required
            />
          </div>

          <div>
            <label className={label}>Bio</label>

            <textarea
              name="bio"
              className={input}
              rows={3}
              defaultValue={initialData?.bio || ""}
              placeholder="Bio"
            />
          </div>
        </div>

        {/* JOB DETAILS */}
        <div className="bg-slate-50 p-5 rounded-xl border space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-200">
            Job Details
          </h3>

          <div>
            <label className={label}>Department</label>

            <select
              name="department"
              className={input}
              defaultValue={initialData?.department || ""}
              required
            >
              <option value="">Select department</option>

              {DEPARTMENTS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Position</label>

            <input
              name="position"
              className={input}
              defaultValue={initialData?.position || ""}
              placeholder="Position"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Basic salary</label>

              <input
                name="basicSalary"
                className={input}
                type="number"
                defaultValue={initialData?.basicSalary || 0}
                placeholder="Basic salary"
              />
            </div>

            <div>
              <label className={label}>Allowances</label>

              <input
                name="allowance"
                className={input}
                type="number"
                defaultValue={initialData?.allowance || 0}
                placeholder="Allowances"
              />
            </div>
          </div>

          <div>
            <label className={label}>Deductions</label>

            <input
              name="deductions"
              className={input}
              type="number"
              defaultValue={initialData?.deductions || 0}
              placeholder="Deductions"
            />
          </div>

          {isEditMode && (
            <div>
              <label className={label}>Employment status</label>

              <select
                name="employmentStatus"
                className={input}
                defaultValue={
                  initialData?.employmentStatus || "ACTIVE"
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ACCOUNT SETUP */}
      <div className="bg-slate-50 p-5 rounded-xl border">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-200 mb-4">
          Account Setup
        </h3>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>Email</label>

            <input
              type="email"
              name="email"
              className={input}
              defaultValue={initialData?.email || ""}
              placeholder="Enter email"
              required
            />
          </div>

          <div>
            <label className={label}>
              {!isEditMode
                ? "Password"
                : "Change password (optional)"}
            </label>

            <input
              type="password"
              name="password"
              className={input}
              placeholder={
                isEditMode
                  ? "Leave blank to keep same"
                  : "Create password"
              }
              required={!isEditMode}
            />
          </div>

          <div>
            <label className={label}>Role</label>

            <select
              name="role"
              className={input}
              defaultValue={initialData?.user?.role || "EMPLOYEE"}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* PROFILE PHOTO */}
      <div className="bg-slate-50 p-5 rounded-xl border">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-200 mb-4">
          Profile Photo
        </h3>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#EDF4EE] flex items-center justify-center text-sm font-semibold text-[#4A6F52]">
            {photoPreview ? (
              <img src={photoPreview} alt="Employee preview" className="h-full w-full object-cover" />
            ) : (
              <>{initialData?.firstName?.[0] || ""}{initialData?.lastName?.[0] || ""}</>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <label className={label}>Employee photo</label>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={input}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("Image must be 5 MB or smaller");
                  e.target.value = "";
                  return;
                }
                setPhotoPreview(URL.createObjectURL(file));
              }}
            />
            <p className="mt-1 text-[11px] text-slate-400">JPG, PNG, WEBP or GIF · maximum 5 MB</p>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() =>
            onCancel ? onCancel() : navigate(-1)
          }
          className="px-5 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center justify-center"
          disabled={loading}
        >
          {loading && (
            <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
          )}

          {isEditMode
            ? "Update Employee"
            : "Create Employee"}
        </button>
      </div>
    </form>
  );
};

export default EmployeeFrom;