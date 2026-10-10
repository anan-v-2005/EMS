import React, { useState } from "react";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios";

export const LeaveHistory = ({ leaves, isAdmin, onUpdate }) => {
  const [processing, setProcessing] = useState(null);

  const handleStatusUpdate = async (id, status) => {
    setProcessing(id);

    try {
      await api.patch(`/leave/${id}`, { status });

      toast.success(
        status === "APPROVED"
          ? "Leave approved successfully"
          : "Leave rejected successfully"
      );

      await onUpdate();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to update leave"
      );
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="mt-8 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">

          {/* TABLE HEADER */}
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              {isAdmin && (
                <th className="px-6 py-3">
                  Employee
                </th>
              )}

              <th className="px-6 py-3">
                Type
              </th>

              <th className="px-6 py-3">
                Date
              </th>

              <th className="px-6 py-3">
                Reason
              </th>

              <th className="px-6 py-3">
                Status
              </th>

              {isAdmin && (
                <th className="px-6 py-3 text-center">
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
                  className="text-center py-10 text-slate-400"
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
                    className="hover:bg-slate-50 transition-all duration-200"
                  >

                    {/* EMPLOYEE */}
                    {isAdmin && (
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {i.employee?.firstName || "-"}
                      </td>
                    )}

                    {/* TYPE */}
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        {i.type}
                      </span>
                    </td>

                    {/* DATE */}
                    <td className="px-6 py-4 text-slate-500">
                      {i.startDate && i.endDate
                        ? `${format(
                            new Date(i.startDate),
                            "dd MMM yyyy"
                          )} - ${format(
                            new Date(i.endDate),
                            "dd MMM yyyy"
                          )}`
                        : "-"}
                    </td>

                    {/* REASON */}
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                      {i.reason || "-"}
                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
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
                                  "APPROVED"
                                )
                              }
                              disabled={!!processing}
                              className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Approve Leave"
                            >
                              {processing === leaveId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>

                            {/* REJECT BUTTON */}
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusUpdate(
                                  leaveId,
                                  "REJECTED"
                                )
                              }
                              disabled={!!processing}
                              className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Reject Leave"
                            >
                              {processing === leaveId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
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