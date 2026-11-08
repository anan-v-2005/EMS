
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2Icon, Plus, Trash2 } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import ModalShell, {
  inputClass,
  labelClass,
  primaryBtn,
  secondaryBtn,
} from "./ModalShell";
import PayslipBreakdown from "./PayslipBreakdown";
import { MONTHS, errorText, isMonthOver } from "../../utils/format";

const now = new Date();

const blank = () => ({
  employeeId: "",
  month: now.getMonth() === 0 ? 12 : now.getMonth(),
  year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
  mode: "AUTO",
  basicSalary: "",
  allowances: "0",
  deductions: "0",
  bonus: "0",
  tds: "0",
  professionalTax: "",
  overtimeRate: "0",
  otherEarnings: [],
  otherDeductions: [],
  note: "",
  allowEarly: false,
  finalizeNow: false,
});

const fromPayslip = (p) => ({
  ...blank(),
  employeeId: p.employeeId,
  month: p.month,
  year: p.year,
  mode: p.mode === "AUTO" ? "AUTO" : "MANUAL",
  basicSalary: String(p.basicSalary ?? ""),
  allowances: String(p.allowances ?? 0),
  deductions: String(p.deductions ?? 0),
  bonus: String(p.adjustments?.bonus ?? 0),
  tds: String(p.adjustments?.tds ?? 0),
  professionalTax:
    p.adjustments?.professionalTax == null
      ? ""
      : String(p.adjustments.professionalTax),
  overtimeRate: String(p.adjustments?.overtimeRate ?? 0),
  otherEarnings: (p.adjustments?.otherEarnings || []).map((i) => ({
    label: i.label,
    amount: String(i.amount),
  })),
  otherDeductions: (p.adjustments?.otherDeductions || []).map((i) => ({
    label: i.label,
    amount: String(i.amount),
  })),
  note: p.adjustments?.note || "",
  allowEarly: !isMonthOver(p.month, p.year),
});

const num = (v) => (v === "" || v == null ? 0 : Number(v));

