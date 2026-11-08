
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import {
  CalendarClock,
  DollarSign,
  Plus,
  RefreshCw,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";

import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const tabs = [
  {
    id: "attendance",
    label: "Attendance review",
    icon: CalendarClock,
    admin: true,
  },
  {
    id: "salary",
    label: "Salary structures",
    icon: DollarSign,
    admin: true,
  },
  {
    id: "balances",
    label: "Leave balances",
    icon: CalendarDays,
    admin: false,
  },
];

const money = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

const fmtDate = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
      })
    : "—";

const fmtDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

const inputClass =
  "w-full min-w-0 min-h-11 rounded-xl border border-[#DDE5DD] bg-white px-3 py-2.5 text-sm text-[#1F2A1F] outline-none transition focus:border-[#6B9B6E] focus:ring-2 focus:ring-[#6B9B6E]/15";

const labelClass = "mb-1.5 block text-xs font-semibold text-[#536354]";

const Field = ({ label, children }) => (
  <label className="block min-w-0">
    <span className={labelClass}>{label}</span>
    {children}
  </label>
);

const Card = ({ title, subtitle, children }) => (
  <section className="min-w-0 rounded-2xl border border-[#E3E8E1] bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-4">
      <h2 className="font-semibold text-[#1F2A1F]">{title}</h2>

      {subtitle && (
        <p className="mt-1 text-sm leading-6 text-[#718071]">
          {subtitle}
        </p>
      )}
    </div>

    {children}
  </section>
);

