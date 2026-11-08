
import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCheck,
  Users,
  Plus,
  Settings,
  RotateCcw,
  Loader2Icon,
} from "lucide-react";
import Loading from "../components/Loading";
import PayslipsList from "../components/payslips/PayslipsList";
import GeneratePayslipForm from "../components/payslips/GeneratePayslipForm";
import BulkGenerateModal from "../components/payslips/BulkGenerateModal";
import PayrollSettingsModal from "../components/payslips/PayrollSettingsModal";
import ModalShell, {
  inputClass,
  labelClass,
  primaryBtn,
  secondaryBtn,
} from "../components/payslips/ModalShell";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import { MONTHS, errorText, money, periodLabel } from "../utils/format";

const smallLabel = "block text-xs font-medium text-slate-600 mb-1";

const Summary = ({ label, value, hint }) => (
  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 break-words text-xl font-semibold text-slate-800">
      {value}
    </p>
    {hint && (
      <p className="mt-0.5 break-words text-xs text-slate-400">{hint}</p>
    )}
  </div>
);

const Payslips = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [payslips, setPayslips] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    month: "",
    year: "",
    status: "",
  });
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reopenTarget, setReopenTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchPayslips = useCallback(async () => {
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== "")
      );

      const res = await api.get("/payslips", { params });

      setPayslips(res.data.data || []);
      setSummary(res.data.summary || null);
    } catch (error) {
      toast.error(errorText(error, "Failed to load payslips"));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(fetchPayslips, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPayslips, filters.search]);

  useEffect(() => {
    if (!isAdmin) return;

    api
      .get("/employees")
      .then((res) =>
        setEmployees(
          (res.data || []).filter(
            (e) =>
              !e.isDeleted && e.employmentStatus !== "INACTIVE"
          )
        )
      )
      .catch((error) =>
        toast.error(errorText(error, "Failed to load employees"))
      );
  }, [isAdmin]);

  const act = async (p, request, success) => {
    const id = p._id || p.id;
    setBusyId(id);

    try {
      await request(id);
      toast.success(success);
      await fetchPayslips();
    } catch (error) {
      toast.error(errorText(error, "Action failed"));
    } finally {
      setBusyId(null);
    }
  };

  const finalize = (p) =>
    act(
      p,
      (id) => api.post(`/payslips/${id}/finalize`),
      "Payslip finalized and employee notified"
    );

  const remove = (p) => {
    if (
      window.confirm(
        `Delete the draft payslip for ${
          p.employee?.firstName || "this employee"
        } (${periodLabel(p.month, p.year)})?`
      )
    ) {
      act(p, (id) => api.delete(`/payslips/${id}`), "Draft deleted");
    }
  };

  const submitReopen = async (e) => {
    e.preventDefault();

    await act(
      reopenTarget,
      (id) => api.post(`/payslips/${id}/reopen`, { reason }),
      "Payslip reopened as a draft"
    );

    setModal(null);
    setReopenTarget(null);
    setReason("");
  };

  const monthFilterActive =
    filters.month !== "" && filters.year !== "";

  const draftsInView = payslips.filter(
    (p) => p.status === "draft"
  ).length;

  const finalizeAll = async () => {
    if (
      !window.confirm(
        `Finalize ${draftsInView} draft payslip(s) for ${periodLabel(
          filters.month,
          filters.year
        )} and notify employees?`
      )
    )
      return;

    setBulkBusy(true);

    try {
      const { data } = await api.post("/payslips/bulk-finalize", {
        month: Number(filters.month),
        year: Number(filters.year),
      });

      toast.success(
        `${data.finalized} payslip(s) finalized${
          data.errors.length ? `, ${data.errors.length} failed` : ""
        }`
      );

      await fetchPayslips();
    } catch (error) {
      toast.error(errorText(error, "Bulk finalize failed"));
    } finally {
      setBulkBusy(false);
    }
  };

  if (loading) return <Loading />;

  const setFilter = (patch) =>
    setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="min-h-screen min-w-0 w-full space-y-5 overflow-x-hidden bg-slate-50 p-3 animate-fade-in sm:space-y-6 sm:p-6">
      {/* HEADER */}
      <div className="flex min-w-0 flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
            Payslips
          </h1>

          <p className="text-sm text-slate-500">
            {isAdmin
              ? "Generate, review and publish employee payslips"
              : "Access and download your payslips"}
          </p>
        </div>

        {isAdmin && (
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              onClick={() => setModal("settings")}
              className={`${secondaryBtn} inline-flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>

            <button
              onClick={() => setModal("bulk")}
              className={`${secondaryBtn} inline-flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto`}
            >
              <Users className="h-4 w-4" />
              Bulk generate
            </button>

            <button
              onClick={() => {
                setEditing(null);
                setModal("generate");
              }}
              className="group flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-95 sm:w-auto"
            >
              <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.5} />
              <span>Generate Payslip</span>
            </button>
          </div>
        )}
      </div>

      {/* SUMMARY */}
      {isAdmin && summary && (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <Summary
            label="Payslips in view"
            value={summary.total}
            hint={`${summary.finalized} finalized`}
          />

          <Summary
            label="Drafts awaiting review"
            value={summary.drafts}
            hint={
              summary.withWarnings
                ? `${summary.withWarnings} with warnings`
                : "Not visible to employees"
            }
          />

          <Summary
            label="Finalized gross"
            value={money(summary.finalizedGross)}
          />

          <Summary
            label="Finalized net payout"
            value={money(summary.finalizedNet)}
            hint={
              summary.drafts
                ? `+ ${money(summary.draftNet)} in drafts`
                : undefined
            }
          />
        </div>
      )}

      {/* FILTERS */}
      <div className="grid min-w-0 grid-cols-1 items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 sm:p-4 lg:grid-cols-5">
        {isAdmin && (
          <div className="min-w-0 sm:col-span-2 lg:col-span-2">
            <label className={smallLabel}>Search employee</label>
            <input
              className={inputClass}
              placeholder="Name or email"
              value={filters.search}
              onChange={(e) =>
                setFilter({ search: e.target.value })
              }
            />
          </div>
        )}

        <div className="min-w-0">
          <label className={smallLabel}>Month</label>
          <select
            className={inputClass}
            value={filters.month}
            onChange={(e) =>
              setFilter({ month: e.target.value })
            }
          >
            <option value="">All months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className={smallLabel}>Year</label>
          <input
            className={inputClass}
            type="number"
            placeholder="All"
            min="2000"
            max="2100"
            value={filters.year}
            onChange={(e) =>
              setFilter({ year: e.target.value })
            }
          />
        </div>

        {isAdmin && (
          <div className="min-w-0">
            <label className={smallLabel}>Status</label>
            <select
              className={inputClass}
              value={filters.status}
              onChange={(e) =>
                setFilter({ status: e.target.value })
              }
            >
              <option value="">All</option>
              <option value="draft">Drafts</option>
              <option value="finalized">Finalized</option>
            </select>
          </div>
        )}
      </div>

      {/* FINALIZE ALL */}
      {isAdmin && monthFilterActive && draftsInView > 0 && (
        <div className="flex min-w-0 flex-col items-start justify-between gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
          <p className="min-w-0 text-sm leading-6 text-slate-700">
            <b>{draftsInView}</b> draft payslip(s) for{" "}
            {periodLabel(filters.month, filters.year)} are ready.
            Review them, then publish to employees.
          </p>

          <button
            onClick={finalizeAll}
            disabled={bulkBusy}
            className={`${primaryBtn} flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto`}
          >
            {bulkBusy ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Finalize all drafts
          </button>
        </div>
      )}

      {/* PAYSLIP LIST */}
      <div className="min-w-0">
        <PayslipsList
          payslips={payslips}
          isAdmin={isAdmin}
          busyId={busyId}
          onEdit={(p) => {
            setEditing(p);
            setModal("generate");
          }}
          onFinalize={finalize}
          onDelete={remove}
          onReopen={(p) => {
            setReopenTarget(p);
            setReason("");
            setModal("reopen");
          }}
        />
      </div>

      {/* ADMIN MODALS */}
      {isAdmin && (
        <>
          <GeneratePayslipForm
            open={modal === "generate"}
            initial={editing}
            employees={employees}
            onClose={() => {
              setModal(null);
              setEditing(null);
            }}
            onSuccess={fetchPayslips}
          />

          <BulkGenerateModal
            open={modal === "bulk"}
            onClose={() => setModal(null)}
            onSuccess={({ month, year }) => {
              setFilters((f) => ({
                ...f,
                month: String(month),
                year: String(year),
                status: "draft",
              }));
            }}
          />

          <PayrollSettingsModal
            open={modal === "settings"}
            onClose={() => setModal(null)}
          />

          {modal === "reopen" && reopenTarget && (
            <ModalShell
              title="Reopen Payslip"
              subtitle={`${periodLabel(
                reopenTarget.month,
                reopenTarget.year
              )} · it becomes a draft and disappears from the employee until finalized again`}
              icon={RotateCcw}
              onClose={() => setModal(null)}
            >
              <form
                onSubmit={submitReopen}
                className="space-y-5 p-4 sm:p-6"
              >
                <div className="min-w-0">
                  <label className={labelClass}>
                    Reason (recorded in the audit history)
                  </label>

                  <input
                    className={inputClass}
                    required
                    minLength={3}
                    maxLength={500}
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:pt-2">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className={`${secondaryBtn} min-h-11 w-full sm:w-auto`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={`${primaryBtn} min-h-11 w-full sm:w-auto`}
                  >
                    Reopen as draft
                  </button>
                </div>
              </form>
            </ModalShell>
          )}
        </>
      )}
    </div>
  );
};

export default Payslips;
