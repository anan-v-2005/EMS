
import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios";

const inputClass =
  "w-full min-w-0 min-h-11 px-4 py-3 rounded-xl border border-[#DCE3DC] bg-white focus:outline-none transition";

const Shell = ({ title, subtitle, children }) => (
  <div className="flex min-h-screen w-full min-w-0 items-center justify-center overflow-x-hidden bg-[#FBFCFA] px-4 py-6 sm:p-6">
    <div className="w-full max-w-md min-w-0">
      <Link
        to="/login"
        className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-[#667466] transition hover:text-[#1F2A1F]"
      >
        <ArrowLeft size={16} />
        Back to login
      </Link>

      <h1 className="text-2xl font-bold text-[#1F2A1F] sm:text-3xl">
        {title}
      </h1>

      <p className="mb-6 mt-2 break-words text-sm leading-6 text-[#697769]">
        {subtitle}
      </p>

      {children}
    </div>
  </div>
);

// /forgot-password
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Could not send the reset link. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell
      title="Forgot your password?"
      subtitle="Employees can enter their account email and we will send a link to set a new password."
    >
      {sent ? (
        <div className="break-words rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
          If an employee account exists for <strong>{email}</strong>, a reset
          link has been sent. It is valid for 1 hour.
        </div>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className={inputClass}
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-xl py-3 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send reset link
          </button>
        </form>
      )}
    </Shell>
  );
}

// /reset-password?token=...&email=...
export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (password !== confirm) {
      return toast.error("Passwords do not match");
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", {
        email,
        token,
        newPassword: password,
      });

      toast.success("Password updated. Please sign in.");
      navigate("/login");
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Could not reset the password"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <Shell
        title="Invalid link"
        subtitle="This password link is incomplete. Request a new one from the login page."
      >
        <Link
          to="/forgot-password"
          className="btn-primary inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 sm:w-auto"
        >
          Request a new link
        </Link>
      </Shell>
    );
  }

  return (
    <Shell
      title="Set a new password"
      subtitle={`For ${email}. Use at least 8 characters with a letter and a number.`}
    >
      <form className="space-y-5" onSubmit={submit}>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className={inputClass}
        />

        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className={inputClass}
        />

        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-xl py-3 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Update password
        </button>
      </form>
    </Shell>
  );
}