const Button = ({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
}) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
      variant === "secondary"
        ? "border border-[#DDE5DD] bg-white text-[#435443] hover:bg-[#F6F8F5]"
        : "bg-[#4A7C59] text-white hover:bg-[#3F6B4C]"
    }`}
  >
    {children}
  </button>
);

const Table = ({ headers, children }) => (
  <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-[#E5EAE3]">
    <table className="w-full min-w-[680px] text-left text-sm">
      <thead className="bg-[#F7F9F6] text-xs uppercase tracking-wide text-[#687768]">
        <tr>
          {headers.map((h) => (
            <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-[#EDF0EB]">{children}</tbody>
    </table>
  </div>
);

const Cell = ({ children }) => (
  <td className="px-4 py-3.5 align-middle text-[#435143]">
    {children ?? "—"}
  </td>
);

const Empty = ({ loading }) => (
  <div className="py-12 text-center text-sm text-[#7C897B]">
    {loading ? "Loading records…" : "No records to display yet."}
  </div>
);

export default function PeopleOperations() {
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const visibleTabs = useMemo(
    () => tabs.filter((t) => !t.admin || isAdmin),
    [isAdmin],
  );

  const [tab, setTab] = useState(isAdmin ? "attendance" : "balances");

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningCheckout, setRunningCheckout] = useState(false);

  const [salary, setSalary] = useState({
    employee: "",
    basic: 0,
    hra: 0,
    allowances: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    isActive: true,
  });

  const [employeeOptions, setEmployeeOptions] = useState([]);

  const [salaryHistoryOpen, setSalaryHistoryOpen] = useState({});

  const [auditRows, setAuditRows] = useState({});

  const [checkoutEdits, setCheckoutEdits] = useState({});

  // LATEST ACTIVE SALARY STRUCTURE PER ACTIVE EMPLOYEE

  const salaryRows = useMemo(() => {
    const grouped = new Map();

    data.forEach((row) => {
      const employee = row.employee;

      if (
        !employee?._id ||
        employee.employmentStatus !== "ACTIVE" ||
        row.isActive !== true
      ) {
        return;
      }

      const employeeId = String(employee._id);

      if (!grouped.has(employeeId)) {
        grouped.set(employeeId, []);
      }

      grouped.get(employeeId).push(row);
    });

    return Array.from(grouped.values())
      .map((records) => {
        records.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime() ||
            String(b._id).localeCompare(String(a._id)),
        );

        return records[0];
      })
      .sort((a, b) => {
        const nameA = `${a.employee.firstName || ""} ${a.employee.lastName || ""}`;
        const nameB = `${b.employee.firstName || ""} ${b.employee.lastName || ""}`;

        return nameA.localeCompare(nameB);
      });
  }, [data]);

  // ALL SALARY RECORDS FOR ONE EMPLOYEE

  const getSalaryHistory = useCallback(
    (employeeId) => {
      return data
        .filter((row) => String(row.employee?._id) === String(employeeId))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime() ||
            String(b._id).localeCompare(String(a._id)),
        );
    },
    [data],
  );

  // LOAD CURRENT TAB DATA

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const endpoint = {
        attendance: "/attendance?limit=100",
        salary: "/enterprise/salary-structures",
        balances: "/enterprise/leave-balances",
      }[tab];

      const { data: response } = await api.get(endpoint, {
        params: {
          _refresh: Date.now(),
        },
      });

      setData(response?.data || []);

      if (tab === "salary") {
        setSalaryHistoryOpen({});
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Unable to load this section",
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  // LOAD ACTIVE EMPLOYEES FOR SALARY DROPDOWN

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    api
      .get("/employees")
      .then(({ data: response }) => {
        const list = Array.isArray(response)
          ? response
          : response?.data || [];

        if (cancelled) return;

        setEmployeeOptions(
          list.filter(
            (employee) =>
              !employee.isDeleted &&
              employee.employmentStatus === "ACTIVE",
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setEmployeeOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // COMMON SAVE FUNCTION

  const submit = async (endpoint, payload, reset) => {
    try {
      await api.post(endpoint, payload);

      toast.success("Saved successfully");

      reset?.();

      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not save the record");
    }
  };

  // RUN AUTO CHECKOUT

  const runCheckout = async () => {
    if (runningCheckout) return;

    setRunningCheckout(true);

    try {
      const { data: response } = await api.post(
        "/enterprise/attendance/run-auto-checkout",
      );

      if (response.closed) {
        toast.success(
          response.message || `Closed ${response.closed} attendance record(s)`,
        );
      } else {
        toast(
          response.message ||
            "No eligible open attendance records were found. Auto-checkout only closes records after the configured shift end.",
        );
      }

      await load();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Auto-checkout failed. Check the server logs and try again.",
      );
    } finally {
      setRunningCheckout(false);
    }
  };

  // SAVE CHECKOUT CORRECTION

  const saveCheckout = async (row) => {
    const attendanceId = row._id || row.id;

    if (!attendanceId) {
      return toast.error("This row has no attendance record to update");
    }

    if (!row.checkIn || row.status === "LEAVE") {
      return toast.error("Checkout correction is not available for this row");
    }

    try {
      const value = checkoutEdits[attendanceId];

      if (!value) {
        return toast.error("Choose a checkout time first");
      }

      await api.patch(`/enterprise/attendance/${attendanceId}/checkout`, {
        checkOut: new Date(value).toISOString(),
        reason: "Admin correction from attendance review",
      });

      toast.success("Checkout time updated and audit logged");

      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Checkout update failed");
    }
  };

  // LOAD ATTENDANCE AUDIT

  const showAudit = async (id) => {
    if (!id) return;

    try {
      const { data: response } = await api.get(
        `/enterprise/attendance/${id}/audit`,
        {
          params: {
            _refresh: Date.now(),
          },
        },
      );

      setAuditRows((current) => ({
        ...current,
        [id]: response?.data || [],
      }));
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Could not load audit history",
      );
    }
  };

  // RENDER

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden sm:space-y-6">
      {/* PAGE HEADER */}

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#6B9B6E]">
            People operations
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1F2A1F] sm:text-3xl">
            Attendance & pay
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#697769]">
            Review attendance, manage salary structures and leave balances.
            Payroll lives under Payslips.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button
            variant="secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </Button>

          {isAdmin && (
            <Button
              variant="secondary"
              onClick={runCheckout}
              disabled={runningCheckout}
            >
              <CheckCircle2
                size={16}
                className={runningCheckout ? "animate-pulse" : ""}
              />
              {runningCheckout ? "Running…" : "Run auto-checkout"}
            </Button>
          )}
        </div>
      </div>

      {/* TABS */}

      <div className="flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-2">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              tab === item.id
                ? "bg-[#E8F3E9] text-[#3E7049] ring-1 ring-[#C9E0CC]"
                : "bg-white text-[#667466] ring-1 ring-[#E5EAE3] hover:bg-[#F7F9F6]"
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {/* ATTENDANCE REVIEW */}

      {tab === "attendance" && isAdmin && (
        <Card
          title="Attendance review"
          subtitle="Automatically closed records are flagged for review. Checkout corrections are recorded in an audit log."
        >
          {data.length ? (
            <Table
              headers={[
                "Employee",
                "Date",
                "Check-in",
                "Check-out",
                "Work hours",
                "Status",
                "Checkout correction",
                "Audit / leave",
              ]}
            >
              {data.map((row) => {
                const employee = row.employee || row.employeeId || {};
                const attendanceId = row._id || row.id;

                const isSyntheticLeave =
                  row.isSyntheticLeave === true ||
                  (!attendanceId && row.status === "LEAVE");

                const rowKey =
                  attendanceId ||
                  `${employee._id || row.employeeId || employee.email || employee.firstName}-${row.dateKey || row.date || row.status}`;

                return (
                  <tr key={rowKey}>
                    <Cell>
                      <div className="font-semibold">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-xs text-[#829082]">
                        {employee.department || "—"}
                      </div>
                    </Cell>

                    <Cell>
                      {fmtDate(row.date)}

                      {row.autoCheckedOut && (
                        <span className="ml-2 whitespace-nowrap rounded-full bg-[#FFF4D6] px-2 py-1 text-[10px] font-bold text-[#916A13]">
                          Auto
                        </span>
                      )}

                      {row.needsReview && (
                        <div className="mt-1 text-[10px] font-semibold text-[#A66C14]">
                          Needs review
                        </div>
                      )}
                    </Cell>

                    <Cell>
                      {row.checkIn
                        ? new Date(row.checkIn).toLocaleTimeString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </Cell>

                    <Cell>
                      {row.checkOut
                        ? new Date(row.checkOut).toLocaleTimeString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : row.checkIn
                          ? "Open"
                          : "—"}
                    </Cell>

                    <Cell>{row.workingHours ?? "—"}</Cell>
                    <Cell>{row.status || "—"}</Cell>

                    {/* CHECKOUT CORRECTION */}

                    <Cell>
                      {!isSyntheticLeave &&
                      attendanceId &&
                      row.checkIn &&
                      row.status !== "LEAVE" ? (
                        <div className="flex min-w-[210px] gap-2">
                          <input
                            className="w-full min-w-0 rounded-lg border border-[#DDE5DD] px-2 py-1.5 text-xs"
                            type="datetime-local"
                            value={
                              checkoutEdits[attendanceId] ??
                              (row.checkOut
                                ? new Date(
                                    new Date(row.checkOut).getTime() -
                                      new Date(
                                        row.checkOut,
                                      ).getTimezoneOffset() *
                                        60000,
                                  )
                                    .toISOString()
                                    .slice(0, 16)
                                : "")
                            }
                            onChange={(e) =>
                              setCheckoutEdits((current) => ({
                                ...current,
                                [attendanceId]: e.target.value,
                              }))
                            }
                          />

                          <button
                            onClick={() => saveCheckout(row)}
                            className="min-h-9 shrink-0 rounded-lg bg-[#4A7C59] px-3 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </Cell>

                    {/* AUDIT / LEAVE */}

                    <Cell>
                      {row.status === "LEAVE" && (
                        <div className="mb-2 text-xs font-semibold text-[#4A7C59]">
                          Approved leave
                          {row.leaveType ? ` · ${row.leaveType}` : ""}
                        </div>
                      )}

                      {isSyntheticLeave ? (
                        <span className="text-xs text-[#829082]">
                          No attendance log
                        </span>
                      ) : (
                        <>
                          {attendanceId && (
                            <button
                              onClick={() => showAudit(attendanceId)}
                              className="min-h-9 whitespace-nowrap text-xs font-semibold text-[#4A7C59] underline"
                            >
                              View log
                            </button>
                          )}

                          {row.status === "ABSENT" && attendanceId && (
                            <button
                              onClick={async () => {
                                const type = window.prompt(
                                  "Leave type: SICK, CASUAL, EMERGENCY, or ANNUAL",
                                  "SICK",
                                );

                                if (!type) return;

                                try {
                                  const { data: result } = await api.post(
                                    `/enterprise/attendance/${attendanceId}/convert-absence-to-leave`,
                                    {
                                      type: type.toUpperCase(),
                                    },
                                  );

                                  toast.success(
                                    `Converted: ${result.paidDays} paid day(s), ${result.lopDays} LOP day(s)`,
                                  );

                                  await load();
                                } catch (error) {
                                  toast.error(
                                    error?.response?.data?.error ||
                                      "Could not convert absence",
                                  );
                                }
                              }}
                              className="mt-2 block min-h-9 whitespace-nowrap text-xs font-semibold text-[#4A7C59] underline"
                            >
                              Convert absence to leave
                            </button>
                          )}

                          {attendanceId && auditRows[attendanceId] && (
                            <div className="mt-2 max-w-[260px] space-y-1 text-[10px] text-[#6F7C6F]">
                              {auditRows[attendanceId].length ? (
                                auditRows[attendanceId].map((audit, index) => (
                                  <div key={audit._id || index}>
                                    {audit.action} · {fmtDate(audit.createdAt)}
                                    <br />
                                    {audit.actorUserId?.email || "System"}
                                    {audit.reason ? ` · ${audit.reason}` : ""}
                                  </div>
                                ))
                              ) : (
                                <span>
                                  No audit history recorded for this attendance
                                  entry.
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </Cell>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty loading={loading} />
          )}
        </Card>
      )}

      {/* SALARY STRUCTURES */}

      {tab === "salary" && isAdmin && (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,.8fr)_minmax(0,1.5fr)]">
          <Card
            title="Salary structure"
            subtitle="Monthly gross = basic + HRA + allowances. Older structures are kept so back-dated payroll stays correct; a mid-month revision is paid pro-rata by day."
          >
            <form
              className="min-w-0 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();

                if (!salary.employee) {
                  return toast.error("Please select an active employee");
                }

                submit(
                  "/enterprise/salary-structures",
                  {
                    ...salary,
                    basic: Number(salary.basic),
                    hra: Number(salary.hra),
                    allowances: Number(salary.allowances),
                  },
                  () => {
                    setSalary({
                      employee: "",
                      basic: 0,
                      hra: 0,
                      allowances: 0,
                      effectiveFrom: new Date().toISOString().slice(0, 10),
                      isActive: true,
                    });
                  },
                );
              }}
            >
              <Field label="Employee">
                <select
                  className={inputClass}
                  required
                  value={salary.employee}
                  onChange={async (e) => {
                    const employeeId = e.target.value;

                    const selected = employeeOptions.find(
                      (emp) => String(emp.id || emp._id) === employeeId,
                    );

                    setSalary((current) => ({
                      ...current,
                      employee: employeeId,
                      basic: Number(selected?.basicSalary || 0),
                      hra: 0,
                      allowances: 0,
                    }));

                    if (!employeeId) return;

                    try {
                      const { data: currentSalary } = await api.get(
                        "/enterprise/salary-structures",
                        {
                          params: {
                            employee: employeeId,
                            _refresh: Date.now(),
                          },
                        },
                      );

                      const active = (currentSalary?.data || [])
                        .filter((item) => item.isActive === true)
                        .sort(
                          (a, b) =>
                            new Date(b.createdAt).getTime() -
                              new Date(a.createdAt).getTime() ||
                            String(b._id).localeCompare(String(a._id)),
                        )[0];

                      if (active) {
                        setSalary((current) =>
                          current.employee === employeeId
                            ? {
                                ...current,
                                basic: Number(active.basic || 0),
                                hra: Number(active.hra || 0),
                                allowances: Number(active.allowances || 0),
                              }
                            : current,
                        );
                      }
                    } catch (error) {
                      toast.error(
                        error?.response?.data?.error ||
                          "Could not load the employee current salary",
                      );
                    }
                  }}
                >
                  <option value="" disabled>
                    Select employee
                  </option>

                  {employeeOptions.map((emp) => (
                    <option key={emp.id || emp._id} value={emp.id || emp._id}>
                      {emp.firstName} {emp.lastName} (
                      {emp.position || emp.department || "Employee"})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Basic salary">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    required
                    value={salary.basic}
                    onChange={(e) =>
                      setSalary((current) => ({
                        ...current,
                        basic: e.target.value,
                      }))
                    }
                  />
                </Field>

                <Field label="HRA">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    value={salary.hra}
                    onChange={(e) =>
                      setSalary((current) => ({
                        ...current,
                        hra: e.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <Field label="Allowances">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  value={salary.allowances}
                  onChange={(e) =>
                    setSalary((current) => ({
                      ...current,
                      allowances: e.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Effective from">
                <input
                  className={inputClass}
                  type="date"
                  required
                  value={salary.effectiveFrom}
                  onChange={(e) =>
                    setSalary((current) => ({
                      ...current,
                      effectiveFrom: e.target.value,
                    }))
                  }
                />
              </Field>

              <Button type="submit">
                <Plus size={16} />
                Save salary structure
              </Button>
            </form>
          </Card>

          <Card
            title="Salary structures"
            subtitle="Showing the latest active salary structure for each active employee. Previous revisions are available in salary history."
          >
            {salaryRows.length ? (
              <Table
                headers={[
                  "Employee",
                  "Effective from",
                  "Basic",
                  "HRA",
                  "Allowances",
                  "Monthly gross",
                  "Created at",
                  "Updated at",
                  "History",
                ]}
              >
                {salaryRows.map((row) => {
                  const employeeId = row.employee._id;
                  const isHistoryOpen = !!salaryHistoryOpen[employeeId];
                  const history = getSalaryHistory(employeeId);

                  return (
                    <Fragment key={row._id}>
                      <tr>
                        <Cell>
                          <div className="font-semibold">
                            {row.employee.firstName} {row.employee.lastName}
                          </div>
                          <div className="text-xs text-[#829082]">
                            {row.employee.email}
                          </div>
                        </Cell>

                        <Cell>{fmtDate(row.effectiveFrom)}</Cell>
                        <Cell>{money(row.basic)}</Cell>
                        <Cell>{money(row.hra)}</Cell>
                        <Cell>{money(row.allowances)}</Cell>
                        <Cell>{money(row.fixedMonthlyGross)}</Cell>

                        <Cell>
                          <span className="text-xs">
                            {fmtDateTime(row.createdAt)}
                          </span>
                        </Cell>

                        <Cell>
                          <span className="text-xs">
                            {fmtDateTime(row.updatedAt)}
                          </span>
                        </Cell>

                        <Cell>
                          <button
                            type="button"
                            onClick={() =>
                              setSalaryHistoryOpen((current) => ({
                                ...current,
                                [employeeId]: !current[employeeId],
                              }))
                            }
                            className="min-h-9 whitespace-nowrap font-semibold text-[#4A7C59] underline"
                          >
                            {isHistoryOpen ? "Hide History" : "View History"}
                          </button>
                        </Cell>
                      </tr>

                      {isHistoryOpen && (
                        <tr>
                          <td colSpan={9} className="bg-[#F7F9F6] px-4 py-4">
                            <div className="mb-3 font-semibold text-[#1F2A1F]">
                              Salary history — {row.employee.firstName}{" "}
                              {row.employee.lastName}
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-[#E5EAE3] bg-white">
                              <table className="w-full min-w-[850px] text-left text-xs">
                                <thead className="bg-[#F7F9F6] text-[#687768]">
                                  <tr>
                                    {[
                                      "Effective from",
                                      "Basic",
                                      "HRA",
                                      "Allowances",
                                      "Monthly gross",
                                      "Status",
                                      "Created at",
                                      "Updated at",
                                    ].map((heading) => (
                                      <th
                                        key={heading}
                                        className="whitespace-nowrap px-3 py-3 font-semibold"
                                      >
                                        {heading}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>

                                <tbody className="divide-y divide-[#EDF0EB]">
                                  {history.map((item) => (
                                    <tr key={item._id}>
                                      <td className="px-3 py-3">
                                        {fmtDate(item.effectiveFrom)}
                                      </td>
                                      <td className="px-3 py-3">
                                        {money(item.basic)}
                                      </td>
                                      <td className="px-3 py-3">
                                        {money(item.hra)}
                                      </td>
                                      <td className="px-3 py-3">
                                        {money(item.allowances)}
                                      </td>
                                      <td className="px-3 py-3">
                                        {money(item.fixedMonthlyGross)}
                                      </td>
                                      <td className="px-3 py-3">
                                        {item.isActive ? (
                                          <span className="font-semibold text-[#3E7049]">
                                            Active
                                          </span>
                                        ) : (
                                          <span className="text-[#829082]">
                                            Inactive
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-3">
                                        {fmtDateTime(item.createdAt)}
                                      </td>
                                      <td className="px-3 py-3">
                                        {fmtDateTime(item.updatedAt)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Table>
            ) : (
              <Empty loading={loading} />
            )}
          </Card>
        </div>
      )}

      {/* LEAVE BALANCES */}

      {tab === "balances" && (
        <Card
          title="Leave balances"
          subtitle="Annual allocation: 7 sick + 7 casual + 3 emergency + 3 annual = 20 days."
        >
          {data.length ? (
            <Table
              headers={[
                "Employee",
                "Department",
                "Sick remaining",
                "Casual remaining",
                "Emergency remaining",
                "Annual remaining",
                "Total remaining",
              ]}
            >
              {data.map((row) => {
                const b = row.balances || {};

                const remain = [
                  b.sick,
                  b.casual,
                  b.emergency,
                  b.annual,
                ].reduce(
                  (sum, item) => sum + Number(item?.remaining || 0),
                  0,
                );

                return (
                  <tr key={row._id}>
                    <Cell>
                      <div className="font-semibold">
                        {row.employee?.firstName} {row.employee?.lastName}
                      </div>
                      <div className="text-xs text-[#829082]">
                        {row.employee?.email}
                      </div>
                    </Cell>

                    <Cell>{row.employee?.department || "—"}</Cell>

                    <Cell>
                      {b.sick?.remaining ?? 0} / {b.sick?.total ?? 7}
                    </Cell>

                    <Cell>
                      {b.casual?.remaining ?? 0} / {b.casual?.total ?? 7}
                    </Cell>

                    <Cell>
                      {b.emergency?.remaining ?? 0} / {b.emergency?.total ?? 3}
                    </Cell>

                    <Cell>
                      {b.annual?.remaining ?? 0} / {b.annual?.total ?? 3}
                    </Cell>

                    <Cell>
                      <span className="font-bold text-[#3E7049]">
                        {remain} days
                      </span>
                    </Cell>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty loading={loading} />
          )}
        </Card>
      )}
    </div>
  );
}
