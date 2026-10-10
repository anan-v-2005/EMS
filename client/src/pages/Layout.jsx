import React from "react";
import { Navigate, Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/Loading";
import TopBar from "../components/TopBar";

export default function Layout() {
  const { user, loading } = useAuth();


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

    <div className="min-h-screen bg-[#F7F8F5]">


      {/* Fixed Sidebar */}

      <Sidebar />


      {/* Main Content */}

      <main
        className="
          min-h-screen
          min-w-0
          flex-1
          lg:ml-[260px]
        "
      >


        {/* Top Navigation Bar */}

        <TopBar />


        {/* Page Content */}

        <div
          className="
            mx-auto
            w-full
            max-w-[1560px]
            px-4
            py-5
            sm:px-6
            sm:py-7
            lg:px-8
            lg:py-8
          "
        >

          <Outlet />

        </div>


      </main>


    </div>

  );
}