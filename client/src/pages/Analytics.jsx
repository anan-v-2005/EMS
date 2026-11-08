import React, { useCallback, useEffect, useState } from "react";
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
  new Date(v).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

const Card = ({ children, className = "" }) => (
  <section
    className={`min-w-0 rounded-2xl border border-[#E2E7E1] bg-white shadow-sm ${className}`}
  >
    {children}
  </section>
);

const SectionHead = ({ eyebrow, title, action }) => (
  <div className="mb-5 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between">
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#8A968C]">
        {eyebrow}
      </p>
      <h2 className="mt-1 break-words text-lg font-semibold tracking-tight">
        {title}
      </h2>
    </div>

    {action && <div className="min-w-0 max-w-full">{action}</div>}
  </div>
);

const Stat = ({ icon: Icon, label, value, hint }) => (
  <div className="min-w-0 rounded-2xl border border-[#E2E7E1] bg-white p-3 shadow-sm sm:p-5">
    <div className="flex min-w-0 justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A968C] sm:text-xs">
          {label}
        </p>

        <p className="mt-2 break-words text-xl font-semibold sm:text-2xl">
          {value}
        </p>

        <p className="mt-1 break-words text-[10px] text-[#637066] sm:text-xs">
          {hint}
        </p>
      </div>

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EDF4EE] text-[#4A6F52] sm:h-10 sm:w-10">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
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
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-[#8A968C]">
        {empty}
      </div>
    );
  }

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
    <div className="max-w-full overflow-x-auto overscroll-x-contain">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[560px] w-full sm:min-w-[620px]"
      >
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

            <title>
              {`${data[i].label}: ${data[i][valueKey] ?? 0}${suffix}`}
            </title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function BarChart({
  data = [],
  valueKey,
  suffix = "",
  empty = "No data yet.",
}) {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-[#8A968C]">
        {empty}
      </div>
    );
  }

  const values = data.map((item) =>
    Math.max(0, Number(item[valueKey] || 0)),
  );

  const max = Math.max(...values, 1);

  return (
    <div
      className="flex h-56 max-w-full items-end gap-3 overflow-x-auto overscroll-x-contain px-2 pb-1"
      role="img"
      aria-label="Monthly bar chart"
    >
      {data.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="flex h-full min-w-[48px] flex-1 flex-col items-center justify-end gap-2"
        >
          <span className="text-[10px] font-semibold text-[#637066]">
            {Number(item[valueKey] || 0).toLocaleString("en-IN")}
            {suffix}
          </span>

          <div className="flex h-[72%] w-full items-end rounded-t-lg bg-[#EEF2ED]">
            <div
              className="w-full rounded-t-lg bg-[#5E8064] transition-all"
              style={{
                height: `${Math.max(2, (values[index] / max) * 100)}%`,
              }}
            />
          </div>

          <span className="whitespace-nowrap text-[10px] text-[#8A968C]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function DepartmentPie({ data = [] }) {
  const total = data.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );

  const palette = [
    "#4A7C59",
    "#7AA786",
    "#A6C5A9",
    "#D1A85B",
    "#6B8FB3",
    "#9B83B5",
    "#C47D70",
    "#7F8C8D",
  ];

  let cursor = 0;

  const stops = data.map((item, index) => {
    const start = cursor;

    cursor += total
      ? (Number(item.count || 0) / total) * 100
      : 0;

    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  if (!data.length || !total) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-[#8A968C]">
        No department data available.
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div
        className="relative h-44 w-44 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${stops.join(",")})`,
        }}
        role="img"
        aria-label="Department distribution pie chart"
      >
        <div className="absolute inset-10 flex items-center justify-center rounded-full bg-white text-center">
          <div>
            <p className="text-2xl font-semibold">{total}</p>
            <p className="text-[10px] text-[#8A968C]">Employees</p>
          </div>
        </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-2">
        {data.map((item, index) => (
          <div
            key={item.department}
            className="flex min-w-0 items-center justify-between gap-3 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2">
              <i
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  background: palette[index % palette.length],
                }}
              />

              <span className="truncate">{item.department}</span>
            </span>

            <span className="shrink-0 text-[#637066]">
              {item.count} · {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Change({ value, inverse = false }) {
  const n = Number(value || 0);
  const positive = inverse ? n < 0 : n > 0;

  if (!n) {
    return (
      <span className="text-xs text-[#8A968C]">No change</span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        positive ? "text-[#039855]" : "text-[#D92D20]"
      }`}
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
      const { data } = await api.get("/ai/insights");

      setInsight(data.insight || "");
      sessionStorage.setItem(storageKey, data.insight || "");

      if (data.code === "AI_QUOTA_EXCEEDED") {
        toast(
          "AI quota is currently exhausted; showing the deterministic analytics insight.",
        );
      } else if (data.degraded) {
        toast("Gemini is unavailable; showing a data-driven fallback.");
      }
    } catch (e) {
      toast.error(
        e?.response?.data?.error || "AI insight unavailable",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`w-full p-3 sm:p-5 ${role === "ADMIN" ? "max-w-none" : ""}`}>
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
            className="btn-primary inline-flex min-h-10 w-full items-center justify-center gap-2 text-xs sm:w-auto sm:text-sm"
          >
            <Sparkles className="h-4 w-4 shrink-0" />

            {loading
              ? "Analyzing…"
              : insight
                ? "Refresh insight"
                : "Generate AI insight"}
          </button>
        }
      />

      <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-[#F8FAF7] p-3 sm:flex-row sm:gap-3 sm:p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF4EE] text-[#4A6F52]">
          <Lightbulb className="h-5 w-5" />
        </span>

        <p
          className={`min-w-0 flex-1 overflow-y-auto whitespace-pre-line break-words text-sm leading-6 text-[#637066] ${
            role === "ADMIN"
              ? "max-h-[32rem] min-h-[12rem] sm:min-h-[18rem]"
              : "max-h-[28rem] min-h-[12rem] sm:min-h-[16rem]"
          }`}
        >
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
    (s.presentDays || 0) +
    (s.lateArrivals || 0) +
    (s.absentDays || 0);

  return (
    <div className="min-w-0 space-y-4 animate-fade-in sm:space-y-6">
      <header className="rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-4 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
          Personal intelligence
        </p>

        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold sm:text-4xl">
              My Analytics
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#637066]">
              Accurate attendance, working-hours, leave and payroll trends
              based on your EMS records.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="btn-secondary w-full sm:w-auto"
          >
            Print / Save PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
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

      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <Card className="p-3 sm:p-5">
          <SectionHead
            eyebrow="12-month trend"
            title="Attendance performance"
          />

          <BarChart
            data={data.attendanceTrend.slice(-5)}
            valueKey="attendanceRate"
            suffix="%"
          />
        </Card>

        <Card className="p-3 sm:p-5">
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

      <Card className="p-3 sm:p-5">
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
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <div
              className="flex min-w-[600px] items-end gap-2 px-2 sm:min-w-[720px]"
              style={{ height: 260 }}
            >
              {daily.map((d) => {
                const maxHours = Math.max(
                  ...daily.map((item) =>
                    Number(item.workingHours || 0),
                  ),
                  1,
                );

                const h = Number(d.workingHours || 0);

                return (
                  <div
                    key={d.key}
                    className="flex h-full min-w-7 flex-1 flex-col items-center justify-end gap-2"
                    title={`${d.label} · ${d.workingHours}h`}
                  >
                    <div
                      className="w-full rounded-t-lg bg-[#5E8064]"
                      style={{
                        height: `${Math.max(4, (h / maxHours) * 190)}px`,
                      }}
                    />

                    <span className="text-[9px] text-[#8A968C]">
                      {d.label}
                    </span>
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

        <div className="mt-4 rounded-xl bg-[#F8FAF7] p-3 sm:p-4">
          <p className="text-xs text-[#637066]">
            Monthly average working hours
          </p>

          <p className="mt-1 text-2xl font-semibold">{s.avgHours}h</p>
        </div>
      </Card>

      <Card className="p-3 sm:p-5">
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
            <div
              key={label}
              className="min-w-0 rounded-xl border border-[#E2E7E1] p-3 sm:p-4"
            >
              <p className="text-xs text-[#8A968C]">{label}</p>

              <div className="mt-2 flex items-end gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-[#8A968C]">Previous</p>
                  <p className="break-words text-lg font-semibold">{prev}</p>
                </div>

                <ArrowRightSmall />

                <div className="min-w-0">
                  <p className="text-[10px] text-[#8A968C]">Current</p>
                  <p className="break-words text-lg font-semibold">{cur}</p>
                </div>
              </div>

              <div className="mt-2">{change}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-2">
        <Card className="p-3 sm:p-5">
          <SectionHead eyebrow="Leave analytics" title="Usage by type" />

          <div className="space-y-4">
            {data.leaveStats.map((l) => (
              <div
                key={l.type}
                className="rounded-xl border border-[#E2E7E1] p-3 sm:p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-sm font-semibold">{l.type}</span>

                  <span className="text-xs text-[#8A968C]">
                    {l.total} requests
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-[10px] min-[400px]:grid-cols-3">
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

        <Card className="p-3 sm:p-5">
          <SectionHead eyebrow="Salary history" title="Net salary trend" />

          <LineChart
            data={data.salaryTrend}
            valueKey="netSalary"
            empty="No payslip history available."
          />
        </Card>
      </div>

      <AIInsight
        storageKey="ems-ai-employee-insight"
        role="EMPLOYEE"
      />

      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-2">
        <Card className="p-3 sm:p-5">
          <SectionHead eyebrow="What's new" title="Announcements" />

          <div className="space-y-3">
            {announcements.slice(0, 4).map((a) => (
              <div
                key={a._id}
                className="rounded-xl bg-[#F8FAF7] p-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold">
                    {a.title}
                  </p>

                  <span className="shrink-0 text-[10px] text-[#8A968C]">
                    {dateLabel(a.createdAt)}
                  </span>
                </div>

                <p className="mt-1 break-words text-xs leading-5 text-[#637066]">
                  {a.content}
                </p>
              </div>
            ))}

            {!announcements.length && (
              <p className="text-sm text-[#8A968C]">
                No announcements yet.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-3 sm:p-5">
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
                  <p className="break-words text-sm font-semibold">
                    {h.name}
                  </p>

                  <p className="mt-1 text-xs text-[#8A968C]">
                    {dateLabel(h.date)} · {h.type}
                  </p>
                </div>
              ))}

            {!holidays.length && (
              <p className="text-sm text-[#8A968C]">
                No holidays configured.
              </p>
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

  const [eventMonth, setEventMonth] = useState(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).format(new Date()),
  );

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

  const latestHeadcount = Number(
    data.headcountTrend?.at(-1)?.count || 0,
  );

  const previousHeadcount = Number(
    data.headcountTrend?.at(-2)?.count || 0,
  );

  const headcountGrowth = latestHeadcount - previousHeadcount;

  const load = useCallback(() => {
    api
      .get("/announcements")
      .then(({ data: r }) => setAnnouncements(r.data || []))
      .catch(() => {});

    api
      .get(
        `/holidays?year=${Number(eventMonth.slice(0, 4)) || new Date().getFullYear()}`,
      )
      .then(({ data: r }) => setHolidays(r.data || []))
      .catch(() => {});
  }, [eventMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const inSelectedMonth = (value) =>
    value &&
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).format(new Date(value)) === eventMonth;

  const visibleAnnouncements = announcements
    .filter((item) => inSelectedMonth(item.createdAt))
    .slice(0, 5);

  const visibleHolidays = holidays
    .filter((item) => inSelectedMonth(item.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const createAnnouncement = async (e) => {
    e.preventDefault();

    if (submittingAnnouncement) return;

    setSubmittingAnnouncement(true);

    try {
      const { data: result } = await api.post(
        "/announcements",
        form,
      );

      toast.success(result?.message || "Announcement published");

      setForm({
        title: "",
        content: "",
        priority: "NORMAL",
      });

      setShowAnnouncement(false);
      load();
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
          "Failed to publish announcement",
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
      const { data: result } = await api.post(
        "/holidays",
        holidayForm,
      );

      toast.success(result?.message || "Holiday added");

      setHolidayForm({
        name: "",
        date: "",
        type: "COMPANY",
      });

      setShowHoliday(false);
      load();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Failed to add holiday",
      );
    } finally {
      setSubmittingHoliday(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4 animate-fade-in sm:space-y-6">
      <header className="rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-4 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
          Workforce intelligence
        </p>

        <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">
          Analytics
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#637066]">
          A real-data operating view across headcount, departments,
          attendance, leave and payroll. Unsupported metrics are explicitly
          left unestimated.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
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

      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="p-3 sm:p-5">
          <SectionHead
            eyebrow="Headcount & growth"
            title="Workforce trend"
          />

          <LineChart
            data={data.headcountTrend}
            valueKey="count"
            suffix=" employees"
          />

          <p className="mt-3 text-xs text-[#637066]">
            Latest month growth:{" "}
            <strong
              className={
                headcountGrowth >= 0
                  ? "text-[#3E7049]"
                  : "text-[#B5473A]"
              }
            >
              {headcountGrowth > 0 ? "+" : ""}
              {headcountGrowth} employees
            </strong>
          </p>
        </Card>

        <Card className="p-3 sm:p-5">
          <SectionHead
            eyebrow="Department distribution"
            title="Where people sit"
          />

          <DepartmentPie data={data.departmentDistribution} />
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-2">
        <Card className="p-3 sm:p-5">
          <SectionHead
            eyebrow="Attendance"
            title="Monthly workforce attendance"
          />

          <BarChart
            data={data.attendanceTrend.slice(-5)}
            valueKey="attendanceRate"
            suffix="%"
          />
        </Card>

        <Card className="p-3 sm:p-5">
          <SectionHead eyebrow="Payroll" title="Net payroll trend" />

          <BarChart
            data={data.payrollTrend.slice(-5)}
            valueKey="totalNet"
            empty="No payroll records available."
          />
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-2">
        <Card className="p-3 sm:p-5">
          <SectionHead
            eyebrow="Leave utilization"
            title="Requests over time"
          />

          <div className="space-y-4">
            {[...data.leaveTrend].reverse().map((m) => (
              <div key={m.label}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span>{m.label}</span>

                  <span className="text-[#8A968C]">
                    {m.total} total
                  </span>
                </div>

                <div className="flex h-2 overflow-hidden rounded-full bg-[#EEF2ED]">
                  <div
                    className="bg-[#5E8064]"
                    style={{
                      width: `${
                        m.total ? (m.approved / m.total) * 100 : 0
                      }%`,
                    }}
                  />

                  <div
                    className="bg-[#DC6803]"
                    style={{
                      width: `${
                        m.total ? (m.pending / m.total) * 100 : 0
                      }%`,
                    }}
                  />

                  <div
                    className="bg-[#D92D20]"
                    style={{
                      width: `${
                        m.total ? (m.rejected / m.total) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-3 sm:p-5">
          <SectionHead
            eyebrow="Data availability"
            title="Metrics not yet stored"
          />

          <p className="break-words text-sm leading-6 text-[#637066]">
            {data.availability?.reason}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["Attrition", data.availability?.attritionRate],
              ["Engagement", data.availability?.engagementScore],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-2 rounded-xl bg-[#F8FAF7] p-3 text-sm"
              >
                <span>{k}</span>

                <span className="text-right text-xs text-[#8A968C]">
                  {v == null ? "Not available" : v}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <AIInsight
        storageKey="ems-ai-admin-insight"
        role="ADMIN"
      />

      <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="text-sm text-[#637066]">
          Showing up to five events for the selected month.
        </p>

        <input
          type="month"
          value={eventMonth}
          onChange={(e) => setEventMonth(e.target.value)}
          className="w-full min-w-0 rounded-xl border border-[#DDE5DD] bg-white px-3 py-2 text-sm sm:w-auto"
          aria-label="Filter announcements and holidays by month"
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#E2E7E1] p-3 sm:p-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#8A968C]">
                Communication
              </p>

              <h2 className="mt-1 text-base font-semibold sm:text-lg">
                Announcements
              </h2>
            </div>

            <button
              onClick={() => setShowAnnouncement(true)}
              className="btn-primary inline-flex shrink-0 items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>

          <div className="space-y-3 p-3 sm:p-5">
            {visibleAnnouncements.map((a) => (
              <div
                key={a._id}
                className="rounded-xl border border-[#E2E7E1] p-3 sm:p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold">
                    {a.title}
                  </p>

                  <span className="shrink-0 text-[10px] text-[#8A968C]">
                    {a.priority}
                  </span>
                </div>

                <p className="mt-2 break-words text-sm leading-6 text-[#637066]">
                  {a.content}
                </p>
              </div>
            ))}

            {!visibleAnnouncements.length && (
              <p className="text-sm text-[#8A968C]">
                No announcements yet.
              </p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#E2E7E1] p-3 sm:p-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#8A968C]">
                Calendar management
              </p>

              <h2 className="mt-1 text-base font-semibold sm:text-lg">
                Company holidays
              </h2>
            </div>

            <button
              onClick={() => setShowHoliday(true)}
              className="btn-primary inline-flex shrink-0 items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-5">
            {visibleHolidays.map((h) => (
              <div
                key={h._id}
                className="rounded-xl border border-[#E2E7E1] p-3"
              >
                <p className="break-words text-sm font-semibold">
                  {h.name}
                </p>

                <p className="mt-1 text-xs text-[#8A968C]">
                  {dateLabel(h.date)} · {h.type}
                </p>
              </div>
            ))}

            {!visibleHolidays.length && (
              <p className="text-sm text-[#8A968C]">
                No holidays configured.
              </p>
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
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              placeholder="Announcement title"
              maxLength={120}
              required
            />

            <select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value })
              }
            >
              <option>NORMAL</option>
              <option>IMPORTANT</option>
              <option>URGENT</option>
            </select>

            <textarea
              value={form.content}
              onChange={(e) =>
                setForm({ ...form, content: e.target.value })
              }
              placeholder="Write the announcement…"
              rows={5}
              maxLength={2000}
              required
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowAnnouncement(false)}
                className="btn-secondary w-full sm:w-auto"
              >
                Cancel
              </button>

              <button
                className="btn-primary w-full sm:w-auto"
                disabled={submittingAnnouncement}
              >
                {submittingAnnouncement
                  ? "Publishing…"
                  : "Publish"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showHoliday && (
        <Modal
          title="Add holiday"
          onClose={() => setShowHoliday(false)}
        >
          <form onSubmit={createHoliday} className="space-y-3">
            <input
              value={holidayForm.name}
              onChange={(e) =>
                setHolidayForm({
                  ...holidayForm,
                  name: e.target.value,
                })
              }
              placeholder="Holiday name"
              required
            />

            <input
              type="date"
              value={holidayForm.date}
              onChange={(e) =>
                setHolidayForm({
                  ...holidayForm,
                  date: e.target.value,
                })
              }
              required
            />

            <select
              value={holidayForm.type}
              onChange={(e) =>
                setHolidayForm({
                  ...holidayForm,
                  type: e.target.value,
                })
              }
            >
              <option>COMPANY</option>
              <option>PUBLIC</option>
              <option>OPTIONAL</option>
            </select>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowHoliday(false)}
                className="btn-secondary w-full sm:w-auto"
              >
                Cancel
              </button>

              <button
                className="btn-primary w-full sm:w-auto"
                disabled={submittingHoliday}
              >
                {submittingHoliday ? "Adding…" : "Add holiday"}
              </button>
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/40 p-2 backdrop-blur-sm sm:p-4">
      <div className="my-auto max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E2E7E1] bg-white p-4 shadow-2xl sm:max-h-[92vh] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="min-w-0 break-words text-lg font-semibold">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            aria-label="Close modal"
          >
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
        toast.error(
          e?.response?.data?.error || "Failed to load analytics",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  if (!data) {
    return (
      <div className="px-3 py-16 text-center text-sm text-[#8A968C]">
        Analytics could not be loaded.
      </div>
    );
  }

  return user?.role === "ADMIN" ? (
    <AdminAnalytics data={data} />
  ) : (
    <EmployeeAnalytics data={data} />
  );
}