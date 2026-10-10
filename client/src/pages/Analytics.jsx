import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Lightbulb,
  Megaphone,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import api from "../api/axios";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const money = (v) => `${Number(v || 0).toLocaleString("en-IN")}`;
const dateLabel = (v) =>
  new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const Card = ({ children, className = "" }) => (
  <section
    className={`rounded-2xl border border-[#E2E7E1] bg-white shadow-sm ${className}`}
  >
    {children}
  </section>
);
const SectionHead = ({ eyebrow, title, action }) => (
  <div className="mb-5 flex items-end justify-between gap-3">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#8A968C]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
    </div>
    {action}
  </div>
);
const Stat = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
    <div className="flex justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8A968C]">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-[#637066]">{hint}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF4EE] text-[#4A6F52]">
        <Icon className="h-5 w-5" />
      </span>
    </div>
  </div>
);

function LineChart({
  data = [],
  valueKey,
  suffix = "",
  empty = "No data yet.",
}) {
  if (!data.length)
    return (
      <div className="flex h-56 items-center justify-center text-sm text-[#8A968C]">
        {empty}
      </div>
    );
  const values = data.map((d) => Number(d[valueKey] ?? 0));
  const max = Math.max(...values, 1);
  const width = 760;
  const height = 230;
  const px = 36;
  const py = 20;
  const plotW = width - px * 2;
  const plotH = height - py * 2 - 22;
  const points = data.map((d, i) => {
    const x =
      px + (data.length === 1 ? plotW / 2 : (i * plotW) / (data.length - 1));
    const y = py + plotH - (values[i] / max) * plotH;
    return [x, y];
  });
  const path = points
    .map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`)
    .join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full">
        <line
          x1={px}
          x2={width - px}
          y1={py + plotH}
          y2={py + plotH}
          stroke="currentColor"
          className="text-[#E2E7E1]"
        />
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={r}
            x1={px}
            x2={width - px}
            y1={py + plotH * r}
            y2={py + plotH * r}
            stroke="currentColor"
            className="text-[#EEF2ED]"
          />
        ))}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-[#5E8064]"
        />
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="4"
              fill="currentColor"
              className="text-[#4A6F52]"
            />
            <text
              x={x}
              y={height - 5}
              textAnchor="middle"
              className="fill-[#8A968C] text-[10px]"
            >
              {data[i].label}
            </text>
            <title>{`${data[i].label}: ${data[i][valueKey] ?? 0}${suffix}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
function BarList({
  data = [],
  valueKey = "count",
  labelKey = "department",
  formatter = (v) => v,
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey] || 0)), 1);
  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d[labelKey]}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs">
            <span className="font-medium">{d[labelKey]}</span>
            <span className="text-[#8A968C]">{formatter(d[valueKey])}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#EEF2ED]">
            <div
              className="h-full rounded-full bg-[#5E8064]"
              style={{ width: `${(Number(d[valueKey] || 0) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
function Change({ value, inverse = false }) {
  const n = Number(value || 0);
  const positive = inverse ? n < 0 : n > 0;
  if (!n) return <span className="text-xs text-[#8A968C]">No change</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${positive ? "text-[#039855]" : "text-[#D92D20]"}`}
    >
      {positive ? (
        <ArrowUpRight className="h-3.5 w-3.5" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" />
      )}
      {Math.abs(n)}
    </span>
  );
}

function AIInsight({ storageKey, role }) {
  const [insight, setInsight] = useState(
    () => sessionStorage.getItem(storageKey) || "",
  );
  const [loading, setLoading] = useState(false);
  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ai/insights?force=1");
      setInsight(data.insight || "");
      sessionStorage.setItem(storageKey, data.insight || "");
      if (data.code === "AI_QUOTA_EXCEEDED")
        toast(
          "AI quota is currently exhausted; showing the deterministic analytics insight.",
        );
      else if (data.degraded)
        toast("Gemini is unavailable; showing a data-driven fallback.");
    } catch (e) {
      toast.error(e?.response?.data?.error || "AI insight unavailable");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className={`w-full p-5 ${role === "ADMIN" ? "max-w-none" : ""}`}>
      <SectionHead
        eyebrow="AI insight"
        title={
          role === "ADMIN"
            ? "Executive workforce summary"
            : "Personal performance summary"
        }
        action={
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {loading
              ? "Analyzing…"
              : insight
                ? "Refresh insight"
                : "Generate AI insight"}
          </button>
        }
      />
      <div className="flex gap-3 rounded-xl bg-[#F8FAF7] p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF4EE] text-[#4A6F52]">
          <Lightbulb className="h-5 w-5" />
        </span>
        <p className={`min-w-0 flex-1 overflow-y-auto whitespace-pre-line text-sm leading-6 text-[#637066] ${role === "ADMIN" ? "max-h-[32rem]" : "max-h-96"}`}>
          {insight ||
            "Charts and calculations are available immediately. Generate an AI insight when you want Gemini to explain the already-calculated metrics."}
        </p>
      </div>
    </Card>
  );
}

