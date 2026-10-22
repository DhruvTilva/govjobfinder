"use client";

import { loginAction } from "../actions";
import { useKeepValuesAction } from "@/components/admin/ActionForm";
import { PendingButton } from "@/components/SubmitButton";

export function LoginForm() {
  const { state, formAction, pending, onSubmit } = useKeepValuesAction(loginAction);
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
      <PendingButton pending={pending} label="Sign in" pendingLabel="Signing in…" className="btn-primary w-full" />
    </form>
  );
}
