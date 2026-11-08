
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { DEPARTMENTS } from "../assets/assets";

import {
  Plus,
  X,
  Users,
  Search,
  Archive,
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigationType,
} from "react-router-dom";

import EmployeeCard from "../components/EmployeeCard";
import EmployeeFrom from "../components/EmployeeFrom";

import api from "../api/axios";
import toast from "react-hot-toast";
import Loading from "../components/Loading";

export default function Employees() {
  const location = useLocation();
  const navigationType = useNavigationType();

  const [employee, setEmployee] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectDept, setDept] = useState("");

  const [editEmployee, setEditEmployee] = useState(null);
  const [showCreateModel, setShowCreateModel] = useState(false);

  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ================= FETCH EMPLOYEES =================

  const fetchEmployee = useCallback(
    async (showLoader = true) => {
      const currentRequest = ++requestRef.current;

      if (showLoader) {
        setLoading(true);
      }

      try {
        const url = selectDept
          ? `/employees?department=${encodeURIComponent(selectDept)}`
          : "/employees";

        const res = await api.get(url, {
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (
          mountedRef.current &&
          currentRequest === requestRef.current
        ) {
          setEmployee(Array.isArray(res.data) ? res.data : []);
        }
      } catch (error) {
        if (
          mountedRef.current &&
          currentRequest === requestRef.current
        ) {
          console.error("Failed to load employees:", error);

          toast.error(
            error?.response?.data?.error ||
              "Failed to load employees",
          );

          setEmployee([]);
        }
      } finally {
        if (
          mountedRef.current &&
          currentRequest === requestRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [selectDept],
  );

  // ================= LOAD WHEN PAGE OPENS =================

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  // ================= REFRESH WHEN RETURNING FROM ARCHIVED =================

  useEffect(() => {
    if (location.pathname === "/employees") {
      fetchEmployee();
    }
  }, [location.pathname, navigationType, fetchEmployee]);

  // ================= FILTER EMPLOYEES =================

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return employee;

    return employee.filter((e) =>
      [
        e.firstName,
        e.lastName,
        e.position,
        e.email,
        e.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [employee, search]);

  // ================= REFRESH HANDLER =================

  const handleEmployeeChanged = async () => {
    await fetchEmployee(false);
  };

  return (
    <div className="min-w-0 space-y-4 animate-fade-in sm:space-y-6">

      {/* ================= PAGE HEADER ================= */}

      <header className="rounded-2xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-5 sm:rounded-3xl sm:p-8">

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

          <div className="min-w-0">

            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
              People directory
            </p>

            <h1 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">
              Employees
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#637066]">
              Manage active workforce records while preserving history through
              safe archiving.
            </p>

          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">

            <Link
              to="/employees/archived"
              className="btn-secondary inline-flex min-w-0 flex-1 items-center justify-center gap-2 sm:flex-none"
            >
              <Archive className="h-4 w-4 shrink-0" />
              <span>Archived</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowCreateModel(true)}
              className="btn-primary inline-flex min-w-0 flex-1 items-center justify-center gap-2 sm:flex-none"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Add employee</span>
            </button>

          </div>

        </div>

      </header>

      {/* ================= SEARCH AND FILTER ================= */}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_240px]">

        <div className="relative min-w-0">

          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968C]" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, role or department…"
            className="w-full min-w-0 pl-10"
          />

        </div>

        <select
          value={selectDept}
          onChange={(e) => setDept(e.target.value)}
          className="w-full min-w-0"
        >

          <option value="">
            All departments
          </option>

          {DEPARTMENTS.map((d) => (
            <option
              key={d}
              value={d}
            >
              {d}
            </option>
          ))}

        </select>

      </div>

      {/* ================= EMPLOYEE LIST ================= */}

      {loading ? (

        <Loading />

      ) : filtered.length ? (

        <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">

          {filtered.map((e) => (

            <EmployeeCard
              key={e.id || e._id}
              employee={e}
              onDelete={handleEmployeeChanged}
              onEdit={setEditEmployee}
            />

          ))}

        </div>

      ) : (

        <div className="rounded-2xl border border-dashed border-[#D7DDD5] bg-white px-4 py-12 text-center sm:py-16">

          <Users className="mx-auto h-8 w-8 text-[#9DB6A2]" />

          <h2 className="mt-3 font-semibold">
            No employees found
          </h2>

          <p className="mt-1 text-sm text-[#8A968C]">
            {search || selectDept
              ? "Try a different search or department."
              : "Create the first employee record."}
          </p>

        </div>

      )}

      {/* ================= CREATE MODAL ================= */}

      {showCreateModel && (

        <Modal
          title="Create employee"
          onClose={() => setShowCreateModel(false)}
        >

          <EmployeeFrom
            onSuccess={async () => {

              setShowCreateModel(false);

              await fetchEmployee(false);

            }}
            onCancel={() => setShowCreateModel(false)}
          />

        </Modal>

      )}

      {/* ================= EDIT MODAL ================= */}

      {editEmployee && (

        <Modal
          title="Update employee"
          onClose={() => setEditEmployee(null)}
          large
        >

          <EmployeeFrom
            initialData={editEmployee}
            onSuccess={async () => {

              setEditEmployee(null);

              await fetchEmployee(false);

            }}
            onCancel={() => setEditEmployee(null)}
          />

        </Modal>

      )}

    </div>
  );
}

function Modal({
  children,
  title,
  onClose,
  large,
}) {
  return (

    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`my-3 w-full min-w-0 rounded-2xl border border-[#E2E7E1] bg-white p-4 shadow-2xl sm:my-8 sm:p-6 ${
          large
            ? "max-w-5xl"
            : "max-w-3xl"
        }`}
      >

        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#E2E7E1] pb-4 sm:mb-5">

          <h2 className="min-w-0 break-words text-base font-semibold sm:text-lg">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 transition hover:bg-[#F4F7F3]"
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
