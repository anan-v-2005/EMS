
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CreditCard,
  FileText,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Loading from "../components/Loading";
import toast from "react-hot-toast";

export default function EmployeeProfile() {
  const { id } = useParams();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const loadEmployee = useCallback(
    () =>
      api
        .get(`/employees/${id}`)
        .then((e) => setEmployee(e.data))
        .catch((err) =>
          toast.error(
            err?.response?.data?.error || "Failed to load employee",
          ),
        ),
    [id],
  );

  useEffect(() => {
    loadEmployee().finally(() => setLoading(false));
  }, [loadEmployee]);

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setUploadingPhoto(true);

    try {
      const form = new FormData();
      form.append("photo", file);

      const { data } = await api.post(`/employees/${id}/photo`, form);

      setEmployee((current) => ({
        ...current,
        profilePhotoUrl: data.profilePhotoUrl,
        profilePhotoPublicId: data.profilePhotoPublicId,
      }));

      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to upload profile photo",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) return <Loading />;

  if (!employee) {
    return (
      <div className="py-16 text-center text-sm text-[#8A968C]">
        Employee not found.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 animate-fade-in sm:space-y-6">
      <Link
        to="/employees"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#4A6F52]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Link>

      {/* Employee Header */}
      <header className="overflow-hidden rounded-2xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-4 sm:rounded-3xl sm:p-8">
        <div className="flex min-w-0 flex-col gap-4 min-[420px]:flex-row min-[420px]:items-center sm:gap-5">
          <label
            className={`flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-3xl bg-[#5E8064] text-2xl font-semibold text-white ${
              uploadingPhoto ? "opacity-60" : ""
            }`}
            title="Change profile photo"
          >
            {employee.profilePhotoUrl ? (
              <img
                src={employee.profilePhotoUrl}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                {employee.firstName?.[0]}
                {employee.lastName?.[0]}
              </>
            )}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhoto}
              disabled={uploadingPhoto}
            />
          </label>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#4A6F52] sm:text-xs sm:tracking-[.18em]">
              Employee Profile 360
            </p>

            <h1 className="mt-1 break-words text-2xl font-semibold sm:text-3xl">
              {employee.firstName} {employee.lastName}
            </h1>

            <p className="mt-1 break-words text-sm text-[#637066]">
              {employee.position} · {employee.department}
            </p>

            {uploadingPhoto && (
              <p className="mt-1 text-xs text-[#4A6F52]">
                Uploading photo...
              </p>
            )}
          </div>

          <span className="badge w-fit shrink-0 bg-[#ECFDF3] text-[#039855]">
            {employee.employmentStatus}
          </span>
        </div>
      </header>

      {/* Overview and Employment */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 sm:gap-5">
        <section className="min-w-0 rounded-2xl border border-[#E2E7E1] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-lg font-semibold sm:mb-4">
            Overview
          </h2>

          <Info icon={Mail} label="Email" value={employee.email} />
          <Info icon={Phone} label="Phone" value={employee.phone} />

          <Info
            icon={CalendarCheck}
            label="Join date"
            value={
              employee.joinDate
                ? new Date(employee.joinDate).toLocaleDateString("en-IN")
                : "—"
            }
          />

          <Info
            icon={UserRound}
            label="Role"
            value={employee.user?.role || "EMPLOYEE"}
          />
        </section>

        <section className="min-w-0 rounded-2xl border border-[#E2E7E1] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-lg font-semibold sm:mb-4">
            Employment
          </h2>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <Mini label="Department" value={employee.department} />
            <Mini label="Position" value={employee.position} />

            <Mini
              label="Basic salary"
              value={
                employee.basicSalary != null
                  ? `₹${Number(employee.basicSalary).toLocaleString("en-IN")}`
                  : "—"
              }
            />

            <Mini label="Status" value={employee.employmentStatus} />
          </div>

          <p className="mt-4 break-words text-sm leading-6 text-[#637066]">
            {employee.bio || "No employee bio has been added."}
          </p>
        </section>
      </div>

      {/* Module Links */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Tile icon={CalendarCheck} title="Attendance" to="/attendance" />
        <Tile icon={FileText} title="Leave" to="/leave" />
        <Tile icon={CreditCard} title="Payroll" to="/payslips" />
        <Tile icon={Activity} title="Analytics" to="/analytics" />
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-[#E2E7E1] py-3 last:border-0">
      <Icon className="h-4 w-4 shrink-0 text-[#5E8064]" />

      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-[#8A968C]">
          {label}
        </p>

        <p className="mt-0.5 break-words text-sm font-medium">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#F8FAF7] p-2.5 sm:p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#8A968C]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold">
        {value || "—"}
      </p>
    </div>
  );
}

function Tile({ icon: Icon, title, to }) {
  return (
    <Link
      to={to}
      className="min-w-0 rounded-2xl border border-[#E2E7E1] bg-white p-3 transition sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-md"
    >
      <Icon className="h-5 w-5 text-[#5E8064]" />

      <h3 className="mt-3 break-words text-sm font-semibold sm:mt-4 sm:text-base">
        {title}
      </h3>

      <p className="mt-1 text-[11px] text-[#8A968C] sm:text-xs">
        Open module
      </p>
    </Link>
  );
}
