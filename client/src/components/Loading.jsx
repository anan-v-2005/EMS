import React from "react";

const Loading = () => (
  <div className="flex min-h-[42vh] w-full items-center justify-center" role="status" aria-label="Loading">
    <div className="flex flex-col items-center gap-3">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#DCE7DE] border-t-[#5E8064]" />
      <span className="text-xs font-medium text-[#8A968C]">Loading workspace…</span>
    </div>
  </div>
);
export default Loading;
