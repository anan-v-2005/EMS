
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { money, periodLabel } from "../../utils/format";

const actionBtn =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

const PayslipsList = ({
  payslips,
  isAdmin,
  busyId,
  onEdit,
  onFinalize,
  onReopen,
  onDelete,
}) => {
  const navigate = useNavigate();
  const columns = isAdmin ? 7 : 5;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {isAdmin && (
                <th className="px-6 py-3 font-semibold">
                  Employee
                </th>
              )}

              <th className="px-6 py-3 font-semibold">
                Period
              </th>

              <th className="px-6 py-3 font-semibold">
                {isAdmin ? "Gross earnings" : "Basic Salary"}
              </th>

              <th className="px-6 py-3 font-semibold">
                Deductions
              </th>

              <th className="px-6 py-3 font-semibold">
                Net Salary
              </th>

              {isAdmin && (
                <th className="px-6 py-3 font-semibold">
                  Status
                </th>
              )}

              <th className="px-6 py-3 text-center font-semibold">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {payslips.length === 0 ? (
              <tr>
                <td
                  colSpan={columns}
                  className="py-12 text-center text-sm text-slate-400"
                >
                  No Payslips found
                </td>
              </tr>
            ) : (
              payslips.map((p) => {
                const id = p._id || p.id;
                const draft = p.status === "draft";
                const busy = busyId === id;

                const name =
                  [
                    p.employee?.firstName,
                    p.employee?.lastName,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Deleted employee";

                const gross =
                  p.breakdown?.earnings?.total ??
                  (p.basicSalary || 0) + (p.allowances || 0);

                return (
                  <tr
                    key={id}
                    className="transition duration-200 hover:bg-slate-50"
                  >
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-700">
                        {name}

                        {p.employee?.isDeleted && (
                          <span className="ml-2 text-[11px] text-slate-400">
                            (archived)
                          </span>
                        )}

                        {p.payslipNumber && (
                          <div className="text-[11px] font-normal text-slate-400">
                            {p.payslipNumber}
                          </div>
                        )}
                      </td>
                    )}

                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                      {periodLabel(p.month, p.year)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-500">
                      {money(isAdmin ? gross : p.basicSalary)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                      {money(p.deductions)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-800">
                      {money(p.netSalary)}
                    </td>

                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`badge ${
                            draft ? "badge-warning" : "badge-success"
                          }`}
                        >
                          {draft ? "Draft" : "Finalized"}
                        </span>

                        {draft && p.warnings?.length > 0 && (
                          <span
                            title={p.warnings.join("\n")}
                            className="ml-2 inline-flex align-middle text-amber-500"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                        )}
                      </td>
                    )}

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          className={`${actionBtn} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`}
                          onClick={() =>
                            navigate(`/print/payslips/${id}`)
                          }
                        >
                          <Download className="h-4 w-4" />
                          {isAdmin ? "View" : "Download"}
                        </button>

                        {isAdmin && draft && (
                          <>
                            <button
                              disabled={busy}
                              className={`${actionBtn} text-slate-600 bg-slate-100 hover:bg-slate-200`}
                              onClick={() => onEdit(p)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>

                            <button
                              disabled={busy}
                              className={`${actionBtn} text-white bg-emerald-700 hover:bg-emerald-800`}
                              onClick={() => onFinalize(p)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Finalize
                            </button>

                            <button
                              disabled={busy}
                              aria-label="Delete draft"
                              className={`${actionBtn} text-rose-600 bg-rose-50 hover:bg-rose-100`}
                              onClick={() => onDelete(p)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {isAdmin && !draft && (
                          <button
                            disabled={busy}
                            className={`${actionBtn} text-slate-600 bg-slate-100 hover:bg-slate-200`}
                            onClick={() => onReopen(p)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="px-3 py-2 text-center text-xs text-slate-400 sm:hidden">
        Scroll horizontally to view all payslip details
      </p>
    </div>
  );
};

export default PayslipsList;
