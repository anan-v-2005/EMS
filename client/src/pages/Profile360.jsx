
import { useEffect, useState } from "react";
import {
  Activity,
  Briefcase,
  CalendarCheck,
  CreditCard,
  FileText,
  Mail,
  Phone,
  UserRound,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import api from "../api/axios";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const dateText = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function Profile360() {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/profile"), api.get("/analytics")])
      .then(([p, a]) => {
        setProfile(p.data);
        setAnalytics(a.data);
      })
      .catch((e) =>
        toast.error(e?.response?.data?.error || "Failed to load profile")
      )
      .finally(() => setLoading(false));
  }, []);

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setUploadingPhoto(true);

    try {
      const form = new FormData();
      form.append("photo", file);

      const { data } = await api.post("/profile/photo", form);

      setProfile((current) => ({
        ...current,
        profilePhotoUrl: data.profilePhotoUrl,
        profilePhotoPublicId: data.profilePhotoPublicId,
      }));

      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to upload profile photo"
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) return <Loading />;

  if (!profile) {
    return (
      <div className="py-16 text-center text-sm text-[#8A968C]">
        Profile unavailable.
      </div>
    );
  }

  const s = analytics?.summary || {};
  const isAdmin = user?.role === "ADMIN";

  const fullName =
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
    (isAdmin ? "Administrator" : "Employee");

  return (
    <div className="min-w-0 w-full space-y-6 animate-fade-in">
      {/* PROFILE HEADER */}
      <header className="min-w-0 rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-4 sm:p-6 lg:p-8">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <label
            className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-3xl bg-[#5E8064] text-2xl font-semibold text-white"
            title="Change profile photo"
          >
            {profile.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt={fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                {profile.firstName?.[0] || "A"}
                {profile.lastName?.[0] || ""}
              </>
            )}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhoto}
              disabled={
                isAdmin ||
                uploadingPhoto ||
                (user?.role === "EMPLOYEE" &&
                  (profile.profilePhotoUploadedBy === "ADMIN" ||
                    (!profile.profilePhotoUploadedBy &&
                      profile.profilePhotoUrl)))
              }
            />
          </label>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#4A6F52]">
              Profile 360
            </p>

            <h1 className="mt-1 break-words text-2xl font-semibold sm:text-3xl">
              {fullName}
            </h1>

            <p className="mt-1 break-words text-sm text-[#637066]">
              {isAdmin
                ? "Administrator account"
                : `${profile.position || "Employee"} · ${
                    profile.department || "No department"
                  }`}
            </p>

            <p className="mt-2 break-all text-xs text-[#829082]">
              {profile.email}
            </p>
          </div>
        </div>
      </header>

      {/* ADMIN PROFILE */}
      {isAdmin ? (
        <>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <Card title="Administrator account">
              <Info
                icon={Mail}
                label="Account email"
                value={profile.email}
              />

              <Info
                icon={ShieldCheck}
                label="Access role"
                value={profile.role || user?.role || "ADMIN"}
              />

              <Info
                icon={CalendarCheck}
                label="Account created"
                value={dateText(profile.accountCreatedAt)}
              />

              <Info
                icon={Clock3}
                label="Last account update"
                value={dateText(profile.lastAccountUpdate)}
              />

              <Info
                icon={Clock3}
                label="Last password change"
                value={dateText(profile.passwordChangedAt)}
              />

              <Info
                icon={ShieldCheck}
                label="Password setup"
                value={
                  profile.mustChangePassword
                    ? "Password change required"
                    : "Password configured"
                }
              />
            </Card>

            <Card title="Workforce overview">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Mini
                  label="Total employees"
                  value={s.headcount ?? "—"}
                />

                <Mini
                  label="Active employees"
                  value={s.activeEmployees ?? "—"}
                />

                <Mini
                  label="Departments"
                  value={s.departments ?? "—"}
                />

                <Mini
                  label="Pending leaves"
                  value={s.pendingLeaves ?? "—"}
                />

                <Mini
                  label="New hires this month"
                  value={s.newHiresThisMonth ?? "—"}
                />

                <Mini
                  label="Today's attendance"
                  value={`${s.attendanceRateToday ?? "—"}%`}
                />
              </div>

              <div className="mt-5 rounded-xl bg-[#F8FAF7] p-4 text-sm leading-6 text-[#637066]">
                Administrator access is linked to the account shown above.
                Workforce metrics are calculated from the current employee,
                attendance, leave and published payroll records.
              </div>
            </Card>
          </div>
        </>
      ) : (
        <>
          {/* EMPLOYEE PROFILE */}
          <div className="grid min-w-0 gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <Card title="Overview">
              <Info
                icon={Mail}
                label="Email"
                value={profile.email}
              />

              <Info
                icon={Phone}
                label="Phone"
                value={profile.phone}
              />

              <Info
                icon={Briefcase}
                label="Employment"
                value={profile.employmentStatus || "—"}
              />

              <Info
                icon={CalendarCheck}
                label="Join date"
                value={dateText(profile.joinDate)}
              />

              <Info
                icon={UserRound}
                label="Department / Position"
                value={`${profile.department || "—"} · ${
                  profile.position || "—"
                }`}
              />
            </Card>

            <Card title="Current snapshot">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini
                  label="Attendance"
                  value={`${s.attendanceRate ?? "—"}%`}
                />

                <Mini
                  label="Present"
                  value={s.presentDays ?? "—"}
                />

                <Mini
                  label="Avg hours"
                  value={`${s.avgHours ?? "—"}h`}
                />

                <Mini
                  label="Leaves"
                  value={s.leaveRequests ?? "—"}
                />
              </div>

              <div className="mt-5 rounded-xl bg-[#F8FAF7] p-4 text-sm leading-6 text-[#637066]">
                Only your authorized profile and analytics are shown here.
              </div>
            </Card>
          </div>
        </>
      )}

      {/* QUICK ACCESS TILES */}
      <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={CalendarCheck}
          title="Attendance"
          text="View attendance history and working hours."
        />

        <Tile
          icon={FileText}
          title="Leave"
          text="Review leave requests and statuses."
        />

        <Tile
          icon={CreditCard}
          title="Payroll"
          text="Open your available payslips."
        />

        <Tile
          icon={Activity}
          title="Analytics"
          text="Explore trends and month comparisons."
        />
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="min-w-0 rounded-2xl border border-[#E2E7E1] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      {children}
    </section>
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
    <div className="min-w-0 rounded-xl bg-[#F8FAF7] p-3">
      <p className="break-words text-[10px] uppercase tracking-wider text-[#8A968C]">
        {label}
      </p>

      <p className="mt-1 break-words text-lg font-semibold">
        {value}
      </p>
    </div>
  );
}

function Tile({ icon: Icon, title, text }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E2E7E1] bg-white p-4 sm:p-5">
      <Icon className="h-5 w-5 text-[#5E8064]" />

      <h3 className="mt-4 font-semibold">{title}</h3>

      <p className="mt-1 text-sm leading-6 text-[#637066]">
        {text}
      </p>
    </div>
  );
}
