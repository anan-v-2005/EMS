
import React, { useCallback, useEffect, useState } from "react";
import Loading from "../components/Loading";
import {
  PalmtreeIcon,
  PlusIcon,
  ThermometerIcon,
  UmbrellaIcon,
} from "lucide-react";
import { LeaveHistory } from "../components/leave/LeaveHistory";
import ApplyLeaveModel from "../components/leave/ApplyLeaveModel";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

const Leave = () => {
  const { user } = useAuth();

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  const fetchLeaves = useCallback(async () => {
    setLoading(true);

    try {
      const res = await api.get("/leave");

      setLeaves(res.data.data || []);

      if (res.data.employee?.isDeleted) {
        setIsDeleted(true);
      } else {
        setIsDeleted(false);
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error.message ||
          "Failed to load leaves"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  if (loading) {
    return <Loading />;
  }

  const sickCount = leaves.filter(
    (i) => i.type === "SICK"
  ).length;

  const casualCount = leaves.filter(
    (i) => i.type === "CASUAL"
  ).length;

  const annualCount = leaves.filter(
    (i) => i.type === "ANNUAL"
  ).length;

  const leaveStats = [
    {
      label: "Sick Leave",
      value: sickCount,
      icon: ThermometerIcon,
    },
    {
      label: "Casual Leave",
      value: casualCount,
      icon: UmbrellaIcon,
    },
    {
      label: "Annual Leave",
      value: annualCount,
      icon: PalmtreeIcon,
    },
  ];

  return (
    <div className="min-h-screen min-w-0 w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 p-3 sm:p-6 lg:p-8 animate-fade-in">
      {/* HEADER */}
      <div className="mb-6 flex min-w-0 flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
            Leave Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? "Manage Leave Applications"
              : "Your Leave History"}
          </p>
        </div>

        {!isAdmin && !isDeleted && (
          <button
            onClick={() => setShowModal(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-purple-600 px-4 py-2.5 text-white shadow-md transition-all duration-300 hover:shadow-2xl hover:scale-[1.05] active:scale-95 sm:w-auto"
          >
            <PlusIcon className="h-4 w-4" />
            Apply For Leave
          </button>
        )}
      </div>

      {/* STATS */}
      {!isAdmin && (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {leaveStats.map((i) => (
            <div
              key={i.label}
              className="group min-w-0 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="shrink-0 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 p-3 text-emerald-700 transition group-hover:scale-110">
                  <i.icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 text-right">
                  <p className="text-xs text-slate-500">
                    {i.label}
                  </p>

                  <p className="text-xl font-semibold text-slate-800">
                    {i.value}{" "}
                    <span className="text-sm font-normal text-slate-400">
                      taken
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LEAVE HISTORY */}
      <div className="mt-5 min-w-0 sm:mt-6">
        <LeaveHistory
          leaves={leaves}
          onUpdate={fetchLeaves}
          isAdmin={isAdmin}
        />
      </div>

      {/* APPLY LEAVE MODAL */}
      {!isAdmin && (
        <ApplyLeaveModel
          open={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={fetchLeaves}
        />
      )}
    </div>
  );
};

export default Leave;
