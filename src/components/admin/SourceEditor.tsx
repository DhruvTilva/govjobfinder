import type { sources } from "@/db/schema";
import { saveSource } from "@/app/admin/actions";
import { ActionForm } from "./ActionForm";
import { Field } from "./ui";

type S = typeof sources.$inferSelect;

export function SourceEditor({ s, orgs }: { s?: S; orgs: { id: number; name: string; short: string | null }[] }) {
  const c = s?.config ?? {};
  return (
    <ActionForm action={saveSource} className="card p-5" submitLabel={s ? "Save source" : "Add source"}>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="s-name">
          <input id="s-name" name="name" required defaultValue={s?.name} className="input" />
        </Field>
        <Field label="Organisation" htmlFor="s-org">
          <select id="s-org" name="organizationId" defaultValue={s?.organizationId ?? ""} className="input">
            <option value="">—</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.short ? `${o.short} — ${o.name}` : o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Page URL to monitor" htmlFor="s-url" hint="The page that lists notices (e.g. the 'What's new' or 'Recruitment' page)." className="sm:col-span-2">
          <input id="s-url" name="url" type="url" required defaultValue={s?.url} className="input" />
        </Field>
        <Field label="Collection method" htmlFor="s-method">
          <select id="s-method" name="method" defaultValue={s?.method ?? "html_links"} className="input">
            <option value="html_links">HTML page – harvest links</option>
            <option value="rss">RSS / Atom feed</option>
            <option value="sitemap">XML sitemap</option>
            <option value="manual">Reference only (not scanned)</option>
          </select>
        </Field>
        <Field label="Trust" htmlFor="s-trust" hint="Trusted sources can auto-publish notices that pass all checks.">
          <select id="s-trust" name="trust" defaultValue={s?.trust ?? "review"} className="input">
            <option value="review">Review every notice</option>
            <option value="trusted">Trusted (auto-publish eligible)</option>
          </select>
        </Field>
        <Field label="Priority" htmlFor="s-priority">
          <select id="s-priority" name="priority" defaultValue={s?.priority ?? 2} className="input">
            <option value={1}>1 – critical</option>
            <option value={2}>2 – normal</option>
            <option value={3}>3 – low</option>
          </select>
        </Field>
        <Field label="Scan interval (minutes)" htmlFor="s-interval">
          <input id="s-interval" name="intervalMinutes" type="number" min={30} max={10080} defaultValue={s?.intervalMinutes ?? 360} className="input" />
        </Field>
        <Field label="Extra official domains" htmlFor="s-domains" hint="Links to these domains (and .gov.in / .nic.in) are accepted. Comma separated." className="sm:col-span-2">
          <input id="s-domains" name="allowedDomains" defaultValue={s?.allowedDomains.join(", ")} className="input" />
        </Field>
        <Field label="CSS selector (optional)" htmlFor="s-selector" hint='Limit harvesting to part of the page, e.g. "#whatsnew a".'>
          <input id="s-selector" name="selector" defaultValue={c.selector ?? ""} className="input" />
        </Field>
        <Field label="Max links per scan" htmlFor="s-max">
          <input id="s-max" name="maxItems" type="number" min={1} max={200} defaultValue={c.maxItems ?? ""} placeholder="40" className="input" />
        </Field>
        <Field label="Include patterns (one regex per line)" htmlFor="s-inc" hint="Leave empty to use the built-in recruitment vocabulary.">
          <textarea id="s-inc" name="include" rows={3} defaultValue={(c.include ?? []).join("\n")} className="input font-mono text-xs" />
        </Field>
        <Field label="Exclude patterns (one regex per line)" htmlFor="s-exc">
          <textarea id="s-exc" name="exclude" rows={3} defaultValue={(c.exclude ?? []).join("\n")} className="input font-mono text-xs" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={s?.enabled ?? true} className="h-4 w-4" /> Enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="fetchDocuments" defaultChecked={c.fetchDocuments !== false} className="h-4 w-4" /> Open linked documents to extract details
        </label>
        <Field label="Notes" htmlFor="s-notes" className="sm:col-span-2">
          <textarea id="s-notes" name="notes" rows={2} defaultValue={s?.notes ?? ""} className="input" />
        </Field>
      </div>
    </ActionForm>
  );
}