const ItemsEditor = ({ title, items, onChange, placeholder }) => (
  <div className="min-w-0">
    <div className="mb-2 flex items-center justify-between gap-2">
      <label className="text-sm font-medium text-slate-700">{title}</label>
      <button
        type="button"
        onClick={() => onChange([...items, { label: "", amount: "" }])}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>

    {items.map((item, i) => (
      <div
        key={i}
        className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(90px,112px)_36px] items-center gap-2 sm:flex"
      >
        <input
          className={`${inputClass} min-w-0`}
          placeholder={placeholder}
          value={item.label}
          maxLength={80}
          onChange={(e) =>
            onChange(
              items.map((x, j) =>
                j === i ? { ...x, label: e.target.value } : x,
              ),
            )
          }
        />

        <input
          className={`${inputClass} w-full min-w-0 sm:w-32!`}
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={item.amount}
          onChange={(e) =>
            onChange(
              items.map((x, j) =>
                j === i ? { ...x, amount: e.target.value } : x,
              ),
            )
          }
        />

        <button
          type="button"
          aria-label="Remove"
          onClick={() => onChange(items.filter((_, j) => j !== i))}
          className="flex h-9 w-9 items-center justify-center rounded-lg p-2 text-slate-400 hover:text-rose-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ))}
  </div>
);

const GeneratePayslipForm = ({
  open,
  onClose,
  employees,
  onSuccess,
  initial = null,
}) => {
  const editing = Boolean(initial);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (open) {
      setForm(initial ? fromPayslip(initial) : blank());
      setPreview(null);
      setPreviewError("");
    }
  }, [open, initial]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const monthOver = isMonthOver(form.month, form.year);

  const payload = useMemo(
    () => ({
      employeeId: form.employeeId,
      month: Number(form.month),
      year: Number(form.year),
      mode: form.mode,
      allowEarly: form.allowEarly,
      adjustments: {
        bonus: num(form.bonus),
        tds: num(form.tds),
        overtimeRate: num(form.overtimeRate),
        professionalTax:
          form.professionalTax === "" ? null : num(form.professionalTax),
        otherEarnings: form.otherEarnings.map((i) => ({
          label: i.label,
          amount: num(i.amount),
        })),
        otherDeductions: form.otherDeductions.map((i) => ({
          label: i.label,
          amount: num(i.amount),
        })),
        note: form.note,
      },
      ...(form.mode === "MANUAL"
        ? {
            basicSalary: num(form.basicSalary),
            allowances: num(form.allowances),
            deductions: num(form.deductions),
          }
        : {}),
    }),
    [form],
  );

  // Live calculation (debounced). Stale responses are ignored.
  useEffect(() => {
    if (
      !open ||
      !form.employeeId ||
      !form.year ||
      (form.mode === "MANUAL" && form.basicSalary === "")
    ) {
      setPreview(null);
      return undefined;
    }

    const id = ++requestId.current;
    setPreviewing(true);

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post("/payslips/preview", payload);
        if (id !== requestId.current) return;
        setPreview(data);
        setPreviewError("");
      } catch (error) {
        if (id !== requestId.current) return;
        setPreview(null);
        setPreviewError(errorText(error, "Could not calculate this payslip"));
      } finally {
        if (id === requestId.current) setPreviewing(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [open, payload, form.employeeId, form.year, form.mode, form.basicSalary]);

  if (!open) return null;

  const blocked = !editing && preview?.existing?.status === "finalized";
  const needsEarly = !monthOver && form.mode === "AUTO" && !form.allowEarly;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post("/payslips", {
        ...payload,
        finalizeNow: form.finalizeNow,
      });

      toast.success(
        form.finalizeNow
          ? "Payslip finalized and employee notified"
          : data.action === "updated"
            ? "Draft payslip updated"
            : "Draft payslip created",
      );

      onClose();
      await onSuccess?.();
    } catch (error) {
      toast.error(errorText(error, "Failed to generate payslip"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={editing ? "Edit Payslip Draft" : "Generate Payslip"}
      subtitle="Salary, leave, holidays and attendance are calculated automatically"
      icon={FileText}
      onClose={onClose}
      busy={loading}
      wide
    >
      <form onSubmit={submit} className="space-y-5 p-4 sm:p-6">
        <div className="min-w-0">
          <label className={labelClass}>Employee</label>
          <select
            className={inputClass}
            required
            value={form.employeeId}
            disabled={editing}
            onChange={(e) => set({ employeeId: e.target.value })}
          >
            <option value="" disabled>
              Select employee
            </option>
            {employees.map((emp) => (
              <option value={emp.id} key={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.position})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div>
            <label className={labelClass}>Month</label>
            <select
              className={inputClass}
              required
              value={form.month}
              disabled={editing}
              onChange={(e) => set({ month: Number(e.target.value) })}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Year</label>
            <input
              className={inputClass}
              type="number"
              required
              min="2000"
              max="2100"
              value={form.year}
              disabled={editing}
              onChange={(e) => set({ year: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass}>Calculation</label>
            <select
              className={inputClass}
              value={form.mode}
              onChange={(e) => set({ mode: e.target.value })}
            >
              <option value="AUTO">From attendance</option>
              <option value="MANUAL">Enter manually</option>
            </select>
          </div>
        </div>

        {form.mode === "AUTO" && !monthOver && (
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-slate-600">
            <input
              type="checkbox"
              style={{ width: "auto", marginTop: 2, flexShrink: 0 }}
              checked={form.allowEarly}
              onChange={(e) => set({ allowEarly: e.target.checked })}
            />
            <span className="leading-5">
              This month has not ended. Generate early: completed days are
              counted and the remaining days are assumed paid. Regenerate after
              month end for the final figures.
            </span>
          </label>
        )}

        {form.mode === "MANUAL" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              ["basicSalary", "Basic salary", true],
              ["allowances", "Allowances", false],
              ["deductions", "Deductions", false],
            ].map(([key, label, req]) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₹
                  </span>
                  <input
                    className={`${inputClass} pl-8!`}
                    type="number"
                    min="0"
                    step="0.01"
                    required={req}
                    value={form[key]}
                    onChange={(e) => set({ [key]: e.target.value })}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500 sm:col-span-3 sm:-mt-2">
              Manual mode: Net = Basic + Allowances + Bonus − Deductions. No
              attendance, LOP or statutory deductions are applied.
            </p>
          </div>
        ) : (
          <p className="-mt-1 text-xs text-slate-500">
            Gross comes from the employee's salary structure. LOP, overtime,
            PF/ESI/professional tax follow your Payroll settings.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            ["bonus", "Bonus"],
            ["tds", "TDS"],
            ["professionalTax", "Prof. tax (blank = auto)"],
            ...(form.mode === "AUTO"
              ? [["overtimeRate", "OT rate / hr (0 = auto)"]]
              : []),
          ].map(([key, label]) => (
            <div key={key} className="min-w-0">
              <label className={`${labelClass} text-xs!`}>{label}</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={form[key]}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ItemsEditor
            title="Other earnings"
            placeholder="e.g. Travel reimbursement"
            items={form.otherEarnings}
            onChange={(v) => set({ otherEarnings: v })}
          />
          <ItemsEditor
            title="Other deductions"
            placeholder="e.g. Advance recovery"
            items={form.otherDeductions}
            onChange={(v) => set({ otherDeductions: v })}
          />
        </div>

        <div>
          <label className={labelClass}>
            Internal note (not shown to the employee)
          </label>
          <input
            className={inputClass}
            maxLength={500}
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </div>

        {/* PREVIEW */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">
              Calculation preview
            </p>
            {previewing && (
              <Loader2Icon className="h-4 w-4 shrink-0 animate-spin text-emerald-700" />
            )}
          </div>

          {blocked && (
            <p className="mb-3 text-xs text-rose-600">
              A finalized payslip already exists for this period. Reopen it from
              the list before generating again.
            </p>
          )}

          {preview?.existing?.status === "draft" && !editing && (
            <p className="mb-3 text-xs text-amber-700">
              A draft already exists for this period; saving will replace it.
            </p>
          )}

          {previewError && (
            <p className="text-xs text-rose-600">{previewError}</p>
          )}

          {!preview && !previewError && (
            <p className="text-xs text-slate-400">
              {form.employeeId
                ? "Calculating…"
                : "Choose an employee to see the calculated payslip."}
            </p>
          )}

          <PayslipBreakdown data={preview?.data} />
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            style={{ width: "auto", flexShrink: 0 }}
            checked={form.finalizeNow}
            onChange={(e) => set({ finalizeNow: e.target.checked })}
          />
          <span>Finalize immediately and notify the employee</span>
        </label>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`${secondaryBtn} w-full justify-center sm:w-auto`}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || blocked || needsEarly || !form.employeeId}
            className={`${primaryBtn} min-h-10 w-full justify-center sm:w-auto sm:min-w-[150px]`}
          >
            {loading ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />{" "}
                {form.finalizeNow ? "Generate & finalize" : "Save as draft"}
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export default GeneratePayslipForm;
