import React from "react";
import { Toaster } from "react-hot-toast";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginLanding from "./pages/LoginLanding";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Payslips from "./pages/Payslips";
import Leave from "./pages/Leave";
import Settings from "./pages/Settings";
import LoginForm from "./components/LoginForm";
import PrintPayslips from "./pages/PrintPayslips";
import AIChatbot from "./components/AIChatbot";
import Analytics from "./pages/Analytics";
import ArchivedEmployees from "./pages/ArchivedEmployees";
import Profile360 from "./pages/Profile360";
import EmployeeAnalytics from "./pages/EmployeeAnalytics";
import EmployeeProfile from "./pages/EmployeeProfile";
import PeopleOperations from "./pages/PeopleOperations";
import HRMSWorkspace from "./pages/HRMSWorkspace";
import { ForgotPassword, ResetPassword } from "./pages/PasswordRecovery";
import { useAuth } from "./context/AuthContext";
// Set VITE_AI_ENABLED=false to hide the optional AI assistant (also set AI_ENABLED=false on the server).
const AI_ENABLED = import.meta.env.VITE_AI_ENABLED !== "false";

const App = () => {
  const { user } = useAuth();
  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      {user && AI_ENABLED && <AIChatbot />}
      <Routes>
        <Route path="/login" element={<LoginLanding />} />
        <Route
          path="/login/admin"
          element={
            <LoginForm
              role="admin"
              title="Admin Portal"
              subtitle="Manage your organization efficiently"
            />
          }
        />
        <Route
          path="/login/employee"
          element={
            <LoginForm
              role="employee"
              title="Employee Portal"
              subtitle="Sign in to access your account "
            />
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/archived" element={<ArchivedEmployees />} />
          <Route path="/employees/:id" element={<EmployeeProfile />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/payslips" element={<Payslips />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/employee-analytics" element={<EmployeeAnalytics />} />
          <Route path="/people-operations" element={<PeopleOperations />} />
          <Route path="/hrms" element={<HRMSWorkspace />} />
          <Route path="/profile-360" element={<Profile360 />} />
          <Route path="/leave" element={<Leave />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/print/payslips/:id" element={<PrintPayslips />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
};

export default App;
