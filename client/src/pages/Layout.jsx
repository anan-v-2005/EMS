
import React from "react";
import { Navigate, Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/Loading";
import TopBar from "../components/TopBar";
import ChangePasswordModel from "../components/ChangePasswordModel";

export default function Layout() {
  const { user, loading, refreshSession } = useAuth();

  /* ================= AUTH LOADING ================= */

  if (loading) {
    return <Loading />;
  }

  /* ================= AUTH CHECK ================= */

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /* ================= MAIN APPLICATION LAYOUT ================= */

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#F7F8F5]">
      {/* Forced password change */}

      {user.mustChangePassword && (
        <ChangePasswordModel
          open
          forced
          onClose={() => {}}
          onChanged={refreshSession}
        />
      )}

      {/* Sidebar */}

      <Sidebar />

      {/* Main Content */}

      <main className="min-h-screen min-w-0 flex-1 lg:ml-[260px]">
        {/* Top Navigation Bar */}

        <TopBar />

        {/* Page Content */}

        <div className="mx-auto min-h-[calc(100vh-64px)] w-full max-w-[1560px] min-w-0 px-3 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
