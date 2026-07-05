/** Chairperson console: faculty account management.
 * Thesis-workflow approvals (groups, panels, schedules, results) live on
 * the Approvals page — this page is scoped to account administration. */
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { authApi } from "../api/services";
import StatusBadge from "../components/StatusBadge";
import type { User } from "../types";

export default function Admin() {
  const [faculty, setFaculty] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    specialization: "",
    password: "",
    is_verified_faculty: true,
  });

  const load = async () => {
    const f = await authApi.users({ role: "FACULTY" });
    setFaculty(f.data.results);
  };

  useEffect(() => {
    load().catch((err) => toast.error(apiError(err)));
  }, []);

  const run = (action: () => Promise<unknown>, success: string) => async () => {
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const unverified = faculty.filter((f) => !f.is_verified_faculty);
  const verified = faculty.filter((f) => f.is_verified_faculty);

  const createFaculty = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await authApi.createFaculty(form);
      toast.success("Faculty account created and verified.");
      setCreating(false);
      setForm({ ...form, first_name: "", last_name: "", email: "", username: "", specialization: "", password: "" });
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Administration</h1>
        <p className="mt-1 text-sm text-ink/60">
          Faculty account management. Thesis-workflow decisions (groups, panels, schedules,
          results) live on the <Link to="/approvals" className="text-fern hover:underline">Approvals</Link> page.
        </p>
      </div>

      <section className="card" aria-labelledby="faculty-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="faculty-h" className="font-display text-lg">Faculty accounts</h2>
          <button className="btn-primary" onClick={() => setCreating(!creating)}>
            New faculty account
          </button>
        </div>

        {creating && (
          <form onSubmit={createFaculty} className="mb-4 grid gap-3 rounded-md border border-line p-4 sm:grid-cols-2">
            <input aria-label="First name" className="input" placeholder="First name"
              value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            <input aria-label="Last name" className="input" placeholder="Last name"
              value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            <input aria-label="Email" type="email" className="input" placeholder="Email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input aria-label="Username" className="input" placeholder="Username"
              value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            <input aria-label="Specialization" className="input" placeholder="Specialization (e.g. Water Quality)"
              value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
            <input aria-label="Temporary password" type="password" className="input" placeholder="Temporary password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn-primary">Create account</button>
              <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        )}

        {faculty.length === 0 ? (
          <p className="text-sm text-ink/50">No faculty accounts yet.</p>
        ) : (
          <>
            {unverified.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-rust">Pending verification</h3>
                <ul className="space-y-2">
                  {unverified.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        {f.full_name}
                        <span className="ml-2 text-ink/50">{f.specialization || "No specialization set"}</span>
                      </span>
                      <button className="btn-ghost px-3 py-1 text-xs"
                        onClick={run(() => authApi.verifyFaculty(f.id), "Faculty verified.")}>
                        Verify
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h3 className="mb-2 text-sm font-medium text-ink/60">Verified faculty</h3>
            {verified.length === 0 ? (
              <p className="text-sm text-ink/50">No verified faculty yet.</p>
            ) : (
              <ul className="space-y-2">
                {verified.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {f.full_name}
                      <span className="ml-2 text-ink/50">{f.specialization || "No specialization set"}</span>
                    </span>
                    <StatusBadge status="APPROVED" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
