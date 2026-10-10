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
    <div className="h-full w-full bg-white px-8 py-8 overflow-y-auto">
      <div className="w-full max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

          <p className="text-sm text-gray-500 mt-1">
            Manage your account and preferences
          </p>
        </div>

        <div className="space-y-6">
          {profile && (
            <ProfileForm initialData={profile} onSuccess={fetchProfile} />
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-gray-600" />
                </div>

                <div>
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
                className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 transition"
                onClick={() => setShowPasswordModel(true)}
              >
                Change
              </button>
            </div>
          </div>
        </div>
      </div>

      <ChangePasswordModel
        open={showPasswordModel}
        onClose={() => setShowPasswordModel(false)}
      />
    </div>
  );
};

export default Settings;
