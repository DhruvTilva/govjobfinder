"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label, className = "btn-primary" }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Working…" : label}
    </button>
  );
}
