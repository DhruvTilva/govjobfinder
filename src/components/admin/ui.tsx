import Link from "next/link";

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function StatCard({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "warn" | "bad" | "good" }) {
  const color = tone === "bad" ? "text-danger" : tone === "warn" ? "text-urgent" : tone === "good" ? "text-ok" : "text-ink";
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-serif text-3xl font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 hover:bg-navy-50">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

const STATUS_CLS: Record<string, string> = {
  published: "bg-ok-soft text-ok",
  needs_review: "bg-urgent-soft text-urgent",
  draft: "bg-navy-100 text-navy-900",
  rejected: "bg-danger-soft text-danger",
  cancelled: "bg-danger-soft text-danger",
  withdrawn: "bg-danger-soft text-danger",
  closed: "bg-slate-200 text-slate-700",
  archived: "bg-slate-100 text-slate-600",
  success: "bg-ok-soft text-ok",
  partial: "bg-urgent-soft text-urgent",
  failed: "bg-danger-soft text-danger",
  running: "bg-navy-100 text-navy-900",
  ok: "bg-ok-soft text-ok",
  broken: "bg-danger-soft text-danger",
  timeout: "bg-urgent-soft text-urgent",
  blocked: "bg-danger-soft text-danger",
  redirect: "bg-urgent-soft text-urgent",
  unchecked: "bg-slate-100 text-slate-600",
  new: "bg-navy-100 text-navy-900",
  processed: "bg-ok-soft text-ok",
  ignored: "bg-slate-100 text-slate-600",
  never: "bg-slate-100 text-slate-600",
  checking: "bg-navy-100 text-navy-900",
  new_notices: "bg-ok-soft text-ok",
  no_new: "bg-ok-soft text-ok",
  no_links: "bg-urgent-soft text-urgent",
  disabled: "bg-slate-200 text-slate-700",
};

/** Plain-language label for a source's last-check outcome. */
export const CHECK_LABEL: Record<string, string> = {
  never: "never checked",
  checking: "checking now",
  new_notices: "ok, new notices",
  no_new: "ok, nothing new",
  no_links: "loaded, no links found",
  partial: "partial",
  failed: "failed",
  disabled: "disabled",
};

export function CheckPill({ value }: { value: string }) {
  return <span className={`chip ${STATUS_CLS[value] ?? "bg-slate-100 text-slate-700"}`}>{CHECK_LABEL[value] ?? value}</span>;
}

export function Pill({ value }: { value: string }) {
  return <span className={`chip ${STATUS_CLS[value] ?? "bg-slate-100 text-slate-700"}`}>{value.replace(/_/g, " ")}</span>;
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "warn" | "bad"; children: React.ReactNode }) {
  const cls = { info: "bg-navy-50 text-navy-900", ok: "bg-ok-soft text-ok", warn: "bg-urgent-soft text-urgent", bad: "bg-danger-soft text-danger" }[tone];
  return <p className={`mb-4 rounded-lg px-3 py-2 text-sm font-semibold ${cls}`}>{children}</p>;
}
