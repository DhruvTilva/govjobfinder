"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader } from "./Loader";
import { useSubmitLock } from "@/lib/use-submit-lock";

/**
 * Submit button for forms that use a server action (or next/form). While the form is submitting it
 * is disabled, shows the shared loader with a contextual message, and the form drops any further
 * submit (second click, Enter key) until the request is done. In forms with several submit
 * buttons only the one that was pressed shows the loader; the others are disabled.
 */
export function SubmitButton({
  label,
  pendingLabel = "Working…",
  className = "btn-primary",
  name,
  value,
  title,
  disabled,
  hideLabel,
  children,
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
  title?: string;
  disabled?: boolean;
  /** Show only the loader (label stays available to screen readers) — for narrow buttons. */
  hideLabel?: boolean;
  children?: React.ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const lock = useSubmitLock(pending);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onSubmit = (e: SubmitEvent) => {
      if (!lock.tryLock()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    // Capture phase on the form itself runs before React's own submit handling.
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [lock]);

  const pressed = pending && (name ? data?.get(name) === value : true);
  return (
    <button ref={ref} type="submit" name={name} value={value} title={title} disabled={pending || disabled} aria-busy={pressed || undefined} className={className}>
      {pressed ? <Loader placement="inline" label={pendingLabel} hideLabel={hideLabel} /> : (children ?? label)}
    </button>
  );
}

/**
 * Button for forms driven by useActionState / fetch (where `pending` is known to the component, not
 * to useFormStatus). Same look and behaviour as <SubmitButton />: disabled while busy, shared loader
 * with a contextual message.
 */
export function PendingButton({
  pending,
  label,
  pendingLabel = "Working…",
  className = "btn-primary",
  type = "submit",
  onClick,
  disabled,
  children,
}: {
  pending: boolean;
  label?: string;
  pendingLabel?: string;
  className?: string;
  type?: "submit" | "button";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button type={type} onClick={onClick} disabled={pending || disabled} aria-busy={pending || undefined} className={className}>
      {pending ? <Loader placement="inline" label={pendingLabel} /> : (children ?? label)}
    </button>
  );
}
