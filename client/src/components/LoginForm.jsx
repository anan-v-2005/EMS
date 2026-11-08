
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import LoginLeftSide from "./LoginLeftSide";
import { useAuth } from "../context/AuthContext.jsx";
import toast from "react-hot-toast";

const LoginForm = ({ role = "user", title, subtitle }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showpassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password, role);
      navigate("/dashboard");
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Login Failed";

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-w-0 flex flex-col md:flex-row">
      <LoginLeftSide />

      <div className="relative flex w-full min-w-0 items-center justify-center bg-[#FBFCFA] px-3 py-20 sm:p-12 lg:w-1/2 lg:p-16">
        <Link
          to="/login"
          className="absolute left-4 top-5 flex items-center gap-2 text-[#8A968C] transition hover:text-[#4A6F52] sm:left-6 sm:top-6"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Portal</span>
        </Link>

        <div className="w-full max-w-md min-w-0 rounded-3xl border border-[#E2E7E1] bg-white p-5 shadow-xl sm:p-9">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D8E5DA] bg-[#EDF4EE] px-3 py-1.5 text-[11px] font-bold tracking-[.12em] text-[#4A6F52]">
              <span className="font-bold">{role.toUpperCase()}</span>
            </span>
          </div>

          <div className="mb-6">
            <h2 className="break-words text-2xl font-extrabold tracking-[-.04em] text-[#172019] sm:text-3xl">
              {title}
            </h2>

            <p className="mt-2 text-sm text-[#637066] sm:text-base">
              {subtitle}
            </p>
          </div>

          {error && (
            <div className="mb-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.516 11.59c.75 1.335-.213 2.99-1.742 2.99H3.483c-1.53 0-2.492-1.655-1.743-2.99l6.517-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 012 0v3a1 1 0 01-1 1z"
                  clipRule="evenodd"
                />
              </svg>

              <span className="min-w-0 break-words font-medium">
                {error}
              </span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#425246]">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                required
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`Enter your ${role} email`}
                className="w-full rounded-xl border border-[#DCE3DC] bg-white px-4 py-3 text-base transition focus:outline-none"
              />
            </div>

            <div className="relative">
              <label className="mb-1.5 block text-sm font-semibold text-[#425246]">
                Password
              </label>

              <input
                type={showpassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-[#DCE3DC] bg-white px-4 py-3 pr-12 text-base transition focus:outline-none"
                required
              />

              <button
                type="button"
                aria-label={showpassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-9 flex h-9 w-9 items-center justify-center rounded-lg text-[#8A968C] hover:text-[#4A6F52]"
              >
                {showpassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>

            {role === "employee" && (
              <div className="-mt-2 text-right">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-[#4A7C59] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#8A968C]">
            Secure access for authorized users only
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