function EmployeeAnalytics({ data }) {
  const s = data.summary;
  const cmp = data.monthlyComparison;
  const [announcements, setAnnouncements] = useState([]);
  const [holidays, setHolidays] = useState([]);
  useEffect(() => {
    api
      .get("/announcements")
      .then(({ data: r }) => setAnnouncements(r.data || []))
      .catch(() => {});
    api
      .get(`/holidays?year=${new Date().getFullYear()}`)
      .then(({ data: r }) => setHolidays(r.data || []))
      .catch(() => {});
  }, []);
  const daily = data.attendanceTrend || [];
  const donutTotal =
    (s.presentDays || 0) + (s.lateArrivals || 0) + (s.absentDays || 0);
  return (
    <div className="space-y-6 animate-fade-in">
      <header className="rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
          Personal intelligence
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">My Analytics</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#637066]">
              Accurate attendance, working-hours, leave and payroll trends based
              on your EMS records.
            </p>
          </div>
          <button onClick={() => window.print()} className="btn-secondary">
            Print / Save PDF
          </button>
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={TrendingUp}
          label="Attendance"
          value={`${s.attendanceRate}%`}
          hint={`${s.attendanceDelta >= 0 ? "+" : ""}${s.attendanceDelta}% vs previous month`}
        />
        <Stat
          icon={CheckCircle2}
          label="Present days"
          value={s.presentDays}
          hint={`${s.lateArrivals} late · ${s.absentDays} absent`}
        />
        <Stat
          icon={Clock3}
          label="Average hours"
          value={`${s.avgHours}h`}
          hint={`${s.totalHours}h tracked`}
        />
        <Stat
          icon={FileText}
          label="Latest net salary"
          value={s.latestNetSalary == null ? "—" : money(s.latestNetSalary)}
          hint="Latest generated payslip"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <Card className="p-5">
          <SectionHead
            eyebrow="12-month trend"
            title="Attendance performance"
          />
          <LineChart
            data={data.attendanceTrend}
            valueKey="attendanceRate"
            suffix="%"
          />
        </Card>
        <Card className="p-5">
          <SectionHead eyebrow="This month" title="Status mix" />
          <div className="flex items-center justify-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-[22px] border-[#EDF4EE] text-center">
              <div>
                <p className="text-2xl font-semibold">{donutTotal}</p>
                <p className="text-[10px] text-[#8A968C]">tracked</p>
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-2 text-xs">
            <p className="flex justify-between">
              <span>Present</span>
              <b>{s.presentDays}</b>
            </p>
            <p className="flex justify-between">
              <span>Late</span>
              <b>{s.lateArrivals}</b>
            </p>
            <p className="flex justify-between">
              <span>Absent</span>
              <b>{s.absentDays}</b>
            </p>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <SectionHead
          eyebrow="Monthly working hours"
          title="How many hours did I work each month?"
          action={
            <span className="text-xs text-[#8A968C]">
              Monthly totals from completed check-in/out records
            </span>
          }
        />
        {daily.length ? (
          <div className="overflow-x-auto">
            <div
              className="flex min-w-[720px] items-end gap-2 px-2"
              style={{ height: 260 }}
            >
              {daily.map((d) => {
                const maxHours = Math.max(
                  ...daily.map((item) => Number(item.workingHours || 0)),
                  1
                );
                const h = Number(d.workingHours || 0);
                return (
                  <div
                    key={d.key}
                    className="flex h-full flex-1 min-w-7 flex-col items-center justify-end gap-2"
                    title={`${d.label} · ${d.workingHours}h`}
                  >
                    <div
                      className="w-full rounded-t-lg bg-[#5E8064]"
                      style={{ height: `${Math.max(4, (h / maxHours) * 190)}px` }}
                    />
                    <span className="text-[9px] text-[#8A968C]">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-[#8A968C]">
            No monthly working-hours records are available yet.
          </div>
        )}
        <div className="mt-4 rounded-xl bg-[#F8FAF7] p-4">
          <p className="text-xs text-[#637066]">
            Monthly average working hours
          </p>
          <p className="mt-1 text-2xl font-semibold">{s.avgHours}h</p>
        </div>
      </Card>
      <Card className="p-5">
        <SectionHead
          eyebrow="Month over month"
          title={`${cmp.current.label} vs ${cmp.previous.label}`}
        />
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "Attendance",
              `${cmp.previous.attendanceRate}%`,
              `${cmp.current.attendanceRate}%`,
              <Change value={cmp.delta.attendancePoints} />,
            ],
            [
              "Average hours",
              `${cmp.previous.avgHours}h`,
              `${cmp.current.avgHours}h`,
              <Change value={cmp.delta.avgHours} />,
            ],
            [
              "Late arrivals",
              cmp.previous.late,
              cmp.current.late,
              <Change value={cmp.delta.late} inverse />,
            ],
          ].map(([label, prev, cur, change]) => (
            <div key={label} className="rounded-xl border border-[#E2E7E1] p-4">
              <p className="text-xs text-[#8A968C]">{label}</p>
              <div className="mt-2 flex items-end gap-3">
                <div>
                  <p className="text-[10px] text-[#8A968C]">Previous</p>
                  <p className="text-lg font-semibold">{prev}</p>
                </div>
                <ArrowRightSmall />
                <div>
                  <p className="text-[10px] text-[#8A968C]">Current</p>
                  <p className="text-lg font-semibold">{cur}</p>
                </div>
              </div>
              <div className="mt-2">{change}</div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionHead eyebrow="Leave analytics" title="Usage by type" />
          <div className="space-y-4">
            {data.leaveStats.map((l) => (
              <div
                key={l.type}
                className="rounded-xl border border-[#E2E7E1] p-4"
              >
                <div className="flex justify-between">
                  <span className="text-sm font-semibold">{l.type}</span>
                  <span className="text-xs text-[#8A968C]">
                    {l.total} requests
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <span className="rounded-lg bg-[#ECFDF3] px-2 py-2 text-center text-[#039855]">
                    Approved {l.approved}
                  </span>
                  <span className="rounded-lg bg-[#FFFAEB] px-2 py-2 text-center text-[#B54708]">
                    Pending {l.pending}
                  </span>
                  <span className="rounded-lg bg-[#FEF3F2] px-2 py-2 text-center text-[#D92D20]">
                    Rejected {l.rejected}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionHead eyebrow="Salary history" title="Net salary trend" />
          <LineChart
            data={data.salaryTrend}
            valueKey="netSalary"
            empty="No payslip history available."
          />
        </Card>
      </div>
      <AIInsight storageKey="ems-ai-employee-insight" role="EMPLOYEE" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionHead eyebrow="What's new" title="Announcements" />
          <div className="space-y-3">
            {announcements.slice(0, 4).map((a) => (
              <div key={a._id} className="rounded-xl bg-[#F8FAF7] p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <span className="text-[10px] text-[#8A968C]">
                    {dateLabel(a.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#637066]">
                  {a.content}
                </p>
              </div>
            ))}
            {!announcements.length && (
              <p className="text-sm text-[#8A968C]">No announcements yet.</p>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <SectionHead eyebrow="Calendar" title="Upcoming holidays" />
          <div className="grid gap-2 sm:grid-cols-2">
            {holidays
              .filter((h) => new Date(h.date) >= new Date())
              .slice(0, 6)
              .map((h) => (
                <div
                  key={h._id}
                  className="rounded-xl border border-[#E2E7E1] p-3"
                >
                  <p className="text-sm font-semibold">{h.name}</p>
                  <p className="mt-1 text-xs text-[#8A968C]">
                    {dateLabel(h.date)} · {h.type}
                  </p>
                </div>
              ))}
            {!holidays.length && (
              <p className="text-sm text-[#8A968C]">No holidays configured.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
function ArrowRightSmall() {
  return <span className="pb-1 text-[#9DB6A2]">→</span>;
}

function AdminAnalytics({ data }) {
  const [announcements, setAnnouncements] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showHoliday, setShowHoliday] = useState(false);
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [submittingHoliday, setSubmittingHoliday] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "NORMAL",
  });
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    type: "COMPANY",
  });
  const load = () => {
    api
      .get("/announcements")
      .then(({ data: r }) => setAnnouncements(r.data || []))
      .catch(() => {});
    api
      .get(`/holidays?year=${new Date().getFullYear()}`)
      .then(({ data: r }) => setHolidays(r.data || []))
      .catch(() => {});
  };
  useEffect(load, []);
  const createAnnouncement = async (e) => {
    e.preventDefault();
    if (submittingAnnouncement) return;
    setSubmittingAnnouncement(true);
    try {
      await api.post("/announcements", form);
      toast.success("Announcement published");
      setForm({ title: "", content: "", priority: "NORMAL" });
      setShowAnnouncement(false);
      load();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Failed to publish announcement",
      );
    } finally {
      setSubmittingAnnouncement(false);
    }
  };
  const createHoliday = async (e) => {
    e.preventDefault();
    if (submittingHoliday) return;
    setSubmittingHoliday(true);
    try {
      await api.post("/holidays", holidayForm);
      toast.success("Holiday added");
      setHolidayForm({ name: "", date: "", type: "COMPANY" });
      setShowHoliday(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to add holiday");
    } finally {
      setSubmittingHoliday(false);
    }
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <header className="rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
          Workforce intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#637066]">
          A real-data operating view across headcount, departments, attendance,
          leave and payroll. Unsupported metrics are explicitly left
          unestimated.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          icon={Users}
          label="Headcount"
          value={data.summary.headcount}
          hint={`${data.summary.activeEmployees} active`}
        />
        <Stat
          icon={UserPlusIcon}
          label="New hires"
          value={data.summary.newHiresThisMonth}
          hint="This month"
        />
        <Stat
          icon={CalendarDays}
          label="Today's attendance"
          value={`${data.summary.attendanceRateToday}%`}
          hint={`${data.summary.todayAttendance} present · ${data.summary.todayLate} late`}
        />
        <Stat
          icon={FileText}
          label="Pending leaves"
          value={data.summary.pendingLeaves}
          hint={`${data.summary.todayOnLeave} on leave today`}
        />
        <Stat
          icon={TrendingUp}
          label="12-month payroll"
          value={money(data.summary.payroll12Months)}
          hint={`${data.summary.leaveApprovalRate}% leave approval`}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="p-5">
          <SectionHead eyebrow="Headcount & growth" title="Workforce trend" />
          <LineChart
            data={data.headcountTrend}
            valueKey="count"
            suffix=" employees"
          />
        </Card>
        <Card className="p-5">
          <SectionHead
            eyebrow="Department distribution"
            title="Where people sit"
          />
          <BarList
            data={data.departmentDistribution}
            valueKey="count"
            formatter={(v) => `${v} people`}
          />
        </Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionHead
            eyebrow="Attendance"
            title="Monthly workforce attendance"
          />
          <LineChart
            data={data.attendanceTrend}
            valueKey="attendanceRate"
            suffix="%"
          />
        </Card>
        <Card className="p-5">
          <SectionHead eyebrow="Payroll" title="Net payroll trend" />
          <LineChart
            data={data.payrollTrend}
            valueKey="totalNet"
            empty="No payroll records available."
          />
        </Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionHead eyebrow="Leave utilization" title="Requests over time" />
          <div className="space-y-4">
            {data.leaveTrend.map((m) => (
              <div key={m.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{m.label}</span>
                  <span className="text-[#8A968C]">{m.total} total</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-[#EEF2ED]">
                  <div
                    className="bg-[#5E8064]"
                    style={{
                      width: `${m.total ? (m.approved / m.total) * 100 : 0}%`,
                    }}
                  />
                  <div
                    className="bg-[#DC6803]"
                    style={{
                      width: `${m.total ? (m.pending / m.total) * 100 : 0}%`,
                    }}
                  />
                  <div
                    className="bg-[#D92D20]"
                    style={{
                      width: `${m.total ? (m.rejected / m.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionHead
            eyebrow="Data availability"
            title="Metrics not yet stored"
          />
          <p className="text-sm leading-6 text-[#637066]">
            {data.availability?.reason}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["Attrition", data.availability?.attritionRate],
              ["Performance", data.availability?.performanceRating],
              ["Recruitment funnel", data.availability?.recruitmentFunnel],
              ["Engagement", data.availability?.engagementScore],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-xl bg-[#F8FAF7] p-3 text-sm"
              >
                <span>{k}</span>
                <span className="text-xs text-[#8A968C]">
                  {v == null ? "Not available" : v}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <AIInsight storageKey="ems-ai-admin-insight" role="ADMIN" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E7E1] p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#8A968C]">
                Communication
              </p>
              <h2 className="mt-1 text-lg font-semibold">Announcements</h2>
            </div>
            <button
              onClick={() => setShowAnnouncement(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
          <div className="space-y-3 p-5">
            {announcements.map((a) => (
              <div
                key={a._id}
                className="rounded-xl border border-[#E2E7E1] p-4"
              >
                <div className="flex justify-between gap-3">
                  <p className="font-semibold">{a.title}</p>
                  <span className="text-[10px] text-[#8A968C]">
                    {a.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#637066]">
                  {a.content}
                </p>
              </div>
            ))}
            {!announcements.length && (
              <p className="text-sm text-[#8A968C]">No announcements yet.</p>
            )}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E7E1] p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#8A968C]">
                Calendar management
              </p>
              <h2 className="mt-1 text-lg font-semibold">Company holidays</h2>
            </div>
            <button
              onClick={() => setShowHoliday(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {holidays.map((h) => (
              <div
                key={h._id}
                className="rounded-xl border border-[#E2E7E1] p-3"
              >
                <p className="text-sm font-semibold">{h.name}</p>
                <p className="mt-1 text-xs text-[#8A968C]">
                  {dateLabel(h.date)} · {h.type}
                </p>
              </div>
            ))}
            {!holidays.length && (
              <p className="text-sm text-[#8A968C]">No holidays configured.</p>
            )}
          </div>
        </Card>
      </div>
      {showAnnouncement && (
        <Modal
          title="Create announcement"
          onClose={() => setShowAnnouncement(false)}
        >
          <form onSubmit={createAnnouncement} className="space-y-3">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Announcement title"
              maxLength={120}
              required
            />
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option>NORMAL</option>
              <option>IMPORTANT</option>
              <option>URGENT</option>
            </select>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write the announcement…"
              rows={5}
              maxLength={2000}
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAnnouncement(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={submittingAnnouncement}>{submittingAnnouncement ? "Publishing…" : "Publish"}</button>
            </div>
          </form>
        </Modal>
      )}
      {showHoliday && (
        <Modal title="Add holiday" onClose={() => setShowHoliday(false)}>
          <form onSubmit={createHoliday} className="space-y-3">
            <input
              value={holidayForm.name}
              onChange={(e) =>
                setHolidayForm({ ...holidayForm, name: e.target.value })
              }
              placeholder="Holiday name"
              required
            />
            <input
              type="date"
              value={holidayForm.date}
              onChange={(e) =>
                setHolidayForm({ ...holidayForm, date: e.target.value })
              }
              required
            />
            <select
              value={holidayForm.type}
              onChange={(e) =>
                setHolidayForm({ ...holidayForm, type: e.target.value })
              }
            >
              <option>COMPANY</option>
              <option>PUBLIC</option>
              <option>OPTIONAL</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowHoliday(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={submittingHoliday}>{submittingHoliday ? "Adding…" : "Add holiday"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
function UserPlusIcon({ className }) {
  return <Users className={className} />;
}
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#E2E7E1] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-[#8A968C]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get("/analytics")
      .then(({ data: r }) => setData(r))
      .catch((e) =>
        toast.error(e?.response?.data?.error || "Failed to load analytics"),
      )
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <Loading />;
  if (!data)
    return (
      <div className="py-16 text-center text-sm text-[#8A968C]">
        Analytics could not be loaded.
      </div>
    );
  return user?.role === "ADMIN" ? (
    <AdminAnalytics data={data} />
  ) : (
    <EmployeeAnalytics data={data} />
  );
}
