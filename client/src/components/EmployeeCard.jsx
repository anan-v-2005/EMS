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

  const employeeId =
    employee.id || employee._id;


  const handleDelete = async () => {

    const confirmed = window.confirm(
      `Archive ${employee.firstName} ${employee.lastName}? Their history will be preserved.`,
    );

    if (!confirmed) return;


    try {

      await api.delete(
        `/employees/${employeeId}`,
      );

      toast.success(
        "Employee archived successfully",
      );


      if (onDelete) {
        await onDelete();
      }


    } catch (err) {

      console.error(
        "Failed to archive employee:",
        err,
      );

      toast.error(
        err?.response?.data?.error ||
        "Failed to archive employee",
      );

    }

  };


  return (

    <div className="group relative overflow-hidden rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">


      {/* ================= TOP ================= */}

      <div className="flex items-start justify-between gap-3">


        <div className="flex min-w-0 items-center gap-3">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EDF4EE] text-sm font-semibold text-[#4A6F52]">
            {employee.profilePhotoUrl ? (
              <img src={employee.profilePhotoUrl} alt={`${employee.firstName} ${employee.lastName}`} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <>
                {employee.firstName?.[0] || ""}
                {employee.lastName?.[0] || ""}
              </>
            )}
          </div>


          <div className="min-w-0">

            <h3 className="truncate text-sm font-semibold">

              {employee.firstName}{" "}
              {employee.lastName}

            </h3>


            <p className="truncate text-xs text-[#8A968C]">

              {employee.position || "—"}

            </p>

          </div>

        </div>


        <span
          className={`badge ${
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


        <div className="rounded-xl bg-[#F8FAF7] p-3">

          <p className="text-[#8A968C]">
            Department
          </p>

          <p className="mt-1 truncate font-medium">

            {employee.department || "—"}

          </p>

        </div>


        <div className="rounded-xl bg-[#F8FAF7] p-3">

          <p className="text-[#8A968C]">
            Joined
          </p>

          <p className="mt-1 font-medium">

            {employee.joinDate
              ? new Date(
                  employee.joinDate,
                ).toLocaleDateString("en-IN")
              : "—"}

          </p>

        </div>

      </div>


      {/* ================= ACTIONS ================= */}

      <div className="mt-4 flex gap-2">


        <Link
          to={`/employees/${employeeId}`}
          className="btn-secondary inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs"
        >

          <Eye className="h-3.5 w-3.5" />

          View 360

        </Link>


        <button
          type="button"
          onClick={() => onEdit(employee)}
          className="rounded-xl border border-[#E2E7E1] p-2 text-[#637066] transition hover:bg-[#EDF4EE]"
          aria-label="Edit employee"
        >

          <Pencil className="h-4 w-4" />

        </button>


        <button
          type="button"
          onClick={handleDelete}
          className="rounded-xl border border-[#E2E7E1] p-2 text-[#D92D20] transition hover:bg-[#FEF3F2]"
          aria-label="Archive employee"
        >

          <Trash2 className="h-4 w-4" />

        </button>


      </div>

    </div>

  );
}