import React, { useState } from "react";
import { Loader2Icon, Plus, X, FileText } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const GeneratePayslipForm = ({ employees, onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="group flex items-center gap-2 px-4 py-2.5 text-sm font-medium
        bg-gradient-to-r from-emerald-700 to-purple-600
        text-white rounded-xl shadow-md
        hover:shadow-xl hover:-translate-y-0.5
        active:scale-95 transition-all duration-300"
      >
        <Plus
          className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90"
          strokeWidth={2.5}
        />

        <span>Generate Payslip</span>
      </button>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      await api.post("/payslips", data);

      toast.success("Payslip generated successfully");

      setIsOpen(false);

      if (onSuccess) {
        await onSuccess();
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to generate payslip"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
      bg-slate-900/50 backdrop-blur-sm
      p-4 sm:p-6"
      onClick={() => !loading && setIsOpen(false)}
    >
      <div
        className="w-full max-w-lg
        bg-white rounded-2xl
        border border-slate-200
        shadow-2xl
        overflow-hidden
        max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-emerald-700">
              <FileText className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                Generate Payslip
              </h3>

              <p className="text-xs text-slate-500 mt-0.5">
                Create a monthly employee payslip
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !loading && setIsOpen(false)}
            disabled={loading}
            className="p-2 rounded-lg
            text-slate-400
            hover:text-slate-700
            hover:bg-slate-100
            transition-all
            disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* EMPLOYEE */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Employee
            </label>

            <select
              name="employeeId"
              required
              defaultValue=""
              className="w-full px-4 py-2.5
              rounded-xl
              border border-slate-200
              bg-slate-50
              text-slate-700 text-sm
              focus:outline-none
              focus:ring-2 focus:ring-emerald-600/20
              focus:border-indigo-400
              transition"
            >
              <option value="" disabled>
                Select employee
              </option>

              {employees.map((employee) => (
                <option value={employee.id} key={employee.id}>
                  {employee.firstName} {employee.lastName} (
                  {employee.position})
                </option>
              ))}
            </select>
          </div>

          {/* MONTH + YEAR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Month
              </label>

              <select
                name="month"
                defaultValue={new Date().getMonth() + 1}
                required
                className="w-full px-4 py-2.5
                rounded-xl
                border border-slate-200
                bg-slate-50
                text-slate-700 text-sm
                focus:outline-none
                focus:ring-2 focus:ring-emerald-600/20
                focus:border-indigo-400
                transition"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option value={month} key={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Year
              </label>

              <input
                type="number"
                name="year"
                defaultValue={new Date().getFullYear()}
                required
                min="2000"
                max="2100"
                className="w-full px-4 py-2.5
                rounded-xl
                border border-slate-200
                bg-slate-50
                text-slate-700 text-sm
                focus:outline-none
                focus:ring-2 focus:ring-emerald-600/20
                focus:border-indigo-400
                transition"
              />
            </div>
          </div>

          {/* BASIC SALARY */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Basic Salary
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                $
              </span>

              <input
                type="number"
                name="basicSalary"
                placeholder="50000"
                required
                min="0"
                step="0.01"
                className="w-full pl-8 pr-4 py-2.5
                rounded-xl
                border border-slate-200
                bg-slate-50
                text-slate-700 text-sm
                focus:outline-none
                focus:ring-2 focus:ring-emerald-600/20
                focus:border-indigo-400
                transition"
              />
            </div>
          </div>

          {/* ALLOWANCES + DEDUCTIONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Allowances
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  $
                </span>

                <input
                  type="number"
                  name="allowances"
                  defaultValue="0"
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2.5
                  rounded-xl
                  border border-slate-200
                  bg-slate-50
                  text-slate-700 text-sm
                  focus:outline-none
                  focus:ring-2 focus:ring-emerald-600/20
                  focus:border-indigo-400
                  transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Deductions
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  $
                </span>

                <input
                  type="number"
                  name="deductions"
                  defaultValue="0"
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2.5
                  rounded-xl
                  border border-slate-200
                  bg-slate-50
                  text-slate-700 text-sm
                  focus:outline-none
                  focus:ring-2 focus:ring-emerald-600/20
                  focus:border-indigo-400
                  transition"
                />
              </div>
            </div>
          </div>

          {/* PREVIEW */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
            <p className="text-xs text-emerald-700 font-medium">
              Payslip calculation
            </p>

            <p className="text-sm text-slate-600 mt-1">
              Net Salary = Basic Salary + Allowances − Deductions
            </p>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="px-4 py-2.5
              text-sm font-medium
              text-slate-600
              bg-slate-100
              hover:bg-slate-200
              rounded-xl
              transition-all
              disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2
              min-w-[125px]
              px-5 py-2.5
              text-sm font-medium
              text-white
              bg-gradient-to-r from-emerald-700 to-purple-600
              hover:from-indigo-600 hover:to-purple-700
              rounded-xl
              shadow-md
              hover:shadow-lg
              active:scale-95
              transition-all
              disabled:opacity-50
              disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GeneratePayslipForm;