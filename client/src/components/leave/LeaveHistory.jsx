
import React, { useState } from "react";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios";

export const LeaveHistory = ({ leaves, isAdmin, onUpdate }) => {
  const [processing, setProcessing] = useState(null);

  const handleStatusUpdate = async (id, status) => {
    let note = "";

    if (status === "REJECTED") {
      note = (
        window.prompt(
          "Reason for rejecting this leave request (shown to the employee):",
        ) || ""
      ).trim();

      if (!note) {
        return toast.error(
          "A reason is required to reject a leave request",
        );
      }
    }

    setProcessing(id);

    try {
      await api.patch(`/leave/${id}`, { status, note });

      toast.success(
        status === "APPROVED"
          ? "Leave approved successfully"
          : "Leave rejected successfully",
      );

      await onUpdate();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to update leave",
      );
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur-xl">
      {/* Mobile scroll hint */}
      <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-400 sm:hidden">
        Scroll horizontally to view all columns
      </p>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          {/* TABLE HEADER */}
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              {isAdmin && (
                <th className="whitespace-nowrap px-6 py-3">
                  Employee
                </th>
              )}

              <th className="whitespace-nowrap px-6 py-3">
                Type
              </th>

              <th className="whitespace-nowrap px-6 py-3">
                Date
              </th>

              <th className="px-6 py-3">
                Reason
              </th>

              <th className="whitespace-nowrap px-6 py-3">
                Status
              </th>

              {isAdmin && (
                <th className="whitespace-nowrap px-6 py-3 text-center">
                  Action
                </th>
              )}
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="divide-y divide-slate-100">
            {leaves.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 4}
                  className="py-10 text-center text-slate-400"
                >
                  No Leaves found
                </td>
              </tr>
            ) : (
              leaves.map((i) => {
                const leaveId = i._id || i.id;

                return (
                  <tr
                    key={leaveId}
                    className="transition-all duration-200 hover:bg-slate-50"
                  >
                    {/* EMPLOYEE */}
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-700">
                        {i.employee?.firstName || "-"}
                      </td>
                    )}

                    {/* TYPE */}
                    <td className="px-6 py-4">
                      <span className="whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        {i.type}
                      </span>
                    </td>

                    {/* DATE */}
                    <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                      {i.startDate && i.endDate
                        ? `${format(
                            new Date(i.startDate),
                            "dd MMM yyyy",
                          )} - ${format(
                            new Date(i.endDate),
                            "dd MMM yyyy",
                          )}`
                        : "-"}
                    </td>

                    {/* REASON */}
                    <td className="max-w-xs px-6 py-4 text-slate-600">
                      <div className="truncate">
                        {i.reason || "-"}
                      </div>

                      {i.reviewNote && (
                        <div className="mt-1 whitespace-normal text-xs text-slate-400">
                          Reviewer: {i.reviewNote}
                        </div>
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-4">
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                          i.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-700"
                            : i.status === "REJECTED"
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>

                    {/* ACTION */}
                    {isAdmin && (
                      <td className="px-6 py-4">
                        {i.status === "PENDING" ? (
                          <div className="flex items-center justify-center gap-3">
                            {/* APPROVE BUTTON */}
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusUpdate(
                                  leaveId,
                                  "APPROVED",
                                )
                              }
                              disabled={!!processing}
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 transition-all duration-200 hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                              title="Approve Leave"
                            >
                              {processing === leaveId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>

                            {/* REJECT BUTTON */}
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusUpdate(
                                  leaveId,
                                  "REJECTED",
                                )
                              }
                              disabled={!!processing}
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600 transition-all duration-200 hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                              title="Reject Leave"
                            >
                              {processing === leaveId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-xs text-slate-400">
                            -
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
