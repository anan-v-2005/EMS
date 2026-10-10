import React from "react";
import { BarChart3, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

const LoginLeftSide = () => {
  return (
    <div className="relative hidden min-h-screen w-1/2 overflow-hidden border-r border-[#E2E7E1] bg-[#F2F6F1] md:flex">
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#DDEADF]/70 blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-[#E8F0E5] blur-3xl" />
      <div className="relative z-10 flex w-full flex-col justify-between p-10 lg:p-14 xl:p-16">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D4E2D6] bg-white text-[#4A6F52] shadow-sm"><BarChart3 className="h-5 w-5" /></div>
          <div><p className="text-sm font-bold text-[#172019]">Employee MS</p><p className="text-[11px] text-[#8A968C]">People operations workspace</p></div>
        </div>

        <div className="max-w-xl py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#D7E4D9] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#4A6F52] shadow-sm"><Sparkles className="h-3.5 w-3.5" /> Modern workforce operations</span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-[-.05em] text-[#172019] lg:text-5xl xl:text-[58px]">Run your people operations from one calm workspace.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#637066]">Manage employees, attendance, leave, payroll and workforce analytics through a secure experience designed for clarity and speed.</p>
          <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
            {[['Secure by design', ShieldCheck], ['Operational visibility', BarChart3], ['Consistent workflows', CheckCircle2], ['Smart insights', Sparkles]].map(([label, Icon]) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#DFE7DF] bg-white/70 px-4 py-3 text-sm font-semibold text-[#425246] shadow-sm"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EDF4EE] text-[#4A6F52]"><Icon className="h-4 w-4" /></span>{label}</div>)}
          </div>
        </div>

        <p className="text-xs text-[#8A968C]">Employee Management System · Secure access for authorized users</p>
      </div>
    </div>
  );
};
export default LoginLeftSide;
