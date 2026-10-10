import React from "react";
import { Link, Navigate } from "react-router-dom"; // For navigation between routes
import LoginLeftSide from "../components/LoginLeftSide"; // Left section component (UI/branding)
import { ShieldCheck, User, ArrowRight } from "lucide-react"; // Icons
import { useAuth } from "../context/AuthContext";
import Loading from "../components/Loading";

const LoginLanding = () => {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (user) return <Navigate to="/dashboard" replace />;

  // List of portal options (Admin & Employee)
  const portalOptions = [
    {
      to: "/login/employee",
      title: "Employee Portal",
      description: "Access your dashboard, tasks, and profile",
      icon: User,
    },
    {
      to: "/login/admin", // Route path
      title: "Admin Portal", // Card title
      description: "Manage employees, roles, and system settings", // Card description
      icon: ShieldCheck, // Icon component
    },
  ];

  return (
    // Main container (full height + responsive layout)
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Side (separate component for design/branding) */}
      <LoginLeftSide />

      {/* Right Side container */}
      <div className="w-full md:w-1/2 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-[#FBFCFA]">
        {/* Main Content (centered vertically & horizontally) */}
        <div className="flex items-center justify-center flex-1">
          <div className="w-full max-w-md animate-fade-in">
            {/* Heading section */}
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-4xl font-extrabold tracking-[-.04em] text-[#172019]">
                Welcome Back
              </h2>
              <p className="text-[#637066] mt-3">
                Select your role to continue
              </p>
            </div>

            {/* Role Cards (Admin & Employee options) */}
            <div className="space-y-3">
              {portalOptions.map((option, index) => {
                const Icon = option.icon; // Get icon dynamically

                return (
                  <Link
                    key={index} // Unique key for each card
                    to={option.to} // Navigation link
                    className="flex items-center justify-between p-5 rounded-2xl border border-[#E2E7E1] bg-white hover:border-[#BFD0C2] hover:-translate-y-0.5 hover:shadow-lg transition duration-200 group"
                  >
                    {/* Left side (icon + text) */}
                    <div className="flex items-center gap-4">
                      {/* Icon container */}
                      <div className="p-3 rounded-xl bg-[#EDF4EE] text-[#4A6F52] group-hover:bg-[#5E8064] group-hover:text-white transition">
                        <Icon size={22} /> {/* Dynamic icon */}
                      </div>

                      {/* Title and description */}
                      <div>
                        <h3 className="font-semibold text-[#172019]">
                          {option.title}
                        </h3>
                        <p className="text-sm text-[#637066] mt-1">
                          {option.description}
                        </p>
                      </div>
                    </div>

                    {/* Right arrow icon (hover animation) */}
                    <ArrowRight
                      className="text-[#9AA49B] group-hover:text-[#4A6F52] group-hover:translate-x-1 transition"
                      size={20}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer section */}
        <div className="text-center text-xs font-medium text-[#8A968C] mt-6 tracking-wide">
          © {new Date().getFullYear()} Employee Management System. All rights
          reserved.
        </div>
      </div>
    </div>
  );
};

export default LoginLanding;
