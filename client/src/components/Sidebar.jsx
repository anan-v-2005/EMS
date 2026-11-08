import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarHeart,
  DollarSign,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  UserCircle2,
  Users,
  X,
  Archive,
  BriefcaseBusiness,
  FolderKanban,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/axios";

export default function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const [userName, setUserName] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    api
      .get("/profile")
      .then(({ data }) => {
        if (data?.firstName) {
          const fullName = `${data.firstName} ${
            data.lastName || ""
          }`.trim();

          setUserName(fullName);
          setProfilePhotoUrl(data?.profilePhotoUrl || "");
        } else {
          setProfilePhotoUrl(data?.profilePhotoUrl || "");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const role = user?.role;

  const nav = [
    ["Dashboard", "/dashboard", LayoutGrid],

    ...(role === "ADMIN"
      ? [
          ["Employees", "/employees", Users],
          ["Archived", "/employees/archived", Archive],
          ["People Operations", "/people-operations", BriefcaseBusiness],
          ["HRMS Workspace", "/hrms", FolderKanban],
          ["Employee Analytics", "/employee-analytics", BarChart3],
        ]
      : []),

    ["Attendance", "/attendance", CalendarHeart],
    ["Leaves", "/leave", FileText],
    ["Payslips", "/payslips", DollarSign],
    ...(role !== "ADMIN" ? [["People Operations", "/people-operations", BriefcaseBusiness], ["My HRMS", "/hrms", FolderKanban]] : []),
    ["Analytics", "/analytics", BarChart3],
    ["Profile 360", "/profile-360", UserCircle2],
    ["Settings", "/settings", Settings],
  ];

  const content = (
    <div className="flex h-full flex-col overflow-hidden text-[#637066]">

      {/* ================= HEADER ================= */}

      <div className="shrink-0 border-b border-[#E2E7E1] px-4 py-4">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D7E3D9] bg-gradient-to-br from-[#F1F7F2] to-[#E4EFE6] text-[#4A6F52] shadow-sm">
            <LayoutGrid className="h-5 w-5" />
          </div>

          <div className="min-w-0">

            <p className="truncate text-[14px] font-bold tracking-tight text-[#172019]">
              Employee MS
            </p>

            <p className="text-[11px] text-[#8A968C]">
              People operations
            </p>

          </div>

          {/* Close button - Mobile only */}

          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-2 text-[#8A968C] transition hover:bg-[#F1F5F0] hover:text-[#172019] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>

        </div>

      </div>


      {/* ================= USER PROFILE ================= */}

      <div className="shrink-0 mx-3 mt-4 rounded-2xl border border-[#E2E7E1] bg-[#FAFBF9] p-3">

        <div className="flex items-center gap-3">

          {/* Avatar */}

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E7F0E8] text-sm font-bold text-[#4A6F52] ring-1 ring-[#D6E4D8]">
            {profilePhotoUrl ? (
              <img src={profilePhotoUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              (userName || user?.email || "U").charAt(0).toUpperCase()
            )}
          </div>


          {/* User information */}

          <div className="min-w-0">

            <p className="truncate text-sm font-semibold text-[#172019]">

              {userName || user?.email || "User"}

            </p>

            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#8A968C]">

              {role === "ADMIN"
                ? "Administrator"
                : "Employee"}

            </p>

          </div>

        </div>

      </div>


      {/* ================= NAVIGATION ================= */}

      {/* This section scrolls independently if screen height is small */}

      <div className="flex-1 overflow-y-auto overflow-x-hidden">

        <p className="px-6 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[.19em] text-[#9AA49B]">

          Workspace

        </p>


        <nav className="space-y-1 px-3 pb-4">

          {nav.map(([name, href, Icon]) => {

            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`);

            return (

              <Link
                key={href}
                to={href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#EDF4EE] text-[#31563A]"
                    : "text-[#637066] hover:bg-[#F4F7F3] hover:text-[#172019]"
                }`}
              >

                {/* Active indicator */}

                {active && (

                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#5E8064]"
                  />

                )}


                {/* Navigation icon */}

                <Icon
                  className={`h-[17px] w-[17px] ${
                    active
                      ? "text-[#4A6F52]"
                      : "text-[#8A968C] group-hover:text-[#637066]"
                  }`}
                />


                {/* Navigation text */}

                <span>

                  {name}

                </span>

              </Link>

            );

          })}

        </nav>

      </div>


      {/* ================= LOGOUT ================= */}

      <div className="shrink-0 border-t border-[#E2E7E1] p-3">

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#637066] transition hover:bg-[#FFF2F0] hover:text-[#B7473A]"
        >

          <LogOut className="h-4 w-4" />

          <span>

            Log out

          </span>

        </button>

      </div>

    </div>
  );


  return (
    <>

      {/* ================= MOBILE MENU BUTTON ================= */}

      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-3.5 z-50 rounded-xl border border-[#DCE3DC] bg-white p-2.5 text-[#4A6F52] shadow-sm lg:hidden"
        aria-label="Open navigation"
      >

        <Menu className="h-5 w-5" />

      </button>


      {/* ================= MOBILE OVERLAY ================= */}

      {mobileOpen && (

        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-[#172019]/25 backdrop-blur-[2px] lg:hidden"
        />

      )}


      {/* ================= DESKTOP SIDEBAR ================= */}

      {/* FIXED: Sidebar will NOT move when page scrolls */}

      <aside
        className="
          fixed
          inset-y-0
          left-0
          z-40
          hidden
          h-screen
          w-[260px]
          border-r
          border-[#E2E7E1]
          bg-white
          lg:flex
        "
      >

        {content}

      </aside>


      {/* ================= MOBILE SIDEBAR ================= */}

      <aside
        className={`
          fixed
          left-0
          top-0
          z-50
          h-screen
          w-[280px]
          border-r
          border-[#E2E7E1]
          bg-white
          shadow-2xl
          transition-transform
          duration-300
          lg:hidden
          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >

        {content}

      </aside>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#172019]/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
          <div className="w-full max-w-sm rounded-2xl border border-[#E2E7E1] bg-white p-6 shadow-2xl">
            <h2 id="logout-confirm-title" className="text-lg font-semibold text-[#1F2A1F]">Confirm logout</h2>
            <p className="mt-3 text-sm text-[#637066]">Are you sure you want to logout?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="rounded-xl border border-[#DDE5DD] px-4 py-2.5 text-sm font-semibold text-[#435443] hover:bg-[#F6F8F5]">No / Cancel</button>
              <button type="button" onClick={async () => { await logout(); window.location.href = "/login"; }} className="rounded-xl bg-[#4A7C59] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3F6B4C]">Yes, logout</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}