import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CalendarDays,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const dateText = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

function exportChartSvg(event, filename) {
  const svg = event.currentTarget.closest("section")?.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.svg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportChartPng(event, filename) {
  const svg = event.currentTarget.closest("section")?.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true);
  const viewBox = svg.viewBox?.baseVal;
  const sourceWidth = viewBox?.width || svg.clientWidth || 600;
  const sourceHeight = viewBox?.height || svg.clientHeight || 300;
  const scale = Math.max(2, 600 / sourceWidth, 300 / sourceHeight);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(sourceWidth));
  clone.setAttribute("height", String(sourceHeight));
  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(
    new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
  );
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = pngUrl;
        anchor.download = `${filename}.png`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      }, "image/png");
    }
    URL.revokeObjectURL(url);
  };
  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

function Metric({ label, value, hint }) {
  return (
    <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#8A968C]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[#1F2A1F]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[#637066]">{hint}</p>}
    </section>
  );
}

function Trend({
  title,
  rows,
  valueKey,
  format = (v) => String(v),
  empty = "No records available for this period.",
}) {
  const max = Math.max(
    1,
    ...(rows || []).map((row) => Number(row[valueKey] || 0)),
  );
  return (
    <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#4A6F52]" />
        <h2 className="font-semibold text-[#1F2A1F]">{title}</h2>
      </div>
      {!rows?.length ? (
        <p className="py-8 text-center text-sm text-[#8A968C]">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.month || row.label || row.id || row.employeeId || index}
            >
              <div className="mb-1 flex justify-between gap-3 text-xs">
                <span className="text-[#637066]">{row.label || row.month}</span>
                <strong className="text-[#1F2A1F]">
                  {format(row[valueKey])}
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF2ED]">
                <div
                  className="h-full rounded-full bg-[#5E8064]"
                  style={{
                    width: `${Math.max(0, Math.min(100, (Number(row[valueKey] || 0) / max) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AttendanceHeatmap({ records = [], leaves = [] }) {
  const byDate = new Map(records.map((row) => [row.date, row]));
  for (const leave of leaves)
    if (!byDate.has(leave.date)) byDate.set(leave.date, leave);
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const today = new Date(`${todayKey}T00:00:00Z`);
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - 363);
  const days = Array.from({ length: 364 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, record: byDate.get(key) };
  });
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1">
      {days.map(({ date, record }) => (
        <span
          key={date}
          title={`${date}: ${record?.status || "No record"}${record?.workingHours == null ? "" : ` · ${record.workingHours}h`}`}
          className={`h-3 w-3 rounded-[3px] ${!record ? "bg-[#EEF2ED]" : record.status === "LEAVE" ? "bg-[#6688A6]" : record.status === "ABSENT" ? "bg-[#D95B5B]" : record.status === "LATE" ? "bg-[#D5A24C]" : "bg-[#B7E4C0]"}`}
        />
      ))}
    </div>
  );
}

function LinePlot({ title, rows = [], valueKey, labelKey = "label" }) {
  const values = rows.map((row) => Number(row[valueKey] || 0));
  const max = Math.max(1, ...values);
  const points = values
    .map(
      (value, index) =>
        `${values.length <= 1 ? 12 : 12 + index * (276 / (values.length - 1))},${88 - (value / max) * 72}`,
    )
    .join(" ");
  return (
    <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[#1F2A1F]">{title}</h2>
        <div className="no-print flex gap-1">
          <button
            type="button"
            onClick={(event) =>
              exportChartPng(
                event,
                title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              )
            }
            className="rounded-lg border border-[#DDE5DD] px-2 py-1 text-[10px] font-semibold text-[#637066]"
          >
            PNG
          </button>
          <button
            type="button"
            onClick={(event) =>
              exportChartSvg(
                event,
                title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              )
            }
            className="rounded-lg border border-[#DDE5DD] px-2 py-1 text-[10px] font-semibold text-[#637066]"
          >
            SVG
          </button>
        </div>
      </div>
      {rows.length ? (
        <>
          <svg
            viewBox="0 0 300 104"
            role="img"
            aria-label={title}
            className="h-32 w-full overflow-visible"
          >
            <path d="M12 88 H288" stroke="#E5EAE3" strokeWidth="1" />
            <polyline
              points={points}
              fill="none"
              stroke="#5E8064"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {values.map((value, index) => (
              <circle
                key={index}
                cx={
                  values.length <= 1
                    ? 12
                    : 12 + index * (276 / (values.length - 1))
                }
                cy={88 - (value / max) * 72}
                r="3.5"
                fill="#4A6F52"
              >
                <title>{`${rows[index][labelKey] || rows[index].date}: ${value}`}</title>
              </circle>
            ))}
          </svg>
          <div className="flex flex-wrap justify-between gap-2 text-[10px] text-[#829082]">
            {rows
              .filter(
                (_, i) =>
                  i === 0 ||
                  i === rows.length - 1 ||
                  i % Math.max(1, Math.floor(rows.length / 5)) === 0,
              )
              .map((row, i) => (
                <span key={`${row[labelKey]}-${i}`}>
                  {row[labelKey] || row.date}
                </span>
              ))}
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-[#8A968C]">
          No records available for this period.
        </p>
      )}
    </section>
  );
}
function Donut({ title, data = [] }) {
  const total = data.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const colors = ["#5E8064", "#D7A84B", "#C76B63", "#8B9A8D"];
  let offset = 0;
  return (
    <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[#1F2A1F]">{title}</h2>
        <div className="no-print flex gap-1">
          <button
            type="button"
            onClick={(event) =>
              exportChartPng(
                event,
                title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              )
            }
            className="rounded-lg border border-[#DDE5DD] px-2 py-1 text-[10px] font-semibold text-[#637066]"
          >
            PNG
          </button>
          <button
            type="button"
            onClick={(event) =>
              exportChartSvg(
                event,
                title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              )
            }
            className="rounded-lg border border-[#DDE5DD] px-2 py-1 text-[10px] font-semibold text-[#637066]"
          >
            SVG
          </button>
        </div>
      </div>
      {total ? (
        <div className="flex flex-wrap items-center gap-5">
          <svg
            viewBox="0 0 120 120"
            className="h-32 w-32 shrink-0"
            role="img"
            aria-label={title}
          >
            <circle
              cx="60"
              cy="60"
              r="44"
              fill="none"
              stroke="#EEF2ED"
              strokeWidth="16"
            />
            {data.map((row, index) => {
              const value = Number(row.value || 0);
              const dash = (value / total) * 276.46;
              const circle = (
                <circle
                  key={row.label}
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke={colors[index % colors.length]}
                  strokeWidth="16"
                  strokeDasharray={`${dash} ${276.46 - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 60 60)"
                >
                  <title>{`${row.label}: ${value}`}</title>
                </circle>
              );
              offset += dash;
              return circle;
            })}
            <text
              x="60"
              y="64"
              textAnchor="middle"
              fontSize="18"
              fontWeight="600"
              fill="#1F2A1F"
            >
              {total}
            </text>
          </svg>
          <div className="space-y-2">
            {data.map((row, index) => (
              <div
                key={row.label}
                className="flex items-center gap-2 text-xs text-[#637066]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span>{row.label}</span>
                <strong className="text-[#1F2A1F]">{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-[#8A968C]">
          No records available for this period.
        </p>
      )}
    </section>
  );
}
function ScatterPlot({ title, rows = [] }) {
  const points = rows.filter(
    (row) =>
      Number.isFinite(row.attendancePercent) &&
      Number.isFinite(row.performanceRating),
  );
  return (
    <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[#1F2A1F]">{title}</h2>
        <div className="no-print flex gap-1">
          <button
            type="button"
            onClick={(event) =>
              exportChartPng(
                event,
                title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              )
            }
            className="rounded-lg border border-[#DDE5DD] px-2 py-1 text-[10px] font-semibold text-[#637066]"
          >
            PNG
          </button>
          <button
            type="button"
            onClick={(event) =>
              exportChartSvg(
                event,
                title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              )
            }
            className="rounded-lg border border-[#DDE5DD] px-2 py-1 text-[10px] font-semibold text-[#637066]"
          >
            SVG
          </button>
        </div>
      </div>
      {points.length ? (
        <>
          <svg
            viewBox="0 0 300 190"
            className="h-48 w-full"
            role="img"
            aria-label={title}
          >
            <path
              d="M30 12 V158 H288"
              fill="none"
              stroke="#DDE5DD"
              strokeWidth="1.5"
            />
            <text
              x="158"
              y="184"
              textAnchor="middle"
              fontSize="10"
              fill="#829082"
            >
              Attendance %
            </text>
            <text
              x="12"
              y="90"
              textAnchor="middle"
              fontSize="10"
              fill="#829082"
              transform="rotate(-90 12 90)"
            >
              Performance / 5
            </text>
            {points.map((row) => (
              <circle
                key={row.id}
                cx={
                  30 +
                  (Math.max(0, Math.min(100, row.attendancePercent)) / 100) *
                    250
                }
                cy={
                  158 -
                  (Math.max(0, Math.min(5, row.performanceRating)) / 5) * 140
                }
                r="4"
                fill="#5E8064"
              >
                <title>{`${row.name}: ${row.attendancePercent}% attendance, ${row.performanceRating}/5`}</title>
              </circle>
            ))}
          </svg>
          <p className="text-[11px] text-[#829082]">
            Each point represents an employee with both recorded attendance and
            a submitted performance rating.
          </p>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-[#8A968C]">
          No employees have both attendance and performance data in this period.
        </p>
      )}
    </section>
  );
}

export default function EmployeeAnalytics() {
  const { user } = useAuth();
  const [view, setView] = useState("all");
  const [headcountRange, setHeadcountRange] = useState("5m");
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [allData, setAllData] = useState(null);
  const [individual, setIndividual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [range, setRange] = useState("30d");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [comparisonSearch, setComparisonSearch] = useState("");
  const [comparisonSort, setComparisonSort] = useState("attendancePercent");
  const [comparisonPage, setComparisonPage] = useState(1);
  const [teamAverage, setTeamAverage] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [compareEmployeeId, setCompareEmployeeId] = useState("");
  const [compareEmployeeData, setCompareEmployeeData] = useState(null);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(
      (employee) =>
        !q ||
        `${employee.firstName} ${employee.lastName} ${employee.email} ${employee.department || ""}`
          .toLowerCase()
          .includes(q),
    );
  }, [employees, search]);

  const loadBase = useCallback(async () => {
    const [employeeResponse, analyticsResponse] = await Promise.all([
      api.get("/employees"),
      api.get("/analytics", { params: { headcountRange } }),
    ]);
    setEmployees(
      Array.isArray(employeeResponse.data) ? employeeResponse.data : [],
    );
    setAllData(analyticsResponse.data);
  }, [headcountRange]);

  const loadComparison = useCallback(async () => {
    const params = {
      range,
      startDate: range === "custom" ? customStart : undefined,
      endDate: range === "custom" ? customEnd : undefined,
      department: departmentFilter || undefined,
      designation: designationFilter || undefined,
      status: statusFilter || undefined,
      employmentType: employmentTypeFilter || undefined,
      employeeIds: selectedEmployees.join(",") || undefined,
    };
    const { data } = await api.get("/analytics/admin/comparison", { params });
    setComparison(data);
  }, [
    range,
    customStart,
    customEnd,
    departmentFilter,
    designationFilter,
    statusFilter,
    employmentTypeFilter,
    selectedEmployees,
  ]);

  const loadIndividual = useCallback(async (employeeId) => {
    if (!employeeId) {
      setIndividual(null);
      return;
    }
    const { data } = await api.get(`/analytics/admin/employees/${employeeId}`, {
      params: { _refresh: Date.now() },
    });
    setIndividual(data);
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    loadBase()
      .catch((error) =>
        toast.error(
          error?.response?.data?.error || "Unable to load employee analytics",
        ),
      )
      .finally(() => setLoading(false));
  }, [user?.role, loadBase]);

  useEffect(() => {
    if (view !== "individual" || !selectedId) return;
    setRefreshing(true);
    loadIndividual(selectedId)
      .catch((error) => {
        setIndividual(null);
        toast.error(
          error?.response?.data?.error ||
            "Unable to load this employee's analytics",
        );
      })
      .finally(() => setRefreshing(false));
  }, [view, selectedId, loadIndividual]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadBase();
      if (view === "individual" && selectedId) await loadIndividual(selectedId);
      if (
        view === "comparison" &&
        (range !== "custom" || (customStart && customEnd))
      )
        await loadComparison();
      toast.success("Employee analytics refreshed");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const summary = allData?.summary || {};
  const departments = allData?.departmentDistribution || [];
  const person = individual?.employee;
  const detail = individual?.summary || {};
  const exportComparisonCsv = () => {
    if (!comparison?.employees?.length) return;
    const columns = [
      "name",
      "employeeId",
      "department",
      "designation",
      "employmentType",
      "status",
      "attendancePercent",
      "leaveDays",
      "workingHours",
      "overtimeHours",
      "performanceRating",
      "salaryGross",
    ];
    const quote = (value) =>
      `"${String(value ?? "N/A").replaceAll('"', '""')}"`;
    const csv = [
      columns.join(","),
      ...visibleComparisonRows.map((row) =>
        columns
          .map((key) =>
            quote(
              key === "salaryGross" ? (row.salary?.gross ?? "N/A") : row[key],
            ),
          )
          .join(","),
      ),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "employee-comparison.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportComparisonExcel = () => {
    if (!visibleComparisonRows.length) return;
    const columns = [
      "name",
      "employeeId",
      "department",
      "designation",
      "employmentType",
      "status",
      "attendancePercent",
      "leaveDays",
      "workingHours",
      "overtimeHours",
      "performanceRating",
      "salary",
    ];
    const labels = [
      "Employee",
      "Employee ID",
      "Department",
      "Designation",
      "Employment type",
      "Status",
      "Attendance %",
      "Leave days",
      "Working hours",
      "Overtime hours",
      "Performance rating",
      "Current gross salary",
    ];
    const cell = (value) => {
      const numeric = typeof value === "number" && Number.isFinite(value);
      const safe = String(value ?? "N/A")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
      return `<Cell><Data ss:Type="${numeric ? "Number" : "String"}">${safe}</Data></Cell>`;
    };
    const rows = [
      labels,
      ...visibleComparisonRows.map((row) =>
        columns.map((key) =>
          key === "salary" ? (row.salary?.gross ?? "N/A") : (row[key] ?? "N/A"),
        ),
      ),
    ];
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Employee Comparison"><Table>${rows.map((row) => `<Row>${row.map(cell).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`;
    const blob = new Blob([xml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "employee-comparison.xls";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportIndividualPdf = () => {
    if (!person) return;
    window.print();
  };
  const visibleComparisonRows = (comparison?.employees || [])
    .filter((row) =>
      `${row.name} ${row.email} ${row.department} ${row.designation} ${row.employeeId}`
        .toLowerCase()
        .includes(comparisonSearch.toLowerCase()),
    )
    .sort((a, b) => {
      const av = a[comparisonSort];
      const bv = b[comparisonSort];
      if (av == null) return 1;
      if (bv == null) return -1;
      return typeof av === "string" ? av.localeCompare(bv) : bv - av;
    });
  const pageSize = 10;
  const pageRows = visibleComparisonRows.slice(
    (comparisonPage - 1) * pageSize,
    comparisonPage * pageSize,
  );
  const loadNotes = useCallback(async (employeeId) => {
    if (!employeeId) return;
    setNotesLoading(true);
    try {
      const { data } = await api.get(
        `/analytics/admin/employees/${employeeId}/notes`,
      );
      setNotes(data.notes || []);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Unable to load notes");
    } finally {
      setNotesLoading(false);
    }
  }, []);
  const loadTeamAverage = useCallback(async (employeeId) => {
    if (!employeeId) return;
    try {
      const { data } = await api.get("/analytics/admin/team-average", {
        params: { employeeId },
      });
      setTeamAverage(data);
    } catch (error) {
      setTeamAverage(null);
      toast.error(
        error?.response?.data?.error || "Unable to load team average",
      );
    }
  }, []);
  const saveNote = async () => {
    if (!noteDraft.trim() || !selectedId) return;
    try {
      const { data } = await api.post(
        `/analytics/admin/employees/${selectedId}/notes`,
        { body: noteDraft.trim() },
      );
      setNotes((current) => [data.note, ...current]);
      setNoteDraft("");
      toast.success("Admin note saved");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Unable to save note");
    }
  };
  useEffect(() => {
    if (
      view === "comparison" &&
      (range !== "custom" || (customStart && customEnd))
    )
      loadComparison().catch((error) =>
        toast.error(
          error?.response?.data?.error || "Unable to load comparison",
        ),
      );
  }, [view, loadComparison, range, customStart, customEnd]);
  useEffect(() => {
    if (view === "individual" && selectedId) {
      loadNotes(selectedId);
      loadTeamAverage(selectedId);
    } else {
      setNotes([]);
      setTeamAverage(null);
      setCompareEmployeeData(null);
    }
  }, [view, selectedId, loadNotes, loadTeamAverage]);
  useEffect(() => {
    let active = true;
    if (
      view === "individual" &&
      compareEmployeeId &&
      compareEmployeeId !== selectedId
    ) {
      api
        .get(`/analytics/admin/employees/${compareEmployeeId}`)
        .then(({ data }) => {
          if (active) setCompareEmployeeData(data);
        })
        .catch(() => {
          if (active) {
            setCompareEmployeeData(null);
            toast.error("Unable to load comparison employee");
          }
        });
    } else setCompareEmployeeData(null);
    return () => {
      active = false;
    };
  }, [view, compareEmployeeId, selectedId]);

  if (user?.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in print:space-y-2">
      <style>{`@media print { aside, nav, header button, .no-print { display:none !important } body { background:#fff !important } main { margin:0 !important; padding:0 !important } }`}</style>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#6B9B6E]">
            Admin analytics
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1F2A1F] sm:text-3xl">
            Employee Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#697769]">
            Explore live workforce metrics or inspect an individual employee's
            attendance, leave, payroll and performance records.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDE5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#435443] hover:bg-[#F6F8F5] disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </header>

      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          onClick={() => setView("all")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${view === "all" ? "bg-[#E8F3E9] text-[#3E7049] ring-1 ring-[#C9E0CC]" : "bg-white text-[#667466] ring-1 ring-[#E5EAE3]"}`}
        >
          <Users className="mr-2 inline h-4 w-4" />
          All Employees
        </button>
        <button
          onClick={() => setView("comparison")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${view === "comparison" ? "bg-[#E8F3E9] text-[#3E7049] ring-1 ring-[#C9E0CC]" : "bg-white text-[#667466] ring-1 ring-[#E5EAE3]"}`}
        >
          <Users className="mr-2 inline h-4 w-4" />
          Employee Comparison
        </button>
        <button
          onClick={() => setView("individual")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${view === "individual" ? "bg-[#E8F3E9] text-[#3E7049] ring-1 ring-[#C9E0CC]" : "bg-white text-[#667466] ring-1 ring-[#E5EAE3]"}`}
        >
          <Activity className="mr-2 inline h-4 w-4" />
          Individual Employee
        </button>
      </div>

      {view === "all" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Total headcount"
              value={summary.headcount ?? 0}
              hint={`${summary.activeEmployees ?? 0} active employees`}
            />
            <Metric
              label="Departments"
              value={summary.departments ?? 0}
              hint={`${summary.newHiresThisMonth ?? 0} new hires this month`}
            />
            <Metric
              label="Today's attendance"
              value={`${summary.attendanceRateToday ?? 0}%`}
              hint={`${summary.todayLate ?? 0} late arrivals`}
            />
            <Metric
              label="12-month net payroll"
              value={money(summary.payroll12Months)}
              hint={`${summary.leaveRequests12Months ?? 0} leave requests recorded`}
            />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[#1F2A1F]">
                    Headcount growth
                  </h2>
                  <p className="mt-1 text-xs text-[#829082]">
                    Employees by joining date, including historical months
                  </p>
                </div>
                <select
                  aria-label="Headcount time range"
                  value={headcountRange}
                  onChange={(event) => setHeadcountRange(event.target.value)}
                  className="rounded-xl border border-[#DDE5DD] bg-white px-3 py-2 text-xs text-[#435143]"
                >
                  <option value="5m">Last 5 months</option>
                  <option value="1y">Last 1 year</option>
                  <option value="all">All available history</option>
                </select>
              </div>
              <div className="space-y-3">
                {(allData?.headcountTrend || []).length ? (
                  allData.headcountTrend.map((row, index, array) => (
                    <div key={`${row.label}-${index}`}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[#637066]">{row.label}</span>
                        <strong className="text-[#1F2A1F]">
                          {row.count} employees
                        </strong>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-[#EEF2ED]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#9AB99D] to-[#4A6F52]"
                          style={{
                            width: `${Math.max(2, (Number(row.count || 0) / Math.max(1, ...array.map((item) => Number(item.count || 0)))) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-[#8A968C]">
                    No headcount history available.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-[#1F2A1F]">
                Department distribution
              </h2>
              {departments.length ? (
                <div className="space-y-3">
                  {departments.map((row) => (
                    <div key={row.department}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span>{row.department}</span>
                        <strong>
                          {row.count} · {row.percentage}%
                        </strong>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF2ED]">
                        <div
                          className="h-full rounded-full bg-[#5E8064]"
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[#8A968C]">
                  No department data available.
                </p>
              )}
            </section>
            <Trend
              title="Monthly attendance"
              rows={allData?.attendanceTrend}
              valueKey="attendanceRate"
              format={(v) => `${v}%`}
            />
            <Trend
              title="Net payroll trend"
              rows={allData?.payrollTrend}
              valueKey="totalNet"
              format={money}
            />
            <Trend
              title="Leave requests over time"
              rows={[...(allData?.leaveTrend || [])].reverse()}
              valueKey="total"
              format={(v) => `${v} requests`}
            />
          </div>
        </>
      ) : view === "comparison" ? (
        <>
          <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs font-semibold text-[#536354]">
                Date range
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#DDE5DD] bg-white px-3 py-2.5 text-sm"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="month">This month</option>
                  <option value="quarter">This quarter</option>
                  <option value="year">This year</option>
                  <option value="custom">Custom range</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#536354]">
                Department
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#DDE5DD] bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">All departments</option>
                  {[
                    ...new Set(
                      employees.map((e) => e.department).filter(Boolean),
                    ),
                  ]
                    .sort()
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#536354]">
                Designation
                <input
                  value={designationFilter}
                  onChange={(e) => setDesignationFilter(e.target.value)}
                  placeholder="Filter designation"
                  className="mt-1 block w-full rounded-xl border border-[#DDE5DD] px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-[#536354]">
                Employment type
                <select
                  value={employmentTypeFilter}
                  onChange={(e) => setEmploymentTypeFilter(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#DDE5DD] bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">All types</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                  <option value="TEMPORARY">Temporary</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#536354]">
                Employee status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#DDE5DD] bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#536354]">
                Select employees (optional)
                <select
                  multiple
                  value={selectedEmployees}
                  onChange={(e) =>
                    setSelectedEmployees(
                      [...e.target.selectedOptions].map((o) => o.value),
                    )
                  }
                  className="mt-1 block h-[42px] w-full rounded-xl border border-[#DDE5DD] bg-white px-2 py-1 text-xs"
                >
                  {employees.map((e) => (
                    <option key={e.id || e._id} value={e.id || e._id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </label>
              {range === "custom" && (
                <>
                  <label className="text-xs font-semibold text-[#536354]">
                    Start date
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-[#DDE5DD] px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#536354]">
                    End date
                    <input
                      type="date"
                      min={customStart || undefined}
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-[#DDE5DD] px-3 py-2.5 text-sm"
                    />
                  </label>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-[#829082]">
              Filters are applied to the backend employee and date queries.
              Legacy employees without an employment type appear only when no
              type filter is selected.{" "}
              {range === "custom" && (!customStart || !customEnd)
                ? "Select both dates to load the custom range."
                : ""}
            </p>
          </section>
          {comparison ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label="Total employees"
                  value={comparison.summary.totalEmployees}
                />
                <Metric
                  label="Active employees"
                  value={comparison.summary.activeEmployees}
                />
                <Metric
                  label="Average attendance"
                  value={
                    comparison.summary.averageAttendance == null
                      ? "N/A"
                      : `${comparison.summary.averageAttendance}%`
                  }
                  hint="Based on recorded attendance rows"
                />
                <Metric
                  label="Productivity score"
                  value="N/A"
                  hint="No productivity KPI records exist"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Metric
                  label="Total working hours"
                  value={`${comparison.summary.totalWorkingHours} h`}
                />
                <Metric
                  label="Overtime hours"
                  value={
                    comparison.summary.totalOvertimeHours > 0
                      ? `${comparison.summary.totalOvertimeHours} h`
                      : "N/A"
                  }
                  hint="From finalized payroll snapshots"
                />
                <Metric
                  label="Total leave taken"
                  value={`${comparison.summary.totalLeaveTaken} days`}
                />
                <Metric
                  label="Average performance rating"
                  value={
                    comparison.summary.averagePerformanceRating == null
                      ? "N/A"
                      : `${comparison.summary.averagePerformanceRating}/5`
                  }
                />
              </div>
              <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#1F2A1F]">
                      Attendance comparison
                    </h2>
                    <p className="text-xs text-[#829082]">
                      Employees with no attendance records are shown as N/A.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={exportComparisonCsv}
                      className="rounded-xl border border-[#DDE5DD] px-3 py-2 text-xs font-semibold text-[#435443]"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={exportComparisonExcel}
                      className="rounded-xl border border-[#DDE5DD] px-3 py-2 text-xs font-semibold text-[#435443]"
                    >
                      Export Excel
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {[...comparison.employees]
                    .sort(
                      (a, b) =>
                        (b.attendancePercent ?? -1) -
                        (a.attendancePercent ?? -1),
                    )
                    .map((row) => (
                      <div key={row.id}>
                        <div className="mb-1 flex justify-between gap-3 text-xs">
                          <span className="font-medium text-[#435443]">
                            {row.name}
                          </span>
                          <strong>
                            {row.attendancePercent == null
                              ? "N/A"
                              : `${row.attendancePercent}%`}
                          </strong>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF2ED]">
                          <div
                            className="h-full rounded-full bg-[#5E8064]"
                            style={{
                              width: `${Math.max(0, Math.min(100, row.attendancePercent || 0))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </section>
              <div className="grid gap-5 xl:grid-cols-2">
                <ScatterPlot
                  title="Attendance vs performance"
                  rows={comparison.employees || []}
                />
                <Trend
                  title="Working hours by employee"
                  rows={(comparison.employees || [])
                    .slice()
                    .sort((a, b) => b.workingHours - a.workingHours)}
                  valueKey="workingHours"
                  format={(v) => `${v} h`}
                />
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <Donut
                  title="Attendance status distribution"
                  data={Object.entries(
                    comparison.attendanceStatusDistribution || {},
                  ).map(([label, value]) => ({
                    label:
                      label === "approvedLeaveDays"
                        ? "Approved leave days"
                        : label.replace(
                            /[A-Z]/g,
                            (letter) => ` ${letter.toLowerCase()}`,
                          ),
                    value: Number(value || 0),
                  }))}
                />
                <LinePlot
                  title="Daily attendance trend · present records"
                  rows={comparison.attendanceTrend || []}
                  valueKey="present"
                  labelKey="date"
                />
              </div>
              <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-semibold text-[#1F2A1F]">
                  Leave days by employee and category
                </h2>
                {comparison.employees?.length ? (
                  <div className="space-y-3">
                    {comparison.employees.map((row) => {
                      const types = Object.entries(row.leaveTypeDays || {});
                      const total = types.reduce(
                        (sum, item) => sum + Number(item[1] || 0),
                        0,
                      );
                      return (
                        <div key={row.id}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span>{row.name}</span>
                            <strong>{total.toFixed(1)} days</strong>
                          </div>
                          <div className="flex h-3 overflow-hidden rounded-full bg-[#EEF2ED]">
                            {types.map(([type, days], index) => (
                              <div
                                key={type}
                                title={`${type}: ${days}`}
                                style={{
                                  width: `${total ? (days / total) * 100 : 0}%`,
                                  background: [
                                    "#5E8064",
                                    "#D5A24C",
                                    "#6688A6",
                                    "#C96D65",
                                  ][index % 4],
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#829082]">
                    No employee leave data.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-semibold text-[#1F2A1F]">
                  Approved leave by category
                </h2>
                {comparison.leaveByType?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {comparison.leaveByType.map((item) => (
                      <div
                        key={item.type}
                        className="rounded-xl bg-[#F6F8F5] p-3"
                      >
                        <p className="text-xs font-semibold text-[#637066]">
                          {item.type}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-[#1F2A1F]">
                          {item.days} days
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#829082]">
                    No approved leave records for this period.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-semibold text-[#1F2A1F]">
                  Leave days by employee
                </h2>
                {comparison.leaveByEmployee?.length ? (
                  <div className="space-y-3">
                    {comparison.leaveByEmployee
                      .slice()
                      .sort((a, b) => b.days - a.days)
                      .map((row) => (
                        <div key={row.employeeId}>
                          <div className="mb-1 flex justify-between gap-3 text-xs">
                            <span>{row.name}</span>
                            <strong>{row.days} days</strong>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF2ED]">
                            <div
                              className="h-full rounded-full bg-[#D7A84B]"
                              style={{
                                width: `${Math.max(0, Math.min(100, (row.days / Math.max(1, ...comparison.leaveByEmployee.map((item) => item.days))) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#829082]">
                    No approved leave records for this period.
                  </p>
                )}
              </section>
              <section className="overflow-hidden rounded-2xl border border-[#E2E7E1] bg-white">
                <div className="border-b border-[#E8ECE7] p-5">
                  <h2 className="font-semibold text-[#1F2A1F]">
                    Employee comparison table
                  </h2>
                  <p className="mt-1 text-xs text-[#829082]">
                    Salary is restricted to administrators. Values are current
                    salary structures, not historical CTC.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={comparisonSearch}
                      onChange={(e) => {
                        setComparisonSearch(e.target.value);
                        setComparisonPage(1);
                      }}
                      placeholder="Search employees"
                      className="rounded-lg border border-[#DDE5DD] px-3 py-2 text-xs"
                    />
                    <select
                      value={comparisonSort}
                      onChange={(e) => setComparisonSort(e.target.value)}
                      className="rounded-lg border border-[#DDE5DD] px-3 py-2 text-xs"
                    >
                      <option value="attendancePercent">
                        Sort: Attendance
                      </option>
                      <option value="name">Sort: Name</option>
                      <option value="leaveDays">Sort: Leave</option>
                      <option value="workingHours">Sort: Working hours</option>
                      <option value="performanceRating">Sort: Rating</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[1320px] w-full text-left text-xs">
                    <thead className="bg-[#F6F8F5] text-[#637066]">
                      <tr>
                        {[
                          "Employee",
                          "Employee ID",
                          "Department",
                          "Designation",
                          "Employment type",
                          "Status",
                          "Attendance",
                          "Leave days",
                          "Working hours",
                          "Overtime",
                          "Rating",
                          "Current gross",
                        ].map((h) => (
                          <th key={h} className="px-4 py-3 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => (
                        <tr key={row.id} className="border-t border-[#EEF1EC]">
                          <td className="px-4 py-3">
                            <strong>{row.name}</strong>
                            <div className="text-[#829082]">{row.email}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px]">
                            {row.employeeId}
                          </td>
                          <td className="px-4 py-3">{row.department}</td>
                          <td className="px-4 py-3">{row.designation}</td>
                          <td className="px-4 py-3">
                            {row.employmentType || "N/A"}
                          </td>
                          <td className="px-4 py-3">{row.status}</td>
                          <td className="px-4 py-3">
                            {row.attendancePercent == null
                              ? "N/A"
                              : `${row.attendancePercent}%`}
                          </td>
                          <td className="px-4 py-3">{row.leaveDays}</td>
                          <td className="px-4 py-3">{row.workingHours}</td>
                          <td className="px-4 py-3">
                            {row.overtimeHours > 0 ? row.overtimeHours : "N/A"}
                          </td>
                          <td className="px-4 py-3">
                            {row.performanceRating == null
                              ? "N/A"
                              : `${row.performanceRating}/5`}
                          </td>
                          <td className="px-4 py-3">
                            {row.salary ? money(row.salary.gross) : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[#EEF1EC] px-4 py-3 text-xs text-[#637066]">
                  <span>
                    {visibleComparisonRows.length} employees · Page{" "}
                    {comparisonPage} of{" "}
                    {Math.max(
                      1,
                      Math.ceil(visibleComparisonRows.length / pageSize),
                    )}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={comparisonPage <= 1}
                      onClick={() => setComparisonPage((p) => p - 1)}
                      className="rounded border px-3 py-1.5 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      disabled={
                        comparisonPage >=
                        Math.ceil(visibleComparisonRows.length / pageSize)
                      }
                      onClick={() => setComparisonPage((p) => p + 1)}
                      className="rounded border px-3 py-1.5 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>
              <p className="text-xs text-[#829082]">
                Unavailable without source records: productivity score,
                task/project contribution and login activity. Overtime and
                salary progression appear only where finalized payroll snapshots
                and salary history exist.
              </p>
            </>
          ) : (
            <Loading />
          )}
        </>
      ) : (
        <>
          <section className="no-print rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(260px,2fr)]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#536354]">
                  Search employee
                </span>
                <span className="relative block">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968C]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, email or department"
                    className="w-full rounded-xl border border-[#DDE5DD] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#6B9B6E]"
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#536354]">
                  Select employee
                </span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-xl border border-[#DDE5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6B9B6E]"
                >
                  <option value="">Choose an employee</option>
                  {filteredEmployees.map((employee) => (
                    <option
                      key={employee.id || employee._id}
                      value={employee.id || employee._id}
                    >
                      {employee.firstName} {employee.lastName} ·{" "}
                      {employee.department || "Unassigned"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          {!selectedId ? (
            <div className="rounded-2xl border border-dashed border-[#DDE5DD] bg-white py-14 text-center text-sm text-[#8A968C]">
              Select an employee to view their detailed analytics.
            </div>
          ) : refreshing && !individual ? (
            <Loading />
          ) : (
            person && (
              <>
                <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-5">
                  {person.profilePhotoUrl ? (
                    <img
                      src={person.profilePhotoUrl}
                      alt=""
                      className="h-16 w-16 rounded-full border border-[#DCE9DE] object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E4EEE5] text-lg font-semibold text-[#4A6F52]">
                      {person.firstName?.[0]}
                      {person.lastName?.[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#4A6F52]">
                      Employee profile
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[#1F2A1F]">
                      {person.firstName} {person.lastName}
                    </h2>
                    <p className="mt-1 text-sm text-[#637066]">
                      {person.position} · {person.department} ·{" "}
                      {person.employmentStatus}
                    </p>
                    <p className="mt-1 text-xs text-[#829082]">
                      {person.email} · Employee ID{" "}
                      {person.employeeId || person.id} · Joined{" "}
                      {dateText(person.joinDate)}
                      {person.reportingManager?.name
                        ? ` · Reports to ${person.reportingManager.name}`
                        : ""}
                    </p>
                    <p className="mt-1 text-[10px] text-[#829082]">
                      Report generated {dateText(new Date())} · Analytics
                      period: last 12 months
                    </p>
                  </div>
                  <button
                    onClick={exportIndividualPdf}
                    className="ml-auto rounded-xl border border-[#DDE5DD] bg-white px-3 py-2 text-xs font-semibold text-[#435443]"
                  >
                    Print / Save PDF
                  </button>
                </section>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Attendance rate"
                    value={`${detail.attendanceRate ?? 0}%`}
                    hint={`${detail.attendanceRecords ?? 0} attendance records`}
                  />
                  <Metric
                    label="Performance rating"
                    value={
                      detail.averagePerformanceRating == null
                        ? "N/A"
                        : `${detail.averagePerformanceRating}/5`
                    }
                    hint="Submitted reviews in the last 12 months"
                  />
                  <Metric
                    label="Late arrivals"
                    value={detail.lateArrivals ?? 0}
                    hint={`${detail.averageWorkingHours ?? 0} average hours`}
                  />
                  <Metric
                    label="Leave requests"
                    value={detail.leaveRequests ?? 0}
                    hint={`${detail.approvedLeaveDays ?? 0} approved leave days · ${detail.lopDays == null ? "LOP split N/A for partial range overlaps" : `${detail.lopDays} LOP days`}`}
                  />
                  <Metric
                    label="Latest payslip deductions"
                    value={
                      detail.latestPayslipDeductions == null
                        ? "N/A"
                        : money(detail.latestPayslipDeductions)
                    }
                  />
                  <Metric
                    label="Net payroll"
                    value={money(detail.netPayroll)}
                    hint={`${detail.publishedPayslips ?? 0} published payslips · ${detail.departmentSharePercent ?? 0}% department share`}
                  />
                </div>
                {detail.leaveBalance && (
                  <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                    <h2 className="mb-3 font-semibold text-[#1F2A1F]">
                      Current-year leave balance
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {["sick", "casual", "emergency", "annual"].map((type) => (
                        <div key={type} className="rounded-xl bg-[#F6F8F5] p-3">
                          <p className="text-xs capitalize text-[#637066]">
                            {type}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-[#1F2A1F]">
                            {detail.leaveBalance[type]?.remaining ?? "N/A"}{" "}
                            <span className="text-xs font-normal text-[#829082]">
                              / {detail.leaveBalance[type]?.total ?? "—"}
                            </span>
                          </p>
                          <p className="text-[11px] text-[#829082]">
                            {detail.leaveBalance[type]?.used ?? 0} used ·{" "}
                            {detail.leaveBalance[type]?.pending ?? 0} pending
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                    <h2 className="mb-3 font-semibold text-[#1F2A1F]">
                      Attendance calendar · recorded days
                    </h2>
                    {individual.attendanceCalendar?.length ||
                    individual.leaveCalendar?.length ? (
                      <AttendanceHeatmap
                        records={individual.attendanceCalendar || []}
                        leaves={individual.leaveCalendar || []}
                      />
                    ) : (
                      <p className="text-sm text-[#829082]">
                        No calendar attendance records.
                      </p>
                    )}
                    <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#829082]">
                      <span>
                        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#B7E4C0]" />
                        Present
                      </span>
                      <span>
                        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#D95B5B]" />
                        Absent
                      </span>
                      <span>
                        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#D5A24C]" />
                        Late
                      </span>
                      <span>
                        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#6688A6]" />
                        Approved leave
                      </span>
                      <span>Blank: no recorded day</span>
                    </p>
                  </section>
                  <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                    <h2 className="mb-3 font-semibold text-[#1F2A1F]">
                      Approved leave by type
                    </h2>
                    {individual.leaveByType?.length ? (
                      <div className="space-y-3">
                        {individual.leaveByType.map((row) => (
                          <div key={row.type}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span>{row.type}</span>
                              <strong>{row.days} days</strong>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF2ED]">
                              <div
                                className="h-full rounded-full bg-[#5E8064]"
                                style={{
                                  width: `${Math.min(100, (row.days / Math.max(1, ...individual.leaveByType.map((item) => item.days))) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#829082]">
                        No approved leave records.
                      </p>
                    )}
                  </section>
                </div>
                <section className="no-print rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold text-[#1F2A1F]">
                      Compare with team average
                    </h2>
                    <span className="text-xs text-[#829082]">
                      Last 30 days ·{" "}
                      {teamAverage?.department || person.department}
                    </span>
                  </div>
                  {teamAverage ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ["Attendance", teamAverage.averageAttendance, "%"],
                        [
                          "Avg hours / record",
                          teamAverage.averageWorkingHours,
                          " h",
                        ],
                        [
                          "Approved leave",
                          teamAverage.averageLeaveDays,
                          " days",
                        ],
                        [
                          "Performance",
                          teamAverage.averagePerformanceRating,
                          " /5",
                        ],
                      ].map(([label, value, suffix]) => (
                        <div
                          key={label}
                          className="rounded-xl bg-[#F6F8F5] p-3"
                        >
                          <p className="text-xs text-[#637066]">
                            Team average · {label}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-[#1F2A1F]">
                            {value == null ? "N/A" : `${value}${suffix}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#829082]">
                      Team comparison is unavailable until team records are
                      loaded.
                    </p>
                  )}
                </section>
                <section className="no-print rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold text-[#1F2A1F]">
                      Compare with another employee
                    </h2>
                    <select
                      value={compareEmployeeId}
                      onChange={(e) => setCompareEmployeeId(e.target.value)}
                      className="rounded-xl border border-[#DDE5DD] bg-white px-3 py-2 text-xs"
                    >
                      <option value="">Select a colleague</option>
                      {employees
                        .filter((e) => (e.id || e._id) !== selectedId)
                        .map((e) => (
                          <option key={e.id || e._id} value={e.id || e._id}>
                            {e.firstName} {e.lastName}
                          </option>
                        ))}
                    </select>
                  </div>
                  {compareEmployeeData ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        [
                          "Attendance",
                          detail.attendanceRate,
                          compareEmployeeData.summary?.attendanceRate,
                          "%",
                        ],
                        [
                          "Average hours",
                          detail.averageWorkingHours,
                          compareEmployeeData.summary?.averageWorkingHours,
                          " h",
                        ],
                        [
                          "Paid leave",
                          detail.approvedLeaveDays,
                          compareEmployeeData.summary?.approvedLeaveDays,
                          " days",
                        ],
                        [
                          "Performance",
                          detail.averagePerformanceRating,
                          compareEmployeeData.summary?.averagePerformanceRating,
                          " /5",
                        ],
                      ].map(([label, a, b, suffix]) => (
                        <div
                          key={label}
                          className="rounded-xl bg-[#F6F8F5] p-3"
                        >
                          <p className="text-xs text-[#637066]">{label}</p>
                          <p className="mt-1 text-sm font-semibold">
                            {person.firstName}:{" "}
                            {a == null ? "N/A" : `${a}${suffix}`}
                          </p>
                          <p className="text-sm font-semibold">
                            {compareEmployeeData.employee?.firstName}:{" "}
                            {b == null ? "N/A" : `${b}${suffix}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#829082]">
                      Select another employee to compare recorded metrics.
                    </p>
                  )}
                </section>
                {individual.currentSalary && (
                  <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                    <h2 className="mb-3 font-semibold text-[#1F2A1F]">
                      Current salary structure
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ["Basic", individual.currentSalary.basic],
                        ["HRA", individual.currentSalary.hra],
                        ["Allowances", individual.currentSalary.allowances],
                        ["Gross monthly", individual.currentSalary.gross],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-xl bg-[#F6F8F5] p-3"
                        >
                          <p className="text-xs text-[#637066]">{label}</p>
                          <p className="mt-1 font-semibold">{money(value)}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-[#829082]">
                      Effective{" "}
                      {dateText(individual.currentSalary.effectiveFrom)}.
                      Visible only to administrators.
                    </p>
                    {detail.latestPayslipDeductions != null && (
                      <p className="mt-2 text-xs text-[#637066]">
                        Latest published payslip deductions:{" "}
                        <strong>{money(detail.latestPayslipDeductions)}</strong>
                      </p>
                    )}
                  </section>
                )}
                <section className="no-print rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                  <h2 className="font-semibold text-[#1F2A1F]">Admin notes</h2>
                  <p className="mt-1 text-xs text-[#829082]">
                    Private HR notes. Visible only to authorized administrators
                    and retained in the audit trail.
                  </p>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    maxLength={4000}
                    rows={3}
                    placeholder="Add a confidential employee note..."
                    className="mt-3 w-full rounded-xl border border-[#DDE5DD] p-3 text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={saveNote}
                      disabled={!noteDraft.trim()}
                      className="rounded-xl bg-[#4A6F52] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Save note
                    </button>
                  </div>
                  {notesLoading ? (
                    <p className="mt-3 text-sm text-[#829082]">
                      Loading notes…
                    </p>
                  ) : notes.length ? (
                    <div className="mt-4 space-y-3">
                      {notes.map((note) => (
                        <article
                          key={note._id}
                          className="rounded-xl bg-[#F7F9F6] p-3"
                        >
                          <p className="whitespace-pre-wrap text-sm text-[#435443]">
                            {note.body}
                          </p>
                          <p className="mt-2 text-[11px] text-[#829082]">
                            {note.author?.name ||
                              note.author?.email ||
                              "Administrator"}{" "}
                            · {dateText(note.createdAt)}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[#829082]">
                      No admin notes recorded.
                    </p>
                  )}
                </section>
                {Object.keys(individual.goalStatusSummary || {}).length > 0 && (
                  <section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm">
                    <h2 className="mb-3 font-semibold text-[#1F2A1F]">
                      Performance goals
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {Object.entries(individual.goalStatusSummary).map(
                        ([status, count]) => (
                          <div
                            key={status}
                            className="rounded-xl bg-[#F6F8F5] p-3"
                          >
                            <p className="text-xs text-[#637066]">
                              {status.replaceAll("_", " ")}
                            </p>
                            <p className="mt-1 text-xl font-semibold text-[#1F2A1F]">
                              {count}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                )}
                <div className="grid gap-5 xl:grid-cols-2">
                  <Donut
                    title="Approved leave by type"
                    data={(individual.leaveByType || []).map((row) => ({
                      label: row.type,
                      value: row.days,
                    }))}
                  />
                  <LinePlot
                    title="Monthly attendance records"
                    rows={individual.attendanceTrend || []}
                    valueKey="records"
                  />
                  <LinePlot
                    title="Daily working hours"
                    rows={(individual.attendanceCalendar || [])
                      .filter((row) => row.workingHours != null)
                      .map((row) => ({
                        label: row.date,
                        hours: row.workingHours,
                      }))}
                    valueKey="hours"
                  />
                  <LinePlot
                    title="Performance review ratings"
                    rows={(individual.performanceReviews || [])
                      .filter((row) => row.rating)
                      .slice()
                      .reverse()
                      .map((row) => ({
                        label: row.period,
                        rating: row.rating,
                      }))}
                    valueKey="rating"
                  />
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  {individual.overtimeTrend?.length > 0 && (
                    <Trend
                      title="Overtime trend · finalized payroll snapshots"
                      rows={individual.overtimeTrend}
                      valueKey="overtimeHours"
                      format={(v) => `${v} h`}
                    />
                  )}
                  {individual.salaryProgression?.length > 1 && (
                    <Trend
                      title="Gross salary progression"
                      rows={individual.salaryProgression.map((row) => ({
                        label: dateText(row.effectiveFrom),
                        gross: row.gross,
                      }))}
                      valueKey="gross"
                      format={money}
                    />
                  )}
                </div>
              </>
            )
          )}
        </>
      )}
      <p className="text-right text-[10px] text-[#8A968C]">
        Task/project contribution, login activity and benefit history are
        unavailable because this project has no corresponding source modules.
        Figures are calculated from saved EMS records. Report generated:{" "}
        {dateText(individual?.generatedAt || new Date())}. Individual payroll
        and employee details are admin-only.
      </p>
    </div>
  );
}
