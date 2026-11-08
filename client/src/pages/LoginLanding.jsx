
import React from "react";
import { Link, Navigate } from "react-router-dom";
import LoginLeftSide from "../components/LoginLeftSide";
import { ShieldCheck, User, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/Loading";

const LoginLanding = () => {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (user) return <Navigate to="/dashboard" replace />;

  const portalOptions = [
    {
      to: "/login/employee",
      title: "Employee Portal",
      description: "Access your dashboard, tasks, and profile",
      icon: User,
    },
    {
      to: "/login/admin",
      title: "Admin Portal",
      description: "Manage employees, roles, and system settings",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden md:flex-row">
      {/* LEFT SIDE */}
      <LoginLeftSide />

      {/* RIGHT SIDE */}
      <div className="flex w-full min-w-0 flex-col justify-between bg-[#FBFCFA] p-4 sm:p-8 md:w-1/2 md:p-12 lg:p-16">
        {/* MAIN CONTENT */}
        <div className="flex flex-1 items-center justify-center py-8 sm:py-10 md:py-0">
          <div className="w-full max-w-md min-w-0 animate-fade-in">
            {/* HEADING */}
            <div className="mb-7 text-center md:mb-10 md:text-left">
              <h2 className="text-3xl font-extrabold tracking-[-.04em] text-[#172019] sm:text-4xl">
                Welcome Back
              </h2>

              <p className="mt-3 text-sm text-[#637066] sm:text-base">
                Select your role to continue
              </p>
            </div>

            {/* PORTAL OPTIONS */}
            <div className="space-y-3">
              {portalOptions.map((option, index) => {
                const Icon = option.icon;

                return (
                  <Link
                    key={index}
                    to={option.to}
                    className="group flex min-h-[88px] min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#E2E7E1] bg-white p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#BFD0C2] hover:shadow-lg sm:p-5"
                  >
                    {/* ICON AND TEXT */}
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="shrink-0 rounded-xl bg-[#EDF4EE] p-2.5 text-[#4A6F52] transition group-hover:bg-[#5E8064] group-hover:text-white sm:p-3">
                        <Icon size={22} />
                      </div>

                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-[#172019]">
                          {option.title}
                        </h3>

                        <p className="mt-1 break-words text-xs text-[#637066] sm:text-sm">
                          {option.description}
                        </p>
                      </div>
                    </div>

                    {/* ARROW */}
                    <ArrowRight
                      className="h-5 w-5 shrink-0 text-[#9AA49B] transition group-hover:translate-x-1 group-hover:text-[#4A6F52]"
                      size={20}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-6 text-center text-xs font-medium tracking-wide text-[#8A968C]">
          © {new Date().getFullYear()} Employee Management System. All rights
          reserved.
        </div>
      </div>
    </div>
  );
};

export default LoginLanding;
