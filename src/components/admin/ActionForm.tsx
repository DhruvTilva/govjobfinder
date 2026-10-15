"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "@/app/admin/actions";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Binds a form to a server action. Submits via startTransition instead of the
 * form `action` prop so React does not reset the fields afterwards — otherwise a
 * validation error would wipe everything the user typed. (The `action` attribute
 * remains as a no-JavaScript fallback.)
 */
export function useKeepValuesAction(action: Action) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  return { state, formAction, pending, onSubmit };
}

export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Save",
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
}) {
  const { state, formAction, pending, onSubmit } = useKeepValuesAction(action);
  return (
    <form action={formAction} onSubmit={onSubmit} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Working…" : submitLabel}
        </button>
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
