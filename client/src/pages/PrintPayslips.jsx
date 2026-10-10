import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import api from "../api/axios";

const PrintPayslips = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/payslips/${id}`).then((res)=>setPayslip(res.data)).catch(console.error).finally(()=>{setLoading(false)})
  }, [id]);

  if (loading) return <Loading />;

  if (!payslip)
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        Payslip not found
      </p>
    );

  return (
    <div className="mx-auto max-w-2xl bg-white px-6 py-8 text-center">
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 print:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        
      </div>

      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-xl font-medium tracking-tight text-slate-900">
          PAYSLIP
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {format(new Date(payslip.year, payslip.month - 1), "MMMM yyyy")}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-5 border-b border-slate-200 py-6">
        <div className="text-left">
          <p className="text-xs text-slate-400">Employee Name</p>
          <p className="mt-1 text-sm font-normal text-slate-700">
            {payslip.employee?.firstName} {payslip.employee?.lastName}
          </p>
        </div>

        <div className="text-left">
          <p className="text-xs text-slate-400">Employee Position</p>
          <p className="mt-1 text-sm font-normal text-slate-700">
            {payslip.employee?.position}
          </p>
        </div>

        <div className="text-left">
          <p className="text-xs text-slate-400">Email</p>
          <p className="mt-1 truncate text-sm font-normal text-slate-700">
            {payslip.employee?.email}
          </p>
        </div>

        <div className="text-left">
          <p className="text-xs text-slate-400">Period</p>
          <p className="mt-1 text-sm font-normal text-slate-700">
            {format(new Date(payslip.year, payslip.month - 1), "MMMM yyyy")}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-3.5 text-left font-normal text-slate-500">
                Description
              </th>
              <th className="px-5 py-3.5 text-right font-normal text-slate-500">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-5 py-4 text-left font-normal text-slate-600">
                Basic Salary
              </td>
              <td className="px-5 py-4 text-right font-normal text-slate-700">
                ${payslip.basicSalary?.toLocaleString()}
              </td>
            </tr>

            <tr className="border-b border-slate-100">
              <td className="px-5 py-4 text-left font-normal text-slate-600">
                Allowances
              </td>
              <td className="px-5 py-4 text-right font-normal text-emerald-600">
                +${payslip.allowances?.toLocaleString()}
              </td>
            </tr>

            <tr className="border-b border-slate-100">
              <td className="px-5 py-4 text-left font-normal text-slate-600">
                Deductions
              </td>
              <td className="px-5 py-4 text-right font-normal text-rose-500">
                -${payslip.deductions?.toLocaleString()}
              </td>
            </tr>

            <tr className="bg-slate-50">
              <td className="px-5 py-4 text-left font-medium text-slate-800">
                Net Salary
              </td>
              <td className="px-5 py-4 text-right font-medium text-slate-900">
                ${payslip.netSalary?.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-center">
        <button
          className="btn-primary print:hidden rounded-lg px-5 py-2.5 text-sm font-normal transition hover:opacity-90"
          onClick={() => window.print()}
        >
          Print Payslip
        </button>
      </div>
    </div>
  );
};

export default PrintPayslips;

