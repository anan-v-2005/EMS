// import React, { useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { ArrowLeft, Eye, EyeOff, Loader2, Loader2Icon } from "lucide-react";
// import LoginLeftSide from "./LoginLeftSide";
// import { useAuth } from "../context/AuthContext.jsx";
// import toast from "react-hot-toast";

// const LoginForm = ({ role = "user", title, subtitle }) => {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showpassword, setShowPassword] = useState(false);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);
//   const { login } = useAuth();
//   const navigate = useNavigate()

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");
//     setLoading(true)
//     try {
//       await login(email,password,role)
//       navigate("/dashboard")
//     } catch (error) {
//       toast.error(error.response?.data?.error || error.message || "Login Failed")
//     }finally{
//       setLoading(false)
//     }
//   };

//   return (
//     <div className="min-h-screen flex flex-col md:flex-row">
//       <LoginLeftSide />

//       <div className="w-full md:w-1/2 flex items-center justify-center bg-[#FBFCFA] p-6 sm:p-12 lg:p-16 relative">
//         <Link
//           to="/login"
//           className="absolute top-6 left-6 flex items-center gap-2 text-[#8A968C] hover:text-[#4A6F52] transition"
//         >
//           <ArrowLeft size={18} />
//           <span className="text-sm font-medium">Back to Portal</span>
//         </Link>

//         <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E2E7E1] p-7 sm:p-9">
//           <div className="mb-6">
//             <span className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold rounded-full bg-[#EDF4EE] text-[#4A6F52] border border-[#D8E5DA] tracking-[.12em]">
//               <span className="font-bold">{role.toUpperCase()}</span>
//             </span>
//           </div>

//           <div className="mb-6">
//             <h2 className="text-3xl font-extrabold tracking-[-.04em] text-[#172019]">{title}</h2>
//             <p className="text-[#637066] mt-2">{subtitle}</p>
//           </div>

//           {error && (
//             <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm animate-fade-in">
//               <svg
//                 className="w-5 h-5 mt-0.5 text-red-500"
//                 fill="currentColor"
//                 viewBox="0 0 20 20"
//               >
//                 <path
//                   fillRule="evenodd"
//                   d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.516 11.59c.75 1.335-.213 2.99-1.742 2.99H3.483c-1.53 0-2.492-1.655-1.743-2.99l6.517-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 012 0v3a1 1 0 01-1 1z"
//                   clipRule="evenodd"
//                 />
//               </svg>

//               <span className="font-medium">{error}</span>
//             </div>
//           )}

//           <form className="space-y-5" onSubmit={handleSubmit}>
//             <div>
//               <label className="block text-sm font-semibold text-[#425246] mb-1.5">
//                 Email Address
//               </label>
//               <input
//                 type="email"
//                 value={email}
//                 required
//                 onChange={(e) => setEmail(e.target.value)}
//                 placeholder={`Enter your ${role} email`}
//                 className="w-full px-4 py-3 rounded-xl border border-[#DCE3DC] bg-white focus:outline-none transition"
//               />
//             </div>

//             <div className="relative">
//               <label className="block text-sm font-semibold text-[#425246] mb-1.5">
//                 Password
//               </label>

//               <input
//                 type={showpassword ? "text" : "password"}
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 placeholder="Enter your password"
//                 className="w-full px-4 py-3 rounded-xl border border-[#DCE3DC] bg-white focus:outline-none transition"
//                 required
//               />

//               <button
//                 type="button"
//                 onClick={() => setShowPassword((prev) => !prev)}
//                 className="absolute right-3 top-9 text-[#8A968C] hover:text-[#4A6F52]"
//               >
//                 {showpassword ? <EyeOff size={18} /> : <Eye size={18} />}
//               </button>
//             </div>

//             <button
//               type="submit"
//               disabled={loading}
//               className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
//             >
//               {loading ? (
//                 <>
//                   <Loader2 className="w-5 h-5 animate-spin" />
//                   Processing...
//                 </>
//               ) : (
//                 "Continue"
//               )}
//             </button>
//           </form>

//           <p className="text-center text-xs text-[#8A968C] mt-6">
//             Secure access for authorized users only
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default LoginForm;
import { useState } from "react";
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
    <div className="min-h-screen flex flex-col md:flex-row">
      <LoginLeftSide />

      <div className="w-full md:w-1/2 flex items-center justify-center bg-[#FBFCFA] p-6 sm:p-12 lg:p-16 relative">
        <Link
          to="/login"
          className="absolute top-6 left-6 flex items-center gap-2 text-[#8A968C] hover:text-[#4A6F52] transition"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Portal</span>
        </Link>

        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E2E7E1] p-7 sm:p-9">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold rounded-full bg-[#EDF4EE] text-[#4A6F52] border border-[#D8E5DA] tracking-[.12em]">
              <span className="font-bold">{role.toUpperCase()}</span>
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-extrabold tracking-[-.04em] text-[#172019]">
              {title}
            </h2>

            <p className="text-[#637066] mt-2">
              {subtitle}
            </p>
          </div>

          {error && (
            <div className="mt-4 mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">
              <svg
                className="w-5 h-5 mt-0.5 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.516 11.59c.75 1.335-.213 2.99-1.742 2.99H3.483c-1.53 0-2.492-1.655-1.743-2.99l6.517-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 012 0v3a1 1 0 01-1 1z"
                  clipRule="evenodd"
                />
              </svg>

              <span className="font-medium">{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-[#425246] mb-1.5">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`Enter your ${role} email`}
                className="w-full px-4 py-3 rounded-xl border border-[#DCE3DC] bg-white focus:outline-none transition"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-[#425246] mb-1.5">
                Password
              </label>

              <input
                type={showpassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl border border-[#DCE3DC] bg-white focus:outline-none transition"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-9 text-[#8A968C] hover:text-[#4A6F52]"
              >
                {showpassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#8A968C] mt-6">
            Secure access for authorized users only
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;