import React from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";

const PayslipsList = ({ payslips, isAdmin }) => {
  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          {/* Header */}
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              {isAdmin && <th className="px-6 py-3 font-semibold">Employee</th>}
              <th className="px-6 py-3 font-semibold">Period</th>
              <th className="px-6 py-3 font-semibold">Basic Salary</th>
              <th className="px-6 py-3 font-semibold">Net Salary</th>
              <th className="px-6 py-3 text-center font-semibold">Action</th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100">
            {payslips.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 5 : 4}
                  className="text-center py-12 text-slate-400 text-sm"
                >
                  No Payslips found
                </td>
              </tr>
            ) : (
              payslips.map((i) => (
                <tr
                  key={i._id || i.id}
                  className="hover:bg-slate-50 transition duration-200"
                >
                  {isAdmin && (
                    <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">
                      {i.employee?.firstName + " " || "-"}
                      {i.employee?.lastName || "-"}
                    </td>
                  )}

                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                    {format(new Date(i.year, i.month - 1), "MMMM yyyy")}
                  </td>

                  <td className="px-6 py-4 text-slate-500 font-medium">
                    ${i.basicSalary?.toLocaleString()}
                  </td>

                  <td className="px-6 py-4 text-slate-800 font-semibold">
                    ${i.netSalary?.toLocaleString()}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition duration-200"
                      onClick={() =>
                        (window.location.href = `/print/payslips/${i._id || i.id}`)
                      }
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    
    </div>
  );
};

export default PayslipsList;
