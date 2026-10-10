import React, { useCallback, useEffect, useState } from "react";
import Loading from "../components/Loading";
import PayslipsList from "../components/payslips/PayslipsList";
import GeneratePayslipForm from "../components/payslips/GeneratePayslipForm";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

const Payslips = () => {
  const [payslips, setPayslips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const fetchPayslips = useCallback(async () => {
    try {
      const res = await api.get("/payslips");

      setPayslips(res.data.data || []);
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to load payslips"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchEmployees = async () => {
      try {
        const res = await api.get("/employees");

        setEmployees(
          (res.data || []).filter((employee) => !employee.isDeleted)
        );
      } catch (error) {
        toast.error(
          error?.response?.data?.error ||
            error?.message ||
            "Failed to load employees"
        );
      }
    };

    fetchEmployees();
  }, [isAdmin]);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">
            Payslips
          </h1>

          <p className="text-sm text-slate-500">
            {isAdmin
              ? "Review and manage all employee payslips"
              : "Access and download your payslips"}
          </p>
        </div>

        {isAdmin && (
          <GeneratePayslipForm
            employees={employees}
            onSuccess={fetchPayslips}
          />
        )}
      </div>

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <PayslipsList payslips={payslips} isAdmin={isAdmin} />
      </div>
    </div>
  );
};

export default Payslips;