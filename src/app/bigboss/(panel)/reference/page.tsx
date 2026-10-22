import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { qualifications, sectors, states, type organizations } from "@/db/schema";
import { listOrganizationsAdmin, referenceOptions } from "@/lib/admin-queries";
import { ActionForm } from "@/components/admin/ActionForm";
import { Field, Notice, PageTitle } from "@/components/admin/ui";
import { orgLogoAction, saveOrganization, saveQualification, saveSector, saveState, uploadOrgLogo } from "../../actions";
import { OrgBadge } from "@/components/NoticeCard";
import { SubmitButton } from "@/components/SubmitButton";
import Form from "next/form";

export const metadata = { title: "Reference data" };

const TABS = ["organizations", "sectors", "qualifications", "states"] as const;
type Tab = (typeof TABS)[number];

export default async function ReferencePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "organizations";
  return (
    <>
      <PageTitle title="Reference data" />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Reference data sections">
        {TABS.map((t) => (
          <Link key={t} href={`/bigboss/reference?tab=${t}`} aria-current={t === tab ? "page" : undefined} className={t === tab ? "btn-primary" : "btn-secondary"}>
            {t[0].toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-muted">Changes apply immediately to public pages and to how the pipeline classifies new notices.</p>
      {sp.logo && <Notice tone={/uploaded|hidden|cleared/i.test(sp.logo) ? "ok" : "bad"}>{sp.logo.slice(0, 200)}</Notice>}
      {tab === "organizations" && <Organizations q={sp.q} />}
      {tab === "sectors" && <Sectors />}
      {tab === "qualifications" && <Qualifications />}
      {tab === "states" && <States />}
    </>
  );
}

async function Organizations({ q }: { q?: string }) {
  const [rows, opts] = await Promise.all([listOrganizationsAdmin(q?.slice(0, 100)), referenceOptions()]);
  const shown = q ? rows : rows.slice(0, 40);
  return (
    <>
      <Form className="mb-3 flex gap-2" action="/bigboss/reference">
        <input type="hidden" name="tab" value="organizations" />
        <input name="q" defaultValue={q} placeholder="Search organisations" className="input max-w-xs" aria-label="Search organisations" />
        <SubmitButton className="btn-secondary" pendingLabel="Searching…" label="Search" />
      </Form>
      <details className="card mb-4 p-4">
        <summary className="cursor-pointer font-semibold text-navy-700">Add organisation</summary>
        <OrgForm opts={opts} />
      </details>
      <p className="mb-2 text-sm text-muted">{q ? `${rows.length} match(es)` : `Showing 40 of ${rows.length}; search to find others.`}</p>
      <div className="space-y-2">
        {shown.map(({ o, stateName, sectorName }) => (
          <details key={o.id} className="card p-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm">
              <OrgBadge short={o.shortName} name={o.name} logoId={o.logoSource !== "hidden" ? o.logoId : null} size="sm" />
              <strong className="text-ink">{o.name}</strong> {o.shortName && `(${o.shortName})`} <span className="text-muted">· {stateName ?? "Central"} · {sectorName ?? "no sector"} · {o.level}</span>
              {!o.active && <span className="text-danger"> · inactive</span>}
            </summary>
            <LogoPanel o={o} />
            <OrgForm o={o} opts={opts} />
          </details>
        ))}
      </div>
    </>
  );
}

const LOGO_STATUS: Record<string, string> = {
  auto: "Downloaded automatically from the official website (reviewed).",
  admin: "Uploaded by an editor — never replaced automatically.",
  hidden: "Hidden — the initials badge is shown (e.g. the logo is the State Emblem of India, whose use is restricted).",
};

function LogoPanel({ o }: { o: typeof organizations.$inferSelect }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-navy-50 p-3 text-sm">
      <OrgBadge short={o.shortName} name={o.name} logoId={o.logoSource !== "hidden" ? o.logoId : null} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Logo</p>
        <p className="text-xs text-muted">{o.logoSource ? LOGO_STATUS[o.logoSource] : "No logo found yet — the initials badge is shown."}</p>
        <form action={uploadOrgLogo} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={o.id} />
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.ico" className="text-xs" aria-label={`Logo for ${o.name}`} />
          <SubmitButton className="btn-secondary" pendingLabel="Uploading document…" label="Upload logo" />
          <span className="text-xs text-muted">PNG, JPEG, WebP, GIF, SVG or ICO, at least 32×32, up to 1 MB.</span>
        </form>
      </div>
      <div className="flex flex-col gap-1">
        {o.logoSource !== "hidden" && (
          <form action={orgLogoAction}>
            <input type="hidden" name="id" value={o.id} />
            <SubmitButton name="action" value="hide" className="btn-secondary text-xs" pendingLabel="Saving changes…" label="Hide logo" />
          </form>
        )}
        {(o.logoSource || o.logoId) && (
          <form action={orgLogoAction}>
            <input type="hidden" name="id" value={o.id} />
            <SubmitButton name="action" value="reset" className="btn-secondary text-xs" pendingLabel="Saving changes…" label="Reset (find automatically)" />
          </form>
        )}
      </div>
    </div>
  );
}

function OrgForm({ o, opts }: { o?: typeof organizations.$inferSelect; opts: Awaited<ReturnType<typeof referenceOptions>> }) {
  const p = o ? `o${o.id}` : "onew";
  return (
    <ActionForm action={saveOrganization} className="mt-3">
      {o && <input type="hidden" name="id" value={o.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor={`${p}-name`}>
          <input id={`${p}-name`} name="name" required defaultValue={o?.name} className="input" />
        </Field>
        <Field label="Short name" htmlFor={`${p}-short`}>
          <input id={`${p}-short`} name="shortName" defaultValue={o?.shortName ?? ""} className="input" />
        </Field>
        <Field label="URL slug" htmlFor={`${p}-slug`} hint="Changing it changes the public URL.">
          <input id={`${p}-slug`} name="slug" defaultValue={o?.slug} className="input" />
        </Field>
        <Field label="Level" htmlFor={`${p}-level`}>
          <select id={`${p}-level`} name="level" defaultValue={o?.level ?? "central"} className="input">
            {["central", "state", "ut", "psu", "autonomous"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="State / UT" htmlFor={`${p}-state`}>
          <select id={`${p}-state`} name="stateId" defaultValue={o?.stateId ?? ""} className="input">
            <option value="">Central / none</option>
            {opts.states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sector" htmlFor={`${p}-sector`}>
          <select id={`${p}-sector`} name="sectorId" defaultValue={o?.sectorId ?? ""} className="input">
            <option value="">—</option>
            {opts.sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Website" htmlFor={`${p}-web`}>
          <input id={`${p}-web`} name="website" defaultValue={o?.website ?? ""} className="input" />
        </Field>
        <Field label="Official domains" htmlFor={`${p}-dom`} hint="Comma separated">
          <input id={`${p}-dom`} name="officialDomains" defaultValue={o?.officialDomains.join(", ")} className="input" />
        </Field>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="active" defaultChecked={o?.active ?? true} className="h-4 w-4" /> Active
        </label>
        <Field label="Notes" htmlFor={`${p}-notes`} className="sm:col-span-3">
          <textarea id={`${p}-notes`} name="notes" rows={2} defaultValue={o?.notes ?? ""} className="input" />
        </Field>
      </div>
    </ActionForm>
  );
}

async function Sectors() {
  const db = await getDb();
  const rows = await db.select().from(sectors).orderBy(asc(sectors.sort));
  return (
    <div className="space-y-2">
      {[...rows, null].map((s) => (
        <details key={s?.id ?? "new"} className="card p-3" open={!s ? false : undefined}>
          <summary className="cursor-pointer text-sm font-semibold text-ink">{s ? s.name : "+ Add sector"}</summary>
          <ActionForm action={saveSector} className="mt-3">
            {s && <input type="hidden" name="id" value={s.id} />}
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Name" htmlFor={`sec${s?.id}-n`}>
                <input id={`sec${s?.id}-n`} name="name" required defaultValue={s?.name} className="input" />
              </Field>
              <Field label="Slug" htmlFor={`sec${s?.id}-s`}>
                <input id={`sec${s?.id}-s`} name="slug" required defaultValue={s?.slug} className="input" />
              </Field>
              <Field label="Sort" htmlFor={`sec${s?.id}-o`}>
                <input id={`sec${s?.id}-o`} name="sort" type="number" defaultValue={s?.sort ?? rows.length} className="input" />
              </Field>
              <Field label="Description" htmlFor={`sec${s?.id}-d`} className="sm:col-span-4">
                <input id={`sec${s?.id}-d`} name="description" defaultValue={s?.description ?? ""} className="input" />
              </Field>
              <Field label="Classifier keywords (comma separated)" htmlFor={`sec${s?.id}-k`} className="sm:col-span-4">
                <textarea id={`sec${s?.id}-k`} name="keywords" rows={2} defaultValue={s?.keywords.join(", ")} className="input" />
              </Field>
            </div>
          </ActionForm>
        </details>
      ))}
    </div>
  );
}

async function Qualifications() {
  const db = await getDb();
  const rows = await db.select().from(qualifications).orderBy(asc(qualifications.level));
  return (
    <div className="space-y-2">
      {[...rows, null].map((q) => (
        <details key={q?.id ?? "new"} className="card p-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">{q ? q.name : "+ Add qualification"}</summary>
          <ActionForm action={saveQualification} className="mt-3">
            {q && <input type="hidden" name="id" value={q.id} />}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name" htmlFor={`q${q?.id}-n`}>
                <input id={`q${q?.id}-n`} name="name" required defaultValue={q?.name} className="input" />
              </Field>
              <Field label="Slug" htmlFor={`q${q?.id}-s`}>
                <input id={`q${q?.id}-s`} name="slug" required defaultValue={q?.slug} className="input" />
              </Field>
              <Field label="Level (ordering)" htmlFor={`q${q?.id}-l`}>
                <input id={`q${q?.id}-l`} name="level" type="number" defaultValue={q?.level ?? 5} className="input" />
              </Field>
              <Field label="Detection patterns (one regex per line)" htmlFor={`q${q?.id}-p`} className="sm:col-span-3">
                <textarea id={`q${q?.id}-p`} name="patterns" rows={3} defaultValue={q?.patterns.join("\n")} className="input font-mono text-xs" />
              </Field>
            </div>
          </ActionForm>
        </details>
      ))}
    </div>
  );
}

async function States() {
  const db = await getDb();
  const rows = await db.select().from(states).orderBy(asc(states.type), asc(states.name));
  return (
    <div className="space-y-2">
      {rows.map((s) => (
        <details key={s.id} className="card p-3">
          <summary className="cursor-pointer text-sm">
            <strong className="text-ink">{s.name}</strong> <span className="text-muted">({s.type === "ut" ? "UT" : "State"})</span>
          </summary>
          <ActionForm action={saveState} className="mt-3">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Common recruitments shown on the state page" htmlFor={`st${s.id}-h`}>
              <textarea id={`st${s.id}-h`} name="highlights" rows={2} defaultValue={s.highlights ?? ""} className="input" />
            </Field>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="needsLinkCheck" defaultChecked={s.needsLinkCheck} className="h-4 w-4" /> No single recruitment portal (show coverage warning)
            </label>
          </ActionForm>
        </details>
      ))}
    </div>
  );
}
