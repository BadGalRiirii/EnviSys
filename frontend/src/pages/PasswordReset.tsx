import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { authApi } from "../api/services";

/** Handles both the request form (/forgot-password) and the confirm form
 *  (/reset-password?token=...). */
export default function PasswordReset() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (token) {
        await authApi.confirmPasswordReset(token, password);
        toast.success("Password updated. You can sign in now.");
      } else {
        await authApi.requestPasswordReset(email);
      }
      setDone(true);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 font-display text-2xl font-semibold">
          {token ? "Choose a new password" : "Reset your password"}
        </h1>
        {done ? (
          <div className="card text-sm text-ink/70">
            {token
              ? "Your password has been updated."
              : "If that email is registered, a reset link is on its way."}
            <Link to="/login" className="btn-primary mt-4 justify-center">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            {token ? (
              <div>
                <label className="label" htmlFor="new_password">New password</label>
                <input
                  id="new_password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="reset_email">Institutional email</label>
                <input
                  id="reset_email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}
            <button className="btn-primary w-full justify-center">
              {token ? "Update password" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
