
import React, { useEffect, useState } from "react";
import { Loader2Icon, Settings, Trash2, Plus } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import ModalShell, {
  inputClass,
  primaryBtn,
  secondaryBtn,
} from "./ModalShell";
import { errorText } from "../../utils/format";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Check = ({ label, checked, onChange }) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
    <input
      type="checkbox"
      style={{ width: "auto", flexShrink: 0 }}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    {label}
  </label>
);

const Section = ({ title, hint, children }) => (
  <div className="space-y-3 rounded-2xl border border-slate-200 p-3 sm:p-4">
    <div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint && (
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
    {children}
  </div>
);

const Num = ({ label, value, onChange, step = "any" }) => (
  <div className="min-w-0">
    <label className="mb-1.5 block text-xs font-medium text-slate-600">
      {label}
    </label>
    <input
      className={inputClass}
      type="number"
      min="0"
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const PayrollSettingsModal = ({ open, onClose, onSaved }) => {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setS(null);

    api
      .get("/payslips/settings")
      .then(({ data }) => setS(data.data))
      .catch((e) => {
        toast.error(errorText(e, "Could not load settings"));
        onClose();
      });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const up = (path, value) =>
    setS((cur) => {
      const next = JSON.parse(JSON.stringify(cur));
      let node = next;
      const keys = path.split(".");

      keys.slice(0, -1).forEach((k) => {
        node = node[k];
      });

      node[keys.at(-1)] = value;
      return next;
    });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data } = await api.put("/payslips/settings", s);
      toast.success("Payroll settings saved");
      onSaved?.(data.data);
      onClose();
    } catch (error) {
      toast.error(errorText(error, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Payroll Settings"
      subtitle="Applies to payslips generated from now on; existing payslips are never changed"
      icon={Settings}
      onClose={onClose}
      busy={saving}
      wide
    >
      {!s ? (
        <div className="p-10 text-center text-sm text-slate-400">
          Loading…
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4 p-4 sm:p-6">
          <Section title="Company (printed on payslips)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Company name
                </label>
                <input
                  className={inputClass}
                  maxLength={160}
                  value={s.companyName}
                  onChange={(e) => up("companyName", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Address
                </label>
                <input
                  className={inputClass}
                  maxLength={400}
                  value={s.companyAddress}
                  onChange={(e) => up("companyAddress", e.target.value)}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Working week & pay days"
            hint="Weekly offs apply to attendance, leave counting and payroll alike."
          >
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {DAYS.map((d, i) => (
                <Check
                  key={d}
                  label={d}
                  checked={s.weeklyOffDays.includes(i)}
                  onChange={(on) =>
                    up(
                      "weeklyOffDays",
                      on
                        ? [...s.weeklyOffDays, i].sort()
                        : s.weeklyOffDays.filter((x) => x !== i),
                    )
                  }
                />
              ))}

              <span className="self-center text-xs text-slate-400">
                ← days off
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Per-day pay is gross ÷
                </label>
                <select
                  className={inputClass}
                  value={s.payDaysBasis}
                  onChange={(e) => up("payDaysBasis", e.target.value)}
                >
                  <option value="CALENDAR">Calendar days in the month</option>
                  <option value="WORKING">Working days in the month</option>
                </select>
              </div>

              <Num
                label="Standard hours per day"
                value={s.standardDayHours}
                onChange={(v) => up("standardDayHours", v)}
              />
            </div>
          </Section>

          <Section title="Overtime & late marks">
            <Check
              label="Pay overtime"
              checked={s.overtime.enabled}
              onChange={(v) => up("overtime.enabled", v)}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Num
                label="Overtime after (hours/day)"
                value={s.overtime.afterHours}
                onChange={(v) => up("overtime.afterHours", v)}
              />

              <Num
                label="Rate multiplier"
                value={s.overtime.multiplier}
                step="0.25"
                onChange={(v) => up("overtime.multiplier", v)}
              />

              <Num
                label="Late marks per half-day cut (0 = off)"
                value={s.lateMarks.perHalfDay}
                step="1"
                onChange={(v) => up("lateMarks.perHalfDay", v)}
              />
            </div>
          </Section>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Statutory deductions are off by default. Rates, ceilings and slabs
            depend on your state and establishment; verify them with your
            accountant before enabling.
          </div>

          <Section title="Provident fund (PF)">
            <Check
              label="Deduct PF automatically"
              checked={s.pf.enabled}
              onChange={(v) => up("pf.enabled", v)}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Num
                label="Employee rate %"
                value={s.pf.employeeRate}
                onChange={(v) => up("pf.employeeRate", v)}
              />

              <Num
                label="Employer rate % (info)"
                value={s.pf.employerRate}
                onChange={(v) => up("pf.employerRate", v)}
              />

              <Num
                label="Wage ceiling ₹ (0 = none)"
                value={s.pf.wageCeiling}
                onChange={(v) => up("pf.wageCeiling", v)}
              />
            </div>
          </Section>

          <Section title="Employee State Insurance (ESI)">
            <Check
              label="Deduct ESI automatically"
              checked={s.esi.enabled}
              onChange={(v) => up("esi.enabled", v)}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Num
                label="Employee rate %"
                value={s.esi.employeeRate}
                onChange={(v) => up("esi.employeeRate", v)}
              />

              <Num
                label="Employer rate % (info)"
                value={s.esi.employerRate}
                onChange={(v) => up("esi.employerRate", v)}
              />

              <Num
                label="Applies if gross ≤ ₹ (0 = all)"
                value={s.esi.grossCeiling}
                onChange={(v) => up("esi.grossCeiling", v)}
              />
            </div>
          </Section>

          <Section
            title="Professional tax"
            hint="Based on the month's earnings after loss of pay. Leave “to” empty for no upper limit."
          >
            <Check
              label="Deduct professional tax automatically"
              checked={s.professionalTax.enabled}
              onChange={(v) => up("professionalTax.enabled", v)}
            />

            {s.professionalTax.slabs.map((slab, i) => (
              <div
                key={i}
                className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <Num
                  label={i === 0 ? "From ₹" : ""}
                  value={slab.from}
                  onChange={(v) =>
                    up(`professionalTax.slabs.${i}.from`, v)
                  }
                />

                <Num
                  label={i === 0 ? "To ₹" : ""}
                  value={slab.to ?? ""}
                  onChange={(v) =>
                    up(
                      `professionalTax.slabs.${i}.to`,
                      v === "" ? null : v,
                    )
                  }
                />

                <Num
                  label={i === 0 ? "Tax ₹" : ""}
                  value={slab.amount}
                  onChange={(v) =>
                    up(`professionalTax.slabs.${i}.amount`, v)
                  }
                />

                <button
                  type="button"
                  aria-label="Remove slab"
                  className="flex h-10 w-10 items-center justify-center rounded-lg p-2.5 text-slate-400 hover:text-rose-500"
                  onClick={() =>
                    up(
                      "professionalTax.slabs",
                      s.professionalTax.slabs.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
              onClick={() =>
                up("professionalTax.slabs", [
                  ...s.professionalTax.slabs,
                  { from: "", to: null, amount: "" },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add slab
            </button>
          </Section>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end sm:gap-3 sm:pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`${secondaryBtn} w-full justify-center sm:w-auto`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className={`${primaryBtn} min-h-10 w-full justify-center sm:w-auto sm:min-w-[120px]`}
            >
              {saving ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save settings"
              )}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
};

export default PayrollSettingsModal;
