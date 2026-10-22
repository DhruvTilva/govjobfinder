import { Breadcrumbs } from "./Nav";
import { SUPPORT_EMAIL } from "@/lib/site";

/** Shared shell for the static information pages (About, FAQ, guide and policies). */
export async function InfoPage({ title, crumb, updated, children }: { title: string; crumb: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="container-page max-w-3xl py-6">
      <Breadcrumbs items={[{ label: crumb }]} />
      <h1 className="mb-1 mt-3 text-3xl font-bold">{title}</h1>
      {updated && <p className="mb-4 text-sm text-muted">Last updated: {updated}</p>}
      <div className={`space-y-4 text-[15px] leading-relaxed ${updated ? "" : "mt-4"}`}>{children}</div>
      <SupportNote />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function List({ children, ordered }: { children: React.ReactNode; ordered?: boolean }) {
  const cls = `space-y-2 pl-5 ${ordered ? "list-decimal" : "list-disc"}`;
  return ordered ? <ol className={cls}>{children}</ol> : <ul className={cls}>{children}</ul>;
}

export function SupportNote() {
  return (
    <aside className="mt-8 rounded-lg border border-line bg-white p-4 text-sm" aria-label="Help and support">
      <p className="font-semibold text-ink">Questions or found an issue? Contact our support team.</p>
      <p className="mt-1">
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent underline underline-offset-2 hover:no-underline">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </aside>
  );
}
