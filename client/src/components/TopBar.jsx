import { Bell, CheckCheck, Search, X, Command, UserPlus, CalendarCheck, FileText, BarChart3, Settings, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const paletteInput = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const load = () => api.get("/notifications?limit=8").then(({ data }) => { setNotifications(data.data || []); setUnread(data.unread || 0); }).catch(() => {});
    load(); const interval = setInterval(load, 30000); return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    api.get("/profile").then(({ data }) => setProfilePhotoUrl(data?.profilePhotoUrl || "")).catch(() => {});
  }, [user?.role]);
  useEffect(() => {
    if (!openNotifications) return;
    const onPointerDown = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setOpenNotifications(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openNotifications]);
  useEffect(() => {
    const onKey = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); } if (event.key === "Escape") { setPalette(false); setPaletteQuery(""); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (palette) setTimeout(() => paletteInput.current?.focus(), 20); }, [palette]);


  const markAll = async () => { await api.patch("/notifications/read-all").catch(() => {}); setNotifications((items) => items.map((i) => ({ ...i, read: true }))); setUnread(0); };
  const markOne = async (item) => { if (!item.read) { await api.patch(`/notifications/${item._id}/read`).catch(() => {}); setNotifications((items) => items.map((i) => i._id === item._id ? { ...i, read: true } : i)); setUnread((v) => Math.max(0, v - 1)); } if (item.link) navigate(item.link); setOpenNotifications(false); };
  const actions = [
    ...(user?.role === "ADMIN" ? [["Add employee", "/employees", UserPlus], ["Employees", "/employees", Users]] : []),
    [user?.role === "ADMIN" ? "Review leave" : "Apply for leave", "/leave", FileText],
    ["Attendance", "/attendance", CalendarCheck], ["Analytics", "/analytics", BarChart3], ["Profile 360", "/profile-360", UserPlus], ["Settings", "/settings", Settings],
  ];
  const filteredActions = actions.filter(([label]) => label.toLowerCase().includes(paletteQuery.toLowerCase()));
  const go = (to) => { navigate(to); setPalette(false); setPaletteQuery(""); };

  return <>
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[#E2E7E1]/90 bg-[#F7F8F5]/90 px-4 backdrop-blur-xl lg:px-8">
      <button onClick={() => setPalette(true)} className="group flex min-w-0 max-w-xl flex-1 items-center gap-3 rounded-xl border border-[#E2E7E1] bg-white px-3 py-2 text-left shadow-sm transition hover:border-[#9DB6A2]"><Search className="h-4 w-4 shrink-0 text-[#8A968C]" /><span className="hidden truncate text-sm text-[#8A968C] sm:block">Search or jump to…</span><span className="ml-auto hidden items-center gap-1 rounded-lg border border-[#E2E7E1] px-1.5 py-0.5 text-[10px] text-[#8A968C] md:flex"><Command className="h-3 w-3" />K</span></button>
      <div className="flex items-center gap-2"><div ref={notificationRef} className="relative"><button onClick={() => setOpenNotifications((v) => !v)} aria-label="Notifications" className="relative rounded-xl border border-[#E2E7E1] bg-white p-2.5 text-[#637066]"><Bell className="h-4 w-4" />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#5E8064] px-1 text-center text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}</button><AnimatePresence>{openNotifications && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-12 w-[min(380px,calc(100vw-28px))] overflow-hidden rounded-2xl border border-[#E2E7E1] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#E2E7E1] px-4 py-3"><div><p className="text-sm font-semibold">Notifications</p><p className="text-[11px] text-[#8A968C]">{unread} unread</p></div><button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-[#4A6F52]"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button></div><div className="max-h-80 overflow-y-auto">{notifications.length ? notifications.map((item) => <button key={item._id} onClick={() => markOne(item)} className={`w-full border-b border-[#E2E7E1] px-4 py-3 text-left transition hover:bg-[#F8FAF7] ${!item.read ? "bg-[#EDF4EE]/60" : ""}`}><div className="flex gap-3"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-[#C8D1C9]" : "bg-[#5E8064]"}`} /><div><p className="text-sm font-medium">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-[#637066]">{item.message}</p><p className="mt-1 text-[10px] text-[#8A968C]">{new Date(item.createdAt).toLocaleString("en-IN")}</p></div></div></button>) : <p className="px-4 py-8 text-center text-sm text-[#637066]">You're all caught up.</p>}</div></motion.div>}</AnimatePresence></div><div className="h-9 w-9 overflow-hidden rounded-full border border-[#DCE9DE] bg-[#EDF4EE] text-xs font-semibold text-[#4A6F52] flex items-center justify-center" title={user?.email || "Profile"}>
        {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Profile" className="h-full w-full object-cover" /> : <>{user?.email?.[0]?.toUpperCase() || "U"}</>}
      </div></div>
    </header>

    <AnimatePresence>{palette && <motion.div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/35 p-4 pt-[10vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setPalette(false)}><motion.div initial={{ opacity: 0, y: -12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E2E7E1] bg-white shadow-2xl"><div className="flex items-center gap-3 border-b border-[#E2E7E1] px-4"><Search className="h-5 w-5 text-[#8A968C]" /><input ref={paletteInput} value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} placeholder="Search or jump to…" className="border-0 bg-transparent px-0 py-4 shadow-none focus:ring-0" /><button onClick={() => setPalette(false)}><X className="h-4 w-4 text-[#8A968C]" /></button></div><div className="max-h-[55vh] overflow-y-auto p-2"><p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#8A968C]">Actions</p>{filteredActions.map(([label, to, Icon]) => <button key={label} onClick={() => go(to)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#EDF4EE]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F5F0] text-[#4A6F52]"><Icon className="h-4 w-4" /></span><span className="text-sm font-medium">{label}</span></button>)}{!filteredActions.length && <p className="px-3 py-4 text-sm text-[#8A968C]">No matching actions.</p>}</div><div className="border-t border-[#E2E7E1] px-4 py-2 text-[10px] text-[#8A968C]">Tip: application search uses your authorized backend data; Gemini is not used for navigation or data lookup.</div></motion.div></motion.div>}</AnimatePresence>
  </>;
}
