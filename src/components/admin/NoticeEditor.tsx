import { NOTICE_KINDS, type notices } from "@/db/schema";
import { KIND_LABEL } from "@/lib/status";
import type { referenceOptions } from "@/lib/admin-queries";
import { saveNotice } from "@/app/bigboss/actions";
import { ActionForm } from "./ActionForm";
import { Field } from "./ui";

type N = typeof notices.$inferSelect;
type Opts = Awaited<ReturnType<typeof referenceOptions>>;

export function NoticeEditor({ n, opts, qualIds = [] }: { n?: N; opts: Opts; qualIds?: number[] }) {
  const src = n?.fieldSources ?? {};
  const tag = (k: string) => (src[k] === "ai" ? " · AI" : src[k] === "notice" ? " · from notice" : src[k] === "admin" ? " · edited" : "");
  const text = (name: keyof N & string, label: string, opts2: { rows?: number; hint?: string; span?: boolean } = {}) => (
    <Field label={label + tag(name)} htmlFor={`f-${name}`} hint={opts2.hint} className={opts2.span ? "sm:col-span-2" : undefined}>
      {opts2.rows ? (
        <textarea id={`f-${name}`} name={name} rows={opts2.rows} defaultValue={(n?.[name] as string | null) ?? ""} className="input" />
      ) : (
        <input id={`f-${name}`} name={name} defaultValue={(n?.[name] as string | number | null)?.toString() ?? ""} className="input" />
      )}
    </Field>
  );
  const date = (name: "noticeDate" | "applyStart" | "applyEnd" | "examDate", label: string) => (
    <Field label={label + tag(name)} htmlFor={`f-${name}`}>
      <input id={`f-${name}`} name={name} type="date" defaultValue={n?.[name] ?? ""} className="input" />
    </Field>
  );
  const select = (name: "organizationId" | "stateId" | "sectorId", label: string, items: { id: number; name: string; short?: string | null }[]) => (
    <Field label={label} htmlFor={`f-${name}`}>
      <select id={`f-${name}`} name={name} defaultValue={n?.[name]?.toString() ?? ""} className="input">
        <option value="">—</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.short ? `${i.short} — ${i.name}` : i.name}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <ActionForm action={saveNotice} className="card p-5" submitLabel={n ? "Save changes" : "Create (goes to review)"}>
      {n && <input type="hidden" name="id" value={n.id} />}
      {n && <input type="hidden" name="loadedUpdatedAt" value={n.updatedAt.getTime()} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("title", "Title", { span: true })}
        <Field label="Kind" htmlFor="f-kind">
          <select id="f-kind" name="kind" defaultValue={n?.kind ?? "recruitment"} className="input">
            {NOTICE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={"Job type" + tag("jobType")} htmlFor="f-jobType">
          <select id="f-jobType" name="jobType" defaultValue={n?.jobType ?? "unknown"} className="input">
            {["unknown", "permanent", "contract", "apprentice", "deputation"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        {select("organizationId", "Organisation", opts.organizations)}
        {select("stateId", "State / UT", opts.states)}
        {select("sectorId", "Sector", opts.sectors)}
        <Field label="Parent recruitment ID (for admit cards/results)" htmlFor="f-parentId">
          <input id="f-parentId" name="parentId" inputMode="numeric" defaultValue={n?.parentId ?? ""} className="input" />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="isCentral" defaultChecked={n?.isCentral} className="h-4 w-4" /> Central government / all-India recruitment
        </label>

        {date("applyStart", "Application starts")}
        {date("applyEnd", "Last date to apply")}
        {date("examDate", "Exam date")}
        {date("noticeDate", "Notification date")}
        {text("advtNo", "Advertisement no.")}
        {text("totalPosts", "Total posts")}
        {text("ageMin", "Minimum age")}
        {text("ageMax", "Maximum age")}
        {text("notificationUrl", "Official notification URL", { span: true, hint: "Must be the official PDF or page." })}
        {text("applyUrl", "Official application URL", { span: true })}
        {text("summary", "Summary", { rows: 3, span: true })}
        {text("postNames", "Post names", { rows: 2, span: true })}
        {text("location", "Location")}
        {text("ageText", "Age limit details", { rows: 2 })}
        {text("qualificationText", "Eligibility / qualification", { rows: 4, span: true })}
        <fieldset className="sm:col-span-2">
          <legend className="label">Qualification tags</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {opts.qualifications.map((q) => (
              <label key={q.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="qualIds" value={q.id} defaultChecked={qualIds.includes(q.id)} className="h-4 w-4" /> {q.name}
              </label>
            ))}
          </div>
        </fieldset>
        {text("experienceText", "Experience", { rows: 2, span: true })}
        {text("feeText", "Application fee", { rows: 2 })}
        {text("salaryText", "Pay / salary", { rows: 2 })}
        {text("selectionText", "Selection process", { rows: 3, span: true })}
        {text("howToApply", "How to apply", { rows: 3, span: true })}
        {text("documentsText", "Documents required", { rows: 3, span: true })}
      </div>
    </ActionForm>
  );
}
