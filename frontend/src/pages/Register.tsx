import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { authApi } from "../api/services";

export default function Register() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    student_id: "",
    email: "",
    username: "",
    password: "",
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.register(form);
      setSent(true);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-sm text-center">
          <h1 className="font-display text-xl font-semibold">Check your inbox</h1>
          <p className="mt-2 text-sm text-ink/60">
            We sent a verification link to <strong>{form.email}</strong>. Open it to
            activate your account, then sign in.
          </p>
          <Link to="/login" className="btn-primary mt-4 justify-center">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <h1 className="mb-1 font-display text-2xl font-semibold">Create a student account</h1>
        <p className="mb-5 text-sm text-ink/60">
          Faculty and panel accounts are created by the Department Chairperson.
        </p>
        <form onSubmit={submit} className="card space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="first_name">First name</label>
              <input id="first_name" className="input" value={form.first_name} onChange={set("first_name")} required />
            </div>
            <div>
              <label className="label" htmlFor="last_name">Last name</label>
              <input id="last_name" className="input" value={form.last_name} onChange={set("last_name")} required />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="student_id">Student ID</label>
            <input id="student_id" className="input" value={form.student_id} onChange={set("student_id")} required />
          </div>
          <div>
            <label className="label" htmlFor="reg_email">Institutional email</label>
            <input id="reg_email" type="email" className="input" value={form.email} onChange={set("email")} required />
          </div>
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input id="username" className="input" value={form.username} onChange={set("username")} required />
          </div>
          <div>
            <label className="label" htmlFor="reg_password">Password</label>
            <input id="reg_password" type="password" className="input" value={form.password} onChange={set("password")} required minLength={8} />
          </div>
          <button className="btn-primary w-full justify-center" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
          <p className="text-center text-xs">
            Already registered?{" "}
            <Link to="/login" className="text-fern hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
