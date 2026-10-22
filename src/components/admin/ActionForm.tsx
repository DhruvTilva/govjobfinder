"use client";

import { startTransition, useActionState, useEffect } from "react";
import type { ActionState } from "@/app/bigboss/actions";
import { PendingButton } from "@/components/SubmitButton";
import { useSubmitLock } from "@/lib/use-submit-lock";
import { useIdemToken } from "./use-idem-token";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Binds a form to a server action. Submits via startTransition instead of the
 * form `action` prop so React does not reset the fields afterwards — otherwise a
 * validation error would wipe everything the user typed. (The `action` attribute
 * remains as a no-JavaScript fallback.)
 *
 * Duplicate protection: a second submit is dropped while one is running (useSubmitLock), and every
 * submission carries a one-time token the server claims (`idem`, see lib/idempotency.ts). The token
 * is renewed when a submission finishes so the same form can be used again.
 */
export function useKeepValuesAction(action: Action) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const lock = useSubmitLock(pending);
  const { field, renew } = useIdemToken();
  useEffect(() => {
    if (state) renew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lock.tryLock()) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  return { state, formAction, pending, onSubmit, idemField: field };
}

export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Save",
  pendingLabel = "Saving changes…",
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const { state, formAction, pending, onSubmit, idemField } = useKeepValuesAction(action);
  return (
    <form action={formAction} onSubmit={onSubmit} className={className}>
      {idemField}
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PendingButton pending={pending} label={submitLabel} pendingLabel={pendingLabel} />
        {state?.error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && !pending && <p className="text-sm font-semibold text-ok">{state.message ?? "Saved."}</p>}
      </div>
    </form>
  );
}

/** Submit button for plain server-action forms (uses the enclosing form's status). */
export { SubmitButton } from "./SubmitButton";
