import { useEffect, useState } from "react";
import { Activity, ArrowLeft, CalendarCheck, CreditCard, FileText, Mail, Phone, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Loading from "../components/Loading";
import toast from "react-hot-toast";

export default function EmployeeProfile() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const loadEmployee = () => api.get(`/employees/${id}`).then((e) => setEmployee(e.data)).catch((err) => toast.error(err?.response?.data?.error || "Failed to load employee"));
  useEffect(() => { loadEmployee().finally(() => setLoading(false)); }, [id]);
  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const { data } = await api.post(`/employees/${id}/photo`, form);
      setEmployee((current) => ({ ...current, profilePhotoUrl: data.profilePhotoUrl, profilePhotoPublicId: data.profilePhotoPublicId }));
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to upload profile photo");
    } finally {
      setUploadingPhoto(false);
    }
  };
  if (loading) return <Loading />; if (!employee) return <div className="py-16 text-center text-sm text-[#8A968C]">Employee not found.</div>;
  return <div className="space-y-6 animate-fade-in"><Link to="/employees" className="inline-flex items-center gap-2 text-sm font-semibold text-[#4A6F52]"><ArrowLeft className="h-4 w-4" /> Back to employees</Link><header className="rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-3xl bg-[#5E8064] text-2xl font-semibold text-white" title="Change profile photo">
{employee.profilePhotoUrl ? <img src={employee.profilePhotoUrl} alt={`${employee.firstName} ${employee.lastName}`} className="h-full w-full object-cover" /> : <>{employee.firstName?.[0]}{employee.lastName?.[0]}</>}
<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handlePhoto} disabled={uploadingPhoto} />
</label><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#4A6F52]">Employee Profile 360</p><h1 className="mt-1 text-3xl font-semibold">{employee.firstName} {employee.lastName}</h1><p className="mt-1 text-sm text-[#637066]">{employee.position} · {employee.department}</p></div><span className="sm:ml-auto badge bg-[#ECFDF3] text-[#039855]">{employee.employmentStatus}</span></div></header><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Overview</h2><Info icon={Mail} label="Email" value={employee.email} /><Info icon={Phone} label="Phone" value={employee.phone} /><Info icon={CalendarCheck} label="Join date" value={employee.joinDate ? new Date(employee.joinDate).toLocaleDateString("en-IN") : "—"} /><Info icon={UserRound} label="Role" value={employee.user?.role || "EMPLOYEE"} /></section><section className="rounded-2xl border border-[#E2E7E1] bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Employment</h2><div className="grid grid-cols-2 gap-3"><Mini label="Department" value={employee.department} /><Mini label="Position" value={employee.position} /><Mini label="Basic salary" value={employee.basicSalary != null ? `$${Number(employee.basicSalary).toLocaleString("en-IN")}` : "—"} /><Mini label="Status" value={employee.employmentStatus} /></div><p className="mt-4 text-sm leading-6 text-[#637066]">{employee.bio || "No employee bio has been added."}</p></section></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"><Tile icon={CalendarCheck} title="Attendance" to="/attendance" /><Tile icon={FileText} title="Leave" to="/leave" /><Tile icon={CreditCard} title="Payroll" to="/payslips" /><Tile icon={Activity} title="Analytics" to="/analytics" /></div></div>;
}
function Info({ icon: Icon, label, value }) { return <div className="flex items-center gap-3 border-b border-[#E2E7E1] py-3 last:border-0"><Icon className="h-4 w-4 text-[#5E8064]" /><div><p className="text-[10px] uppercase tracking-wider text-[#8A968C]">{label}</p><p className="mt-0.5 text-sm font-medium">{value || "—"}</p></div></div>; }
function Mini({ label, value }) { return <div className="rounded-xl bg-[#F8FAF7] p-3"><p className="text-[10px] uppercase tracking-wider text-[#8A968C]">{label}</p><p className="mt-1 text-sm font-semibold">{value || "—"}</p></div>; }
function Tile({ icon: Icon, title, to }) { return <Link to={to} className="rounded-2xl border border-[#E2E7E1] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"><Icon className="h-5 w-5 text-[#5E8064]" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 text-xs text-[#8A968C]">Open module</p></Link>; }
