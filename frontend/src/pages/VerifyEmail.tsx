import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { apiError } from "../api/client";
import { authApi } from "../api/services";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    const token = params.get("token") ?? "";
    authApi
      .verifyEmail(token)
      .then((r) => {
        setState("done");
        setMessage(r.data.detail);
      })
      .catch((err) => {
        setState("error");
        setMessage(apiError(err));
      });
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-sm text-center">
        <h1 className="font-display text-xl font-semibold">
          {state === "done" ? "Email verified" : state === "error" ? "Verification failed" : "One moment"}
        </h1>
        <p className="mt-2 text-sm text-ink/60">{message}</p>
        <Link to="/login" className="btn-primary mt-4 justify-center">Go to sign in</Link>
      </div>
    </div>
  );
}
