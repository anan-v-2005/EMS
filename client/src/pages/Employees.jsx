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

        // Prevent old requests from overwriting newer data
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
    <div className="space-y-6 animate-fade-in">

      {/* ================= PAGE HEADER ================= */}

      <header className="rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-6 sm:p-8">

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

          <div>

            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
              People directory
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              Employees
            </h1>

            <p className="mt-2 text-sm text-[#637066]">
              Manage active workforce records while preserving history through
              safe archiving.
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            <Link
              to="/employees/archived"
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              Archived
            </Link>

            <button
              onClick={() => setShowCreateModel(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add employee
            </button>

          </div>

        </div>

      </header>


      {/* ================= SEARCH AND FILTER ================= */}

      <div className="grid gap-3 sm:grid-cols-[1fr_240px]">

        <div className="relative">

          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968C]" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, role or department…"
            className="pl-10"
          />

        </div>


        <select
          value={selectDept}
          onChange={(e) => setDept(e.target.value)}
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

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

        <div className="rounded-2xl border border-dashed border-[#D7DDD5] bg-white py-16 text-center">

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
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >

      <div
        onClick={(e) => e.stopPropagation()}
        className={`my-8 w-full rounded-2xl border border-[#E2E7E1] bg-white p-6 shadow-2xl ${
          large
            ? "max-w-5xl"
            : "max-w-3xl"
        }`}
      >

        <div className="mb-5 flex items-center justify-between border-b border-[#E2E7E1] pb-4">

          <h2 className="text-lg font-semibold">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 transition hover:bg-[#F4F7F3]"
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