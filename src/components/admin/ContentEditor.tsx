"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import type { ImportantDate, NoticeKind } from "@/db/schema";
import { saveContent, type ContentState } from "@/app/bigboss/content-actions";
import type { Suggestions } from "@/lib/content-suggest";

type Opt = { id: number; name: string; short?: string | null };
export type EditorNotice = {
  id: number;
  status: string;
  updatedAt: Date;
  kind: NoticeKind;
  [k: string]: unknown;
  importantDates: ImportantDate[];
  fieldSources: Record<string, string>;
};
type Props = {
  n?: EditorNotice;
  defaultKind: NoticeKind;
  sections: { kind: NoticeKind; label: string }[];
  opts: { organizations: Opt[]; states: Opt[]; sectors: Opt[]; qualifications: Opt[] };
  qualIds?: number[];
  attachment?: { id: number; fileName: string; size: number } | null;
};

const SUGGESTION_LABELS: Record<string, string> = {
  title: "Title", kind: "Section", advtNo: "Advertisement no.", totalPosts: "Total posts", noticeDate: "Notification date", applyStart: "Application starts",
  applyEnd: "Last date to apply", examDate: "Exam date", ageMin: "Minimum age", ageMax: "Maximum age", ageText: "Age details", feeText: "Application fee",
  salaryText: "Pay / salary", qualificationText: "Eligibility", jobType: "Job type",
};

export function ContentEditor({ n, defaultKind, sections, opts, qualIds = [], attachment }: Props) {
  const [state, formAction, pending] = useActionState<ContentState, FormData>(saveContent, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<NoticeKind>(n?.kind ?? defaultKind);
  const [dates, setDates] = useState<{ label: string; date: string }[]>(
    (n?.importantDates ?? []).filter((d) => d.date).map((d) => ({ label: d.label, date: d.date ?? "" })),
  );
  const [file, setFile] = useState(attachment ?? null);
  const [upload, setUpload] = useState<{ busy?: boolean; error?: string; warning?: string; textChars?: number; suggestions?: Suggestions } | null>(null);
  const isJob = kind === "recruitment";
  const val = (k: string) => {
    const v = n?.[k];
    return v == null ? "" : String(v);
  };
  const tag = (k: string) => {
    const s = n?.fieldSources?.[k];
    return s === "admin" ? " · edited" : s === "notice" ? " · from notice" : s === "ai" ? " · AI" : "";
  };

  const submit = (intent: "draft" | "publish") => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!formRef.current) return;
    if (!formRef.current.reportValidity()) return;
    const fd = new FormData(formRef.current);
    fd.set("intent", intent);
    startTransition(() => formAction(fd));
  };

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setUpload({ error: "The file is larger than 10 MB." });
    setUpload({ busy: true });
    const body = new FormData();
    body.set("file", f);
    try {
      const res = await fetch("/bigboss/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) return setUpload({ error: json.error ?? "Upload failed." });
      setFile({ id: json.id, fileName: json.fileName, size: json.size });
      setUpload({ warning: json.warning, textChars: json.textChars, suggestions: json.suggestions });
    } catch {
      setUpload({ error: "Upload failed (network error)." });
    } finally {
      e.target.value = "";
    }
  }

  /** Copies reviewed suggestions into the form. Fields the editor already filled are kept. */
  function applySuggestions(overwrite: boolean) {
    const s = upload?.suggestions;
    const form = formRef.current;
    if (!s || !form) return;
    if (s.kind && (overwrite || !n)) setKind(s.kind);
    for (const [k, v] of Object.entries(s)) {
      if (k === "kind" || v == null) continue;
      const el = form.elements.namedItem(k);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        if (overwrite || !el.value || el.value === "unknown") el.value = String(v);
      }
    }
  }

  const input = (name: string, label: string, o: { type?: string; span?: boolean; rows?: number; hint?: string; required?: boolean; inputMode?: "numeric" } = {}) => (
    <label className={`block ${o.span ? "sm:col-span-2" : ""}`}>
      <span className="label">
        {label}
        <span className="font-normal text-muted">{tag(name)}</span>
      </span>
      {o.rows ? (
        <textarea name={name} rows={o.rows} defaultValue={val(name)} className="input" />
      ) : (
        <input name={name} type={o.type ?? "text"} defaultValue={val(name)} required={o.required} inputMode={o.inputMode} className="input" />
      )}
      {o.hint && <span className="mt-1 block text-xs text-muted">{o.hint}</span>}
    </label>
  );
  const select = (name: "organizationId" | "stateId" | "sectorId", label: string, items: Opt[]) => (
    <label className="block">
      <span className="label">{label}</span>
      <select name={name} defaultValue={val(name)} className="input">
        <option value="">—</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.short ? `${i.short} — ${i.name}` : i.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {n && <input type="hidden" name="id" value={n.id} />}
      {n && <input type="hidden" name="loadedUpdatedAt" value={n.updatedAt.getTime()} />}
      <input type="hidden" name="attachmentId" value={file?.id ?? ""} />

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">1. Website section</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Section (where it appears on the website)</span>
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as NoticeKind)} className="input">
              {sections.map((s) => (
                <option key={s.kind} value={s.kind}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="pinned" defaultChecked={Boolean(n?.pinned)} className="h-4 w-4" /> Pin to the top of its listing and homepage board
          </label>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-lg font-bold">2. Official PDF (optional)</h2>
        <p className="mb-3 text-sm text-muted">Upload the official notification to attach it to the public page and to pre-fill fields from its text. PDF only, up to 10 MB.</p>
        <input type="file" accept="application/pdf,.pdf" onChange={onUpload} disabled={upload?.busy} className="block text-sm" aria-label="Upload PDF" />
        {upload?.busy && <p className="mt-2 text-sm text-muted">Uploading and reading the PDF…</p>}
        {upload?.error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            {upload.error}
          </p>
        )}
        {file && (
          <p className="mt-2 text-sm">
            Attached:{" "}
            <a href={`/files/${file.id}/${encodeURIComponent(file.fileName)}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-700 underline">
              {file.fileName}
            </a>{" "}
            <span className="text-muted">({Math.round(file.size / 1024)} KB)</span>{" "}
            <button type="button" onClick={() => setFile(null)} className="ml-2 text-xs text-danger underline">
              Remove from this notice
            </button>
          </p>
        )}
        {upload?.warning && <p className="mt-2 text-sm text-urgent">{upload.warning}</p>}
        {upload?.suggestions && Object.keys(upload.suggestions).length > 0 && (
          <div className="mt-3 rounded-lg border border-line bg-navy-50 p-3 text-sm">
            <p className="font-semibold text-ink">Found in the PDF ({upload.textChars?.toLocaleString()} characters of text) — check before using:</p>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.entries(upload.suggestions).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="inline text-muted">{SUGGESTION_LABELS[k] ?? k}: </dt>
                  <dd className="inline break-words text-ink">{String(v).slice(0, 160)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => applySuggestions(false)} className="btn-secondary">
                Fill empty fields
              </button>
              <button type="button" onClick={() => applySuggestions(true)} className="btn-secondary">
                Replace all with PDF values
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">3. Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("title", "Title / notification name", { span: true, required: true })}
          {input("summary", "Short description", { rows: 2, span: true })}
          {select("organizationId", "Recruiting organisation / exam authority", opts.organizations)}
          {select("stateId", "State / UT (leave empty for central)", opts.states)}
          {select("sectorId", "Sector", opts.sectors)}
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="isCentral" defaultChecked={Boolean(n?.isCentral)} className="h-4 w-4" /> Central government / all-India
          </label>
          {input("notificationUrl", "Official notification URL", { span: true, hint: "Link to the official PDF or page on the organisation's website." })}
          {input("applyUrl", "Official application URL", { span: true })}
          {input("advtNo", "Advertisement no.")}
          {input("noticeDate", "Notification date", { type: "date" })}
          {input("examDate", "Exam date", { type: "date" })}
          {!isJob && input("parentId", "Linked recruitment notice ID (optional)", { inputMode: "numeric", hint: "Shows this update on that job's page timeline." })}
        </div>
      </section>

      {isJob && (
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">4. Job details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("applyStart", "Application starts", { type: "date" })}
            {input("applyEnd", "Last date to apply", { type: "date", hint: "Within 7 days of today the job also appears in Closing Soon." })}
            {input("totalPosts", "Total vacancies / posts", { inputMode: "numeric" })}
            <label className="block">
              <span className="label">Job type{tag("jobType")}</span>
              <select name="jobType" defaultValue={val("jobType") || "unknown"} className="input">
                {["unknown", "permanent", "contract", "apprentice", "deputation"].map((t) => (
                  <option key={t} value={t}>
                    {t === "unknown" ? "Not stated" : t}
                  </option>
                ))}
              </select>
            </label>
            {input("ageMin", "Minimum age", { inputMode: "numeric" })}
            {input("ageMax", "Maximum age", { inputMode: "numeric" })}
            {input("ageText", "Age limit & relaxation details", { rows: 2, span: true })}
            {input("postNames", "Post names", { rows: 2, span: true })}
            {input("location", "Job location")}
            {input("qualificationText", "Qualification & eligibility", { rows: 4, span: true })}
            <fieldset className="sm:col-span-2">
              <legend className="label">Qualification tags (used by the qualification filters)</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {opts.qualifications.map((q) => (
                  <label key={q.id} className="flex items-center gap-1.5">
                    <input type="checkbox" name="qualIds" value={q.id} defaultChecked={qualIds.includes(q.id)} className="h-4 w-4" /> {q.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {input("experienceText", "Experience", { rows: 2, span: true })}
            {input("feeText", "Application fee", { rows: 2 })}
            {input("salaryText", "Pay / salary", { rows: 2 })}
            {input("documentsText", "Documents required", { rows: 2, span: true })}
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">{isJob ? "5." : "4."} Dates, instructions & search</h2>
        <fieldset>
          <legend className="label">Important dates (e.g. “Admit card released”, “Result declared”, “Objection window closes”)</legend>
          <div className="space-y-2">
            {dates.map((d, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input name="dateLabel" value={d.label} onChange={(e) => setDates(dates.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className="input max-w-sm" aria-label="Date label" />
                <input name="dateValue" type="date" value={d.date} onChange={(e) => setDates(dates.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="input max-w-[180px]" aria-label="Date" />
                <button type="button" onClick={() => setDates(dates.filter((_, j) => j !== i))} className="text-sm text-danger underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setDates([...dates, { label: "", date: "" }])} className="mt-2 text-sm font-semibold text-navy-700 underline">
            + Add a date
          </button>
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {input("selectionText", "Selection process", { rows: 3, span: true })}
          {input("howToApply", isJob ? "How to apply / instructions" : "Instructions / additional details", { rows: 3, span: true })}
          {input("keywords", "Search keywords (comma separated)", { span: true, hint: "Extra terms people may search for, e.g. “group d, level 1”." })}
        </div>
      </section>

      {state?.duplicates && state.duplicates.length > 0 && (
        <div className="card border-urgent p-4 text-sm" role="alert">
          <p className="font-semibold text-urgent">Possible duplicates:</p>
          <ul className="mt-1 list-disc pl-5">
            {state.duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/bigboss/content/${d.id}`} className="text-navy-700 underline" target="_blank">
                  #{d.id} {d.title}
                </Link>{" "}
                <span className="text-muted">
                  ({d.status}, {d.reason})
                </span>
              </li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="allowDuplicate" className="h-4 w-4" /> Create anyway — this is a different notification
          </label>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 px-1 py-3 backdrop-blur">
        <button type="submit" onClick={submit("draft")} disabled={pending} className="btn-secondary">
          {pending ? "Working…" : n ? (n.status === "published" ? "Save changes" : "Save") : "Save as draft"}
        </button>
        {n?.status !== "published" && (
          <button type="submit" onClick={submit("publish")} disabled={pending} className="btn-primary">
            {n ? "Save & publish" : "Publish now"}
          </button>
        )}
        {state?.error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && !pending && <p className="text-sm font-semibold text-ok">{state.message}</p>}
      </div>
    </form>
  );
}
