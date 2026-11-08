
import {
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { Link } from "react-router-dom";

import api from "../api/axios";
import toast from "react-hot-toast";

export default function EmployeeCard({
  employee,
  onDelete,
  onEdit,
}) {
  const employeeId = employee.id || employee._id;

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Archive ${employee.firstName} ${employee.lastName}? Their history will be preserved.`,
    );

    if (!confirmed) return;

    try {
      await api.delete(`/employees/${employeeId}`);

      toast.success("Employee archived successfully");

      if (onDelete) {
        await onDelete();
      }
    } catch (err) {
      console.error("Failed to archive employee:", err);

      toast.error(
        err?.response?.data?.error ||
          "Failed to archive employee",
      );
    }
  };

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-[#E2E7E1] bg-white p-4 shadow-sm transition duration-200 sm:p-5 sm:hover:-translate-y-1 sm:hover:shadow-lg">

      {/* ================= TOP ================= */}

      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">

        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EDF4EE] text-sm font-semibold text-[#4A6F52] sm:h-12 sm:w-12">
            {employee.profilePhotoUrl ? (
              <img
                src={employee.profilePhotoUrl}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <>
                {employee.firstName?.[0] || ""}
                {employee.lastName?.[0] || ""}
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">

            <h3 className="truncate text-sm font-semibold">
              {employee.firstName}{" "}
              {employee.lastName}
            </h3>

            <p className="mt-0.5 truncate text-xs text-[#8A968C]">
              {employee.position || "—"}
            </p>

          </div>

        </div>

        <span
          className={`badge max-w-[105px] shrink-0 truncate text-[10px] sm:max-w-none sm:text-xs ${
            employee.employmentStatus === "ACTIVE"
              ? "bg-[#ECFDF3] text-[#039855]"
              : "bg-[#FEF3F2] text-[#D92D20]"
          }`}
        >
          {employee.employmentStatus || "ACTIVE"}
        </span>

      </div>

      {/* ================= INFORMATION ================= */}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">

        <div className="min-w-0 rounded-xl bg-[#F8FAF7] p-2.5 sm:p-3">

          <p className="text-[#8A968C]">
            Department
          </p>

          <p className="mt-1 truncate font-medium">
            {employee.department || "—"}
          </p>

        </div>

        <div className="min-w-0 rounded-xl bg-[#F8FAF7] p-2.5 sm:p-3">

          <p className="text-[#8A968C]">
            Joined
          </p>

          <p className="mt-1 truncate font-medium">
            {employee.joinDate
              ? new Date(
                  employee.joinDate,
                ).toLocaleDateString("en-IN")
              : "—"}
          </p>

        </div>

      </div>

      {/* ================= ACTIONS ================= */}

      <div className="mt-4 flex items-center gap-2">

        <Link
          to={`/employees/${employeeId}`}
          className="btn-secondary inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs sm:px-3"
        >
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">View 360</span>
        </Link>

        <button
          type="button"
          onClick={() => onEdit(employee)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2E7E1] text-[#637066] transition hover:bg-[#EDF4EE]"
          aria-label="Edit employee"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2E7E1] text-[#D92D20] transition hover:bg-[#FEF3F2]"
          aria-label="Archive employee"
        >
          <Trash2 className="h-4 w-4" />
        </button>

      </div>

    </div>
  );
}
