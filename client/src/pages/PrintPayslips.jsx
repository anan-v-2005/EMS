
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import { ArrowLeft, FileText } from "lucide-react";
import api from "../api/axios";
import {
  amountInWords,
  deductionRows,
  earningRows,
  formatDate,
  money,
  periodLabel,
} from "../utils/format";

const Info = ({ label, value }) => (
  <div className="min-w-0 text-left">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="mt-1 break-words text-sm font-normal text-slate-700">
      {value || "—"}
    </p>
  </div>
);

const Table = ({ title, rows, totalLabel, total, negative }) => (
  <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-3 py-3 text-left font-normal text-slate-500 sm:px-4">
            {title}
          </th>
          <th className="px-3 py-3 text-right font-normal text-slate-500 sm:px-4">
            Amount
          </th>
        </tr>
      </thead>

      <tbody>
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={2}
              className="px-3 py-3 text-left text-slate-400 sm:px-4"
            >
              None
            </td>
          </tr>
        )}

        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-slate-100">
            <td className="break-words px-3 py-2.5 text-left text-slate-600 sm:px-4">
              {label}
            </td>
            <td
              className={`whitespace-nowrap px-3 py-2.5 text-right sm:px-4 ${
                negative ? "text-rose-500" : "text-slate-700"
              }`}
            >
              {negative ? "−" : ""}
              {money(value)}
            </td>
          </tr>
        ))}

        <tr className="bg-slate-50">
          <td className="px-3 py-3 text-left font-medium text-slate-800 sm:px-4">
            {totalLabel}
          </td>
          <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-slate-900 sm:px-4">
            {money(total)}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

const PrintPayslips = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api
      .get(`/payslips/${id}`)
      .then((res) => active && setPayslip(res.data))
      .catch(console.error)
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <Loading />;

  if (!payslip) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        Payslip not found
      </p>
    );
  }

  const employee = payslip.employee || {};
  const draft = payslip.status === "draft";
  const detailed = Boolean(payslip.breakdown?.earnings);

  const earnings = detailed
    ? earningRows(payslip.breakdown.earnings)
    : [
        ["Basic salary", payslip.basicSalary],
        ["Allowances", payslip.allowances],
      ];

  const deductions = detailed
    ? deductionRows(payslip.breakdown.deductions)
    : Number(payslip.deductions) > 0
      ? [["Deductions", payslip.deductions]]
      : [];

  const totalEarnings = detailed
    ? payslip.breakdown.earnings.total
    : (payslip.basicSalary || 0) + (payslip.allowances || 0);

  const a = payslip.attendance;
  const employer = payslip.breakdown?.employer;

  return (
    <div className="mx-auto min-w-0 w-full max-w-3xl bg-white px-4 py-5 sm:px-6 sm:py-8 print:px-0 print:py-0">
      {/* ACTION BUTTONS */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-normal transition hover:opacity-90 sm:w-auto"
          onClick={() => window.print()}
        >
          <FileText className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* DRAFT NOTICE */}
      {draft && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800">
          DRAFT — not yet published to the employee
        </div>
      )}

      {/* COMPANY HEADER */}
      <div className="border-b border-slate-200 pb-5 text-center">
        {payslip.company?.name && (
          <p className="break-words text-xs font-semibold uppercase tracking-[.2em] text-emerald-700">
            {payslip.company.name}
          </p>
        )}

        {payslip.company?.address && (
          <p className="mt-1 break-words text-xs text-slate-400">
            {payslip.company.address}
          </p>
        )}

        <h1 className="mt-3 text-xl font-medium tracking-tight text-slate-900">
          PAYSLIP
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {periodLabel(payslip.month, payslip.year)}
        </p>
      </div>

      {/* EMPLOYEE DETAILS */}
      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-5 border-b border-slate-200 py-6 sm:grid-cols-3 sm:gap-x-8">
        <Info
          label="Employee name"
          value={`${employee.firstName || ""} ${employee.lastName || ""}`.trim()}
        />

        <Info
          label="Employee ID"
          value={
            employee._id
              ? `EMP-${String(employee._id).slice(-6).toUpperCase()}`
              : ""
          }
        />

        <Info label="Payslip no." value={payslip.payslipNumber} />

        <Info label="Position" value={employee.position} />

        <Info label="Department" value={employee.department} />

        <Info
          label="Date of joining"
          value={employee.joinDate ? formatDate(employee.joinDate) : ""}
        />

        <Info label="Email" value={employee.email} />

        <Info
          label="Pay period"
          value={periodLabel(payslip.month, payslip.year)}
        />

        <Info
          label="Issued on"
          value={
            payslip.finalizedAt
              ? formatDate(payslip.finalizedAt)
              : draft
                ? "Draft"
                : formatDate(payslip.createdAt)
          }
        />
      </div>

      {/* ATTENDANCE SUMMARY */}
      {a && payslip.mode === "AUTO" && (
        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 py-5 text-left sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {[
            ["Days in month", a.calendarDays],
            ["Working days", a.workingDays],
            ["Present", a.present],
            ["Paid leave", a.paidLeaves],
            ["LOP days", a.unpaidDays ?? a.lopDays],
            ["Overtime hrs", a.overtimeHours],
          ].map(([l, v]) => (
            <div key={l} className="min-w-0">
              <p className="text-[11px] text-slate-400">{l}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-700">
                {v ?? 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* EARNINGS AND DEDUCTIONS */}
      <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
        <Table
          title="Earnings"
          rows={earnings}
          totalLabel="Total earnings"
          total={totalEarnings}
        />

        <Table
          title="Deductions"
          rows={deductions}
          totalLabel="Total deductions"
          total={payslip.deductions}
          negative
        />
      </div>

      {/* NET SALARY */}
      <div className="mt-5 flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Net salary</p>

          <p className="mt-1 max-w-sm break-words text-xs text-slate-500">
            {amountInWords(payslip.netSalary)}
          </p>
        </div>

        <p className="break-words text-xl font-semibold text-slate-900 sm:shrink-0">
          {money(payslip.netSalary)}
        </p>
      </div>

      {/* EMPLOYER CONTRIBUTIONS */}
      {(employer?.pf > 0 || employer?.esi > 0) && (
        <p className="mt-3 break-words text-left text-xs text-slate-400">
          Employer contributions (not deducted from salary):{" "}
          {employer.pf > 0 && `PF ${money(employer.pf)}`}
          {employer.pf > 0 && employer.esi > 0 && " · "}
          {employer.esi > 0 && `ESI ${money(employer.esi)}`}
        </p>
      )}

      {/* FOOTER */}
      <p className="mt-8 text-center text-[11px] text-slate-400">
        This is a computer-generated payslip and does not require a signature.
      </p>
    </div>
  );
};

export default PrintPayslips;
