/** Profile updates + Google account connection for Drive/Docs integration. */
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { authApi, googleApi } from "../api/services";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", specialization: "" });

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name,
        last_name: user.last_name,
        specialization: user.specialization,
      });
    }
  }, [user]);

  useEffect(() => {
    googleApi.status().then((r) => setConnected(r.data.connected)).catch(() => {});
    const flag = params.get("google");
    if (flag === "connected") toast.success("Google account connected.");
    if (flag === "error") toast.error("Google connection failed. Please try again.");
  }, [params]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await authApi.updateMe(form);
      await refreshUser();
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const connectGoogle = async () => {
    try {
      const { data } = await googleApi.authorize();
      window.location.href = data.authorization_url;
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      <form onSubmit={save} className="card space-y-4">
        <h2 className="font-display text-lg">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="s_first">First name</label>
            <input id="s_first" className="input" value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="s_last">Last name</label>
            <input id="s_last" className="input" value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
        </div>
        {user?.role === "FACULTY" && (
          <div>
            <label className="label" htmlFor="s_spec">Specialization</label>
            <input id="s_spec" className="input" value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="e.g. Water Quality, Climate Adaptation" />
          </div>
        )}
        <button className="btn-primary">Save changes</button>
      </form>

      <div className="card space-y-3">
        <h2 className="font-display text-lg">Google Workspace</h2>
        <p className="text-sm text-ink/60">
          Connect your Google account so EnviSys can create shared thesis documents in
          Google Drive for real-time collaboration.
        </p>
        {connected ? (
          <p className="text-sm font-medium text-fern">Google account connected.</p>
        ) : (
          <button className="btn-primary" onClick={connectGoogle}>Connect Google</button>
        )}
      </div>
    </div>
  );
}
