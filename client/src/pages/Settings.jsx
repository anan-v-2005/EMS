
import React, { useEffect, useState } from "react";
import Loading from "../components/Loading";
import { Lock } from "lucide-react";
import ProfileForm from "../components/ProfileForm";
import ChangePasswordModel from "../components/ChangePasswordModel";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

const Settings = () => {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModel, setShowPasswordModel] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/profile");
      const profile = res.data;

      if (profile) setProfile(profile);
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="h-full min-h-0 w-full min-w-0 overflow-y-auto bg-white px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="w-full min-w-0 max-w-5xl">
        {/* PAGE HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Settings
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage your account and preferences
          </p>
        </div>

        <div className="min-w-0 space-y-6">
          {/* PROFILE FORM */}
          {profile && (
            <ProfileForm
              initialData={profile}
              onSuccess={fetchProfile}
            />
          )}

          {/* PASSWORD SECTION */}
          <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                  <Lock className="h-5 w-5 text-gray-600" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900">
                    Password
                  </h2>

                  <p className="text-sm text-gray-500">
                    Update your account password
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                onClick={() => setShowPasswordModel(true)}
              >
                Change
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      <ChangePasswordModel
        open={showPasswordModel}
        onClose={() => setShowPasswordModel(false)}
      />
    </div>
  );
};

export default Settings;
