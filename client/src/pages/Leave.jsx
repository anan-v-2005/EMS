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
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 min-h-screen animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            Leave Management
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? "Manage Leave Applications"
              : "Your Leave History"}
          </p>
        </div>

        {!isAdmin && !isDeleted && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-purple-600 text-white px-4 py-2.5 rounded-xl shadow-md hover:shadow-2xl hover:scale-[1.05] active:scale-95 transition-all duration-300"
          >
            <PlusIcon className="w-4 h-4" />
            Apply For Leave
          </button>
        )}
      </div>

      {/* STATS */}
      {!isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {leaveStats.map((i) => (
            <div
              key={i.label}
              className="group p-5 rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-emerald-700 group-hover:scale-110 transition">
                  <i.icon className="w-5 h-5" />
                </div>

                <div className="text-right">
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
      <LeaveHistory
        leaves={leaves}
        onUpdate={fetchLeaves}
        isAdmin={isAdmin}
      />

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