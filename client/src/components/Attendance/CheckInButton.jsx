// import React, { useState } from "react";
// import { LogOutIcon, Loader2Icon, LogInIcon } from "lucide-react";
// import toast from "react-hot-toast";
// import api from "../api/axios";



// const CheckInButton = ({ todayRecords, onAction }) => {
//   const [loading, setLoading] = useState(false);

//   const handleAttendance = async () => {
//     setLoading(true);
//     try {
//       await api.post('/attendance')
//       onAction()
//     } catch (error) {
//       toast.error(error?.response?.data?.error || error?.message)
//     }
//     setLoading(false)
//   };

//   if (todayRecords?.checkOut) {
//     return (
//       <div className="absolute bottom-4 right-4 z-10">
//         <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
//           <h3 className="text-emerald-700 font-semibold text-sm">
//             Work Day Completed
//           </h3>
//           <p className="text-emerald-600 text-xs mt-1">
//             You have successfully completed today’s shift
//           </p>
//         </div>
//       </div>
//     );
//   }

//   const isCheckedIn = !!todayRecords?.isCheckedIn;

//   return (
//     <div className="absolute bottom-4 right-4 z-10">
      
//       <button
//         onClick={handleAttendance}
//         disabled={loading}
//         className={`
//           flex items-center gap-4 px-5 py-4 rounded-2xl shadow-lg
//           transition-all duration-200 active:scale-[0.97]
//           text-white min-w-[220px]
//           ${isCheckedIn 
//             ? "bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800"
//             : "bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-600"
//           }
//         `}
//       >

//         {/* ICON SIDE */}
//         <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/15">
//           {loading ? (
//             <Loader2Icon className="size-5 animate-spin" />
//           ) : isCheckedIn ? (
//             <LogOutIcon className="size-5" />
//           ) : (
//             <LogInIcon className="size-5" />
//           )}
//         </div>

//         {/* TEXT SIDE */}
//         <div className="flex flex-col text-left">
//           <h2 className="text-sm font-semibold">
//             {loading ? "Processing..." : isCheckedIn ? "Clock Out" : "Clock In"}
//           </h2>

//           <p className="text-xs opacity-80">
//             {isCheckedIn ? "End your shift" : "Start your work day"}
//           </p>
//         </div>

//       </button>

//     </div>
//   );
// };

// export default CheckInButton;

import React, { useState } from "react";
import {
  LogOutIcon,
  Loader2Icon,
  LogInIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";

const CheckInButton = ({ todayRecords, onAction }) => {
  const [loading, setLoading] = useState(false);

  const handleAttendance = async () => {
    setLoading(true);

    try {
      await api.post("/attendance");

      await onAction();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Attendance action failed"
      );
    } finally {
      setLoading(false);
    }
  };

  if (todayRecords?.checkOut) {
    return (
      <div className="absolute bottom-4 right-4 z-10">
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
          <h3 className="text-emerald-700 font-semibold text-sm">
            Work Day Completed
          </h3>

          <p className="text-emerald-600 text-xs mt-1">
            You have successfully completed today’s shift
          </p>
        </div>
      </div>
    );
  }

  const isCheckedIn = !!todayRecords?.checkIn;

  return (
    <div className="absolute bottom-4 right-4 z-10">

      <button
        onClick={handleAttendance}
        disabled={loading}
        className={`
          flex items-center gap-4 px-5 py-4 rounded-2xl shadow-lg
          transition-all duration-200 active:scale-[0.97]
          text-white min-w-[220px]
          disabled:opacity-60 disabled:cursor-not-allowed
          ${
            isCheckedIn
              ? "bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800"
              : "bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-600"
          }
        `}
      >

        {/* ICON SIDE */}
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/15">
          {loading ? (
            <Loader2Icon className="size-5 animate-spin" />
          ) : isCheckedIn ? (
            <LogOutIcon className="size-5" />
          ) : (
            <LogInIcon className="size-5" />
          )}
        </div>

        {/* TEXT SIDE */}
        <div className="flex flex-col text-left">
          <h2 className="text-sm font-semibold">
            {loading
              ? "Processing..."
              : isCheckedIn
              ? "Clock Out"
              : "Clock In"}
          </h2>

          <p className="text-xs opacity-80">
            {isCheckedIn
              ? "End your shift"
              : "Start your work day"}
          </p>
        </div>

      </button>
    </div>
  );
};

export default CheckInButton;