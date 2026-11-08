
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Archive,
  RotateCcw,
  Search,
  UserRound,
  Eye,
} from "lucide-react";

import api from "../api/axios";
import Loading from "../components/Loading";
import toast from "react-hot-toast";
import { Link, useLocation } from "react-router-dom";

export default function ArchivedEmployees() {
  const location = useLocation();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // ================= LOAD ARCHIVED EMPLOYEES =================

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const { data } = await api.get(
        "/employees/archived",
        {
          headers: {
            "Cache-Control": "no-cache",
          },
        },
      );

      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(
        "Failed to load archived employees:",
        e,
      );

      toast.error(
        e?.response?.data?.error ||
          "Failed to load archived employees",
      );

      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ================= LOAD ON PAGE ENTRY =================

  useEffect(() => {
    load();
  }, [load, location.pathname]);

  // ================= FILTER =================

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    if (!query) return items;

    return items.filter((e) =>
      [
        e.firstName,
        e.lastName,
        e.email,
        e.department,
        e.position,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, q]);

  // ================= RESTORE EMPLOYEE =================

  const restore = async (id) => {
    const confirmed = window.confirm(
      "Restore this employee? Their existing attendance, leave and payslip history will remain intact.",
    );

    if (!confirmed) return;

    try {
      await api.patch(
        `/employees/${id}/restore`,
      );

      toast.success(
        "Employee restored successfully",
      );

      // Immediately remove restored employee from archived UI
      setItems((previous) =>
        previous.filter(
          (employee) =>
            String(employee.id || employee._id) !== String(id),
        ),
      );

      // Re-fetch to ensure UI and database stay synced
      await load();
    } catch (e) {
      console.error(
        "Failed to restore employee:",
        e,
      );

      toast.error(
        e?.response?.data?.error ||
          "Failed to restore employee",
      );
    }
  };

  // ================= LOADING =================

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-w-0 space-y-4 animate-fade-in sm:space-y-6">

      {/* ================= HEADER ================= */}

      <header className="rounded-2xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-5 sm:rounded-3xl sm:p-8">

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

          <div className="min-w-0">

            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
              Admin only
            </p>

            <h1 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">
              Archived Employees
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#637066]">
              Soft-deleted employee records. Restore instead of creating
              duplicates.
            </p>

          </div>

          <div className="w-fit rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold shadow-sm">
            {items.length} archived
          </div>

        </div>

      </header>

      {/* ================= SEARCH ================= */}

      <div className="relative min-w-0">

        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968C]" />

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search archived employees…"
          className="w-full min-w-0 pl-10"
        />

      </div>

      {/* ================= TABLE ================= */}

      <div className="min-w-0 overflow-hidden rounded-2xl border border-[#E2E7E1] bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="table-modern min-w-[760px]">

            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Department</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>

              {filtered.map((e) => {
                const employeeId = e.id || e._id;

                return (
                  <tr key={employeeId}>

                    <td>
                      <div className="flex items-center gap-3">

                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDF4EE] text-xs font-semibold text-[#4A6F52]">
                          <UserRound className="h-4 w-4" />
                        </span>

                        <div className="min-w-0">
                          <p className="font-semibold">
                            {e.firstName} {e.lastName}
                          </p>

                          <p className="text-xs text-[#8A968C]">
                            {e.email}
                          </p>
                        </div>

                      </div>
                    </td>

                    <td>
                      {e.position || "—"}
                    </td>

                    <td>
                      {e.department || "—"}
                    </td>

                    <td>
                      <span className="badge whitespace-nowrap bg-[#FEF3F2] text-[#D92D20]">
                        ARCHIVED
                      </span>
                    </td>

                    <td>
                      {e.joinDate
                        ? new Date(
                            e.joinDate,
                          ).toLocaleDateString("en-IN")
                        : "—"}
                    </td>

                    <td>
                      <div className="flex justify-end gap-2">

                        <Link
                          to={`/employees/${employeeId}`}
                          className="btn-secondary inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>

                        <button
                          type="button"
                          onClick={() => restore(employeeId)}
                          className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td
                    colSpan="6"
                    className="py-16 text-center"
                  >

                    <Archive className="mx-auto h-8 w-8 text-[#9DB6A2]" />

                    <p className="mt-3 text-sm text-[#8A968C]">
                      {q
                        ? "No archived employees match your search."
                        : "No archived employees."}
                    </p>

                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

        {filtered.length > 0 && (
          <div className="border-t border-[#E2E7E1] px-3 py-2 text-center sm:hidden">
            <p className="text-xs text-[#8A968C]">
              Scroll horizontally to view all columns
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
