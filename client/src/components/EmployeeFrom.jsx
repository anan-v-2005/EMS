
import React, { useEffect, useState } from "react";
import { DEPARTMENTS } from "../assets/assets";
import { Loader2Icon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";

const EmployeeFrom = ({ initialData, onSuccess, onCancel }) => {
  const isEditMode = !!initialData;

  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(
    initialData?.profilePhotoUrl || "",
  );
  const [managerOptions, setManagerOptions] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    api
      .get("/employees")
      .then(({ data }) => {
        if (active) {
          setManagerOptions(
            (Array.isArray(data) ? data : []).filter(
              (item) =>
                item.employmentStatus === "ACTIVE" &&
                String(item.id || item._id) !==
                  String(initialData?.id || initialData?._id || ""),
            ),
          );
        }
      })
      .catch(() => {
        if (active) setManagerOptions([]);
      });

    return () => {
      active = false;
    };
  }, [initialData?.id, initialData?._id]);

  const input =
    "w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";

  const label = "mb-1 block text-xs font-medium text-slate-500";

  const section =
    "min-w-0 space-y-4 rounded-xl border bg-slate-50 p-4 sm:p-5";

  const sectionTitle =
    "border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400";

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
      const employeeId = initialData?.id || initialData?._id;

      const url = isEditMode
        ? `/employees/${employeeId}`
        : "/employees";

      const method = isEditMode ? "put" : "post";

      await api[method](url, formData);

      if (onSuccess) {
        await onSuccess();
      } else {
        navigate("/employees");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="min-w-0 space-y-4 sm:space-y-5"
    >
      {/* ================= TOP GRID ================= */}

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">

        {/* ================= PERSONAL INFO ================= */}

        <div className={section}>

          <h3 className={sectionTitle}>
            Personal Info
          </h3>

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">

            <div className="min-w-0">
              <label className={label}>
                First name
              </label>

              <input
                name="firstName"
                className={input}
                defaultValue={initialData?.firstName || ""}
                placeholder="First name"
                required
              />
            </div>

            <div className="min-w-0">
              <label className={label}>
                Last name
              </label>

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
            <label className={label}>
              Phone
            </label>

            <input
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={20}
              pattern="\+?[0-9\s\-\(\)]{7,20}"
              title="7-15 digits. Spaces, hyphens, brackets and a leading + are allowed."
              className={input}
              defaultValue={initialData?.phone || ""}
              placeholder="Phone"
              required
            />
          </div>

          <div>
            <label className={label}>
              Join date
            </label>

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
            <label className={label}>
              Bio
            </label>

            <textarea
              name="bio"
              className={`${input} resize-y`}
              rows={3}
              defaultValue={initialData?.bio || ""}
              placeholder="Bio"
            />
          </div>

        </div>

        {/* ================= JOB DETAILS ================= */}

        <div className={section}>

          <h3 className={sectionTitle}>
            Job Details
          </h3>

          <div>
            <label className={label}>
              Department
            </label>

            <select
              name="department"
              className={input}
              defaultValue={initialData?.department || ""}
              required
            >
              <option value="">
                Select department
              </option>

              {DEPARTMENTS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>
              Employment type
            </label>

            <select
              name="employmentType"
              className={input}
              defaultValue={initialData?.employmentType || ""}
            >
              <option value="">
                Not specified
              </option>
              <option value="FULL_TIME">
                Full-time
              </option>
              <option value="PART_TIME">
                Part-time
              </option>
              <option value="CONTRACT">
                Contract
              </option>
              <option value="INTERN">
                Intern
              </option>
              <option value="TEMPORARY">
                Temporary
              </option>
            </select>
          </div>

          <div>
            <label className={label}>
              Reporting manager
            </label>

            <select
              name="reportingManager"
              className={input}
              defaultValue={
                initialData?.reportingManager?._id ||
                initialData?.reportingManager ||
                ""
              }
            >
              <option value="">
                No reporting manager
              </option>

              {managerOptions.map((item) => (
                <option
                  key={item.id || item._id}
                  value={item.id || item._id}
                >
                  {item.firstName} {item.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>
              Position
            </label>

            <input
              name="position"
              className={input}
              defaultValue={initialData?.position || ""}
              placeholder="Position"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">

            <div className="min-w-0">
              <label className={label}>
                Basic salary
              </label>

              <input
                name="basicSalary"
                className={input}
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                defaultValue={initialData?.basicSalary || 0}
                placeholder="Basic salary"
              />
            </div>

            <div className="min-w-0">
              <label className={label}>
                Allowances
              </label>

              <input
                name="allowance"
                className={input}
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                defaultValue={initialData?.allowance || 0}
                placeholder="Allowances"
              />
            </div>

          </div>

          <div>
            <label className={label}>
              Deductions
            </label>

            <input
              name="deductions"
              className={input}
              type="number"
              min="0"
              max="10000000"
              step="0.01"
              defaultValue={initialData?.deductions || 0}
              placeholder="Deductions"
            />
          </div>

          {isEditMode && (
            <div>
              <label className={label}>
                Employment status
              </label>

              <select
                name="employmentStatus"
                className={input}
                defaultValue={
                  initialData?.employmentStatus || "ACTIVE"
                }
              >
                <option value="ACTIVE">
                  Active
                </option>
                <option value="INACTIVE">
                  Inactive
                </option>
              </select>
            </div>
          )}

        </div>

      </div>

      {/* ================= ACCOUNT SETUP ================= */}

      <div className={section}>

        <h3 className={sectionTitle}>
          Account Setup
        </h3>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="min-w-0">
            <label className={label}>
              Email
            </label>

            <input
              type="email"
              name="email"
              className={input}
              defaultValue={initialData?.email || ""}
              placeholder="Enter email"
              required
            />
          </div>

          <div className="min-w-0">
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

          <div className="min-w-0">
            <label className={label}>
              Role
            </label>

            <select
              name="role"
              className={input}
              defaultValue={initialData?.user?.role || "EMPLOYEE"}
            >
              <option value="EMPLOYEE">
                Employee
              </option>
              <option value="ADMIN">
                Admin
              </option>
            </select>
          </div>

        </div>

      </div>

      {/* ================= PROFILE PHOTO ================= */}

      <div className={section}>

        <h3 className={sectionTitle}>
          Profile Photo
        </h3>

        <div className="flex min-w-0 flex-col items-start gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-4">

          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EDF4EE] text-sm font-semibold text-[#4A6F52]">

            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Employee preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                {initialData?.firstName?.[0] || ""}
                {initialData?.lastName?.[0] || ""}
              </>
            )}

          </div>

          <div className="min-w-0 w-full flex-1">

            <label className={label}>
              Employee photo
            </label>

            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={`${input} min-w-0 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-[#EDF4EE] file:px-2 file:py-1 file:text-xs file:font-medium file:text-[#4A6F52]`}
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

            <p className="mt-1 text-[11px] text-slate-400">
              JPG, PNG, WEBP or GIF · maximum 5 MB
            </p>

          </div>

        </div>

      </div>

      {/* ================= ACTIONS ================= */}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end sm:gap-3">

        <button
          type="button"
          onClick={() =>
            onCancel ? onCancel() : navigate(-1)
          }
          className="w-full rounded-lg border px-5 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 sm:w-auto"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={loading}
        >
          {loading && (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
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
