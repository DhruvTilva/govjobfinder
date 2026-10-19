import { and, desc, eq, inArray, lt, ne, gte, or, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  discoveries,
  notices,
  noticeQualifications,
  noticeRevisions,
  type FieldSource,
  type NoticeKind,
  type NoticeLink,
} from "@/db/schema";
import { classify, detectAmendment } from "./classify";
import { extractFields, detectQualifications, detectSector, type Extracted } from "./extract";
import { fetchDocument, type FetchedDocument } from "./documents";
import { FetchError } from "./net";
import type { PoliteFetcher } from "./polite";
import { aiEnabled, aiExtract, type AiNotice } from "./ai";
import { todayIST, addDays, findAllDates } from "./dates";
import { clean, looksGarbled, slugify, tidyTitle, truncate } from "@/lib/text";
import { isOfficialUrl } from "@/lib/url";

export type Taxonomy = {
  sectors: { id: number; keywords: string[] }[];
  qualifications: { id: number; patterns: string[] }[];
};

export type SourceCtx = {
  id: number;
  url: string;
  trust: "trusted" | "review";
  allowedDomains: string[];
  config: { fetchDocuments?: boolean };
  organization: { id: number; level: string; stateId: number | null; sectorId: number | null; officialDomains: string[] } | null;
};

export type DiscoveryRow = typeof discoveries.$inferSelect;

export type ProcessOutcome =
  | "published"
  | "needs_review"
  | "ignored"
  | "duplicate"
  | "updated"
  | "amendment_applied"
  | "archived"
  | "retry"
  | "failed";

export type ProcessDeps = {
  db: DB;
  fetcher: PoliteFetcher;
  taxonomy: Taxonomy;
  log: (level: "info" | "warn" | "error", message: string, data?: unknown) => Promise<void>;
  now?: Date;
  /** Injectable for tests. */
  fetchDoc?: (url: string) => Promise<FetchedDocument>;
};

const FOLLOW_UP_KINDS: NoticeKind[] = ["admit_card", "result", "answer_key", "exam_date", "syllabus"];
const MAX_ATTEMPTS = 3;

export function normalizeAdvt(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "") || null;
}

function tokens(s: string): Set<string> {
  const stop = new Set(["of", "the", "for", "and", "in", "to", "on", "a", "2024", "2025", "2026", "2027", "post", "posts", "notice", "recruitment", "result", "admit", "card", "answer", "key"]);
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !stop.has(t)),
  );
}

export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Groupable description of a fetch failure (the full message is kept on the discovery). */
function fetchErrorLabel(e: unknown): string {
  if (!(e instanceof FetchError)) return "unexpected error";
  switch (e.code) {
    case "robots":
      return "blocked by the site's robots.txt";
    case "too_large":
      return "file too large";
    case "http":
      return `HTTP ${e.status ?? "error"}`;
    case "tls":
      return "TLS/certificate error";
    case "timeout":
      return "timed out";
    case "blocked":
      return "unsafe address";
    default:
      return "network error";
  }
}

/**
 * Re-queues auto-collected notices (by default the review queue) so they are processed
 * again with the current extraction rules. Notices that editors touched and parents of
 * follow-ups are always left alone. Including "published" re-extracts live notices too,
 * e.g. after fixing an extraction bug; they reappear when the same run processes them.
 * Returns the number re-queued.
 */
export async function requeueForReprocessing(db: DB, statuses: ("needs_review" | "archived" | "rejected" | "published")[] = ["needs_review"]): Promise<number> {
  const rows = await db
    .select({ id: notices.id })
    .from(notices)
    .where(
      and(
        inArray(notices.status, statuses),
        eq(notices.verification, "auto"),
        sql`${notices.dedupeKey} is not null`,
        sql`not exists (select 1 from ${notices} c where c.parent_id = ${notices.id})`,
        sql`not exists (select 1 from ${noticeRevisions} r where r.notice_id = ${notices.id} and r.actor like 'admin:%')`,
      ),
    );
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await db.update(discoveries).set({ state: "new", attempts: 0, noticeId: null, lastError: null, nextAttemptAt: null }).where(inArray(discoveries.noticeId, chunk));
    await db.delete(notices).where(inArray(notices.id, chunk));
  }
  return ids.length;
}

function isRetryable(e: unknown) {
  if (!(e instanceof FetchError)) return true;
  if (e.code === "timeout" || e.code === "network") return true;
  return e.code === "http" && (e.status ?? 0) >= 500;
}

/** Applies AI-extracted values only where deterministic extraction found nothing. */
function mergeAi(ex: Extracted, ai: AiNotice | null, sources: Record<string, FieldSource>) {
  const out = { ...ex, summary: null as string | null, postNames: null as string | null, location: null as string | null, selectionText: null as string | null, howToApply: null as string | null };
  const take = <K extends keyof typeof out>(key: K, value: (typeof out)[K] | null | undefined) => {
    if ((out[key] == null || out[key] === "unknown") && value != null && value !== "unknown") {
      out[key] = value as (typeof out)[K];
      sources[key as string] = "ai";
    }
  };
  for (const [k, v] of Object.entries(ex)) {
    if (k === "applyEndAlternatives") continue;
    if (v != null && v !== "unknown" && !(Array.isArray(v) && v.length === 0)) sources[k] = "notice";
  }
  if (!ai) return out;
  take("advtNo", ai.advt_no);
  take("totalPosts", ai.total_posts);
  take("applyStart", ai.apply_start);
  take("applyEnd", ai.apply_end);
  take("examDate", ai.exam_date);
  take("ageMin", ai.age_min);
  take("ageMax", ai.age_max);
  take("ageText", ai.age_text);
  take("feeText", ai.fee_text);
  take("salaryText", ai.salary_text);
  take("qualificationText", ai.qualification_text);
  take("jobType", ai.job_type);
  take("summary", ai.summary);
  take("postNames", ai.post_names);
  take("location", ai.location);
  take("selectionText", ai.selection_text);
  take("howToApply", ai.how_to_apply);
  if (out.applyStart && out.applyEnd && out.applyStart > out.applyEnd) {
    out.applyStart = null;
    delete sources.applyStart;
  }
  return out;
}

const ATTACHMENT_TEXT = /attachment|detailed|notification|advertisement|advt|click\s*here|download|view/i;

/**
 * Picks the PDF on a notice's landing page that is the notice itself: the link whose
 * text/filename best matches the notice title, preferring attachment wording. With several
 * candidates and no match, returns null rather than guessing (sidebars link unrelated PDFs).
 */
export function pickNoticePdf(links: { url: string; text: string }[], title: string): { url: string; text: string } | null {
  if (links.length <= 1) return links[0] ?? null;
  const scored = links.map((l, i) => {
    const file = decodeURIComponent(l.url.split("?")[0].split("/").pop() ?? "").replace(/\.pdf$/i, "");
    return { l, i, score: similarity(title, `${l.text} ${file}`) + (ATTACHMENT_TEXT.test(l.text) ? 0.35 : 0) };
  });
  const best = scored.sort((a, b) => b.score - a.score || a.i - b.i)[0];
  return best.score >= 0.1 ? best.l : null;
}

/** Fetches the document, following an HTML landing page to its PDF when the page itself says little. */
async function loadDocument(deps: ProcessDeps, d: DiscoveryRow, src: SourceCtx) {
  const get = deps.fetchDoc ?? ((u: string) => fetchDocument(deps.fetcher, u));
  const doc = await get(d.url);
  let notificationUrl = doc.contentType === "pdf" ? doc.finalUrl : null;
  let text = doc.text;
  // Fingerprint of the notice itself: the followed PDF when the link was a landing page.
  let hash = doc.hash;
  const domains = [...src.allowedDomains, ...(src.organization?.officialDomains ?? [])];
  if (doc.contentType === "html" && doc.text.length < 2500) {
    const pdf = pickNoticePdf(
      doc.pdfLinks.filter((l) => isOfficialUrl(l.url, domains)),
      tidyTitle(clean(d.linkText) ?? ""),
    );
    if (pdf) {
      try {
        const inner = await get(pdf.url);
        if (inner.contentType === "pdf" && inner.text.length > 200) {
          notificationUrl = inner.finalUrl;
          text = `${doc.text}\n${inner.text}`;
          hash = inner.hash;
        }
      } catch {
        /* landing page text is still usable */
      }
    }
  }
  const apply = doc.applyLinks.find((l) => isOfficialUrl(l.url, domains))?.url ?? null;
  return { doc, text, hash, notificationUrl, applyUrl: apply };
}

export async function processDiscovery(deps: ProcessDeps, d: DiscoveryRow, src: SourceCtx): Promise<ProcessOutcome> {
  const { db } = deps;
  const now = deps.now ?? new Date();
  const today = todayIST(now);
  const linkText = tidyTitle(clean(d.linkText) ?? d.url);
  const amendment = detectAmendment(linkText);
  let cls = classify(linkText);
  const domains = [...src.allowedDomains, ...(src.organization?.officialDomains ?? [])];

  // Amendments ("Extension of last date…") rarely name their type; they modify a recruitment.
  if (amendment && cls.kind === "other") cls = { kind: "recruitment", confidence: 0.6 };

  // 1. Fetch the document (PDF or HTML).
  let loaded: Awaited<ReturnType<typeof loadDocument>> | null = null;
  let docError: string | null = null;
  let docErrorKind: string | null = null;
  if (src.config.fetchDocuments !== false) {
    try {
      loaded = await loadDocument(deps, d, src);
    } catch (e) {
      docError = e instanceof Error ? e.message : String(e);
      docErrorKind = fetchErrorLabel(e);
      if (isRetryable(e) && d.attempts + 1 < MAX_ATTEMPTS) {
        await db
          .update(discoveries)
          .set({ state: "failed", attempts: d.attempts + 1, lastError: docError, nextAttemptAt: new Date(now.getTime() + 30 * 60_000 * 2 ** d.attempts) })
          .where(eq(discoveries.id, d.id));
        return "retry";
      }
    }
  }
  const docText = loaded?.text ?? "";
  if (cls.confidence < 0.8 && docText && !amendment) cls = classify(linkText, docText);
  // A title that states its own closing date ("… ( અંતિમ તારીખ 29-October-2026 )", "Last date: …")
  // is an open recruitment, even when it never says "recruitment".
  if (cls.confidence < 0.8 && !amendment && extractFields(linkText).applyEnd) cls = { kind: "recruitment", confidence: 0.85 };

  // 2. Exact duplicate document already stored under another link (same content, or the
  // same official PDF reached directly from one listing and via a landing page from another).
  if (loaded?.hash) {
    const sameDoc = loaded.notificationUrl ? or(eq(notices.docHash, loaded.hash), eq(notices.notificationUrl, loaded.notificationUrl)) : eq(notices.docHash, loaded.hash);
    const [dup] = await db.select({ id: notices.id }).from(notices).where(sameDoc).limit(1);
    if (dup) {
      await db.update(discoveries).set({ state: "processed", noticeId: dup.id, docHash: loaded.hash, lastError: null }).where(eq(discoveries.id, d.id));
      return "duplicate";
    }
  }
  if (cls.kind === "other") {
    await db.update(discoveries).set({ state: "ignored", kindGuess: "other", attempts: d.attempts + 1, lastError: null }).where(eq(discoveries.id, d.id));
    return "ignored";
  }

  // 3. Extract fields.
  const fieldSources: Record<string, FieldSource> = {};
  const ex = extractFields(`${linkText}\n${docText}`);
  let ai: AiNotice | null = null;
  if (aiEnabled() && docText.length > 300 && cls.kind === "recruitment") {
    try {
      ai = await aiExtract(linkText, docText);
    } catch (e) {
      await deps.log("warn", "AI extraction failed; continuing with deterministic fields", { error: String(e) });
    }
  }
  const f = mergeAi(ex, ai, fieldSources);
  if (cls.kind !== "recruitment") {
    // "Last date" in a result/admit card/answer key means something else (download or objection
    // window). Keep it only in the labelled important-dates list.
    for (const k of ["applyStart", "applyEnd", "totalPosts", "ageMin", "ageMax", "ageText", "feeText", "salaryText", "qualificationText"] as const) {
      (f as Record<string, unknown>)[k] = null;
      delete fieldSources[k];
    }
  }
  const orgId = src.organization?.id ?? null;
  const advtKey = normalizeAdvt(f.advtNo);

  const markProcessed = (noticeId: number) =>
    db
      .update(discoveries)
      .set({
        state: "processed",
        noticeId,
        kindGuess: cls.kind,
        docHash: loaded?.hash ?? null,
        docContentType: loaded?.doc.contentType ?? null,
        docText: docText ? docText.slice(0, 20_000) : null,
        lastError: docError,
        attempts: d.attempts + 1,
      })
      .where(eq(discoveries.id, d.id));

  // 4. Amendments (corrigendum, extension, cancellation) apply to the original notice.
  if (amendment && orgId) {
    const parent = await findRecruitment(db, orgId, advtKey, linkText);
    if (parent) {
      const link: NoticeLink = { label: truncate(linkText, 120), url: loaded?.notificationUrl ?? d.url };
      const links = [...(parent.links ?? []).filter((l) => l.url !== link.url), link];
      const diff: Record<string, [unknown, unknown]> = { links: [parent.links?.length ?? 0, links.length] };
      const patch: Partial<typeof notices.$inferInsert> = { links, updatedAt: now, lastCheckedAt: now };
      let changeType: string = "corrigendum";
      if ((amendment === "extension" || amendment === "corrigendum") && f.applyEnd && (!parent.applyEnd || f.applyEnd > parent.applyEnd)) {
        patch.applyEnd = f.applyEnd;
        diff.applyEnd = [parent.applyEnd, f.applyEnd];
        changeType = "deadline_extended";
        if (parent.status === "closed" && f.applyEnd >= today) {
          patch.status = "published";
          patch.closedAt = null;
          diff.status = [parent.status, "published"];
        }
      }
      if (amendment === "cancelled" || amendment === "withdrawn") {
        patch.status = amendment;
        diff.status = [parent.status, amendment];
        changeType = amendment;
      }
      await db.update(notices).set(patch).where(eq(notices.id, parent.id));
      await db.insert(noticeRevisions).values({ noticeId: parent.id, changeType, diff, actor: "pipeline" });
      await markProcessed(parent.id);
      return "amendment_applied";
    }
  }

  // 5. Same advertisement already stored → treat as an update to that notice.
  if (cls.kind === "recruitment" && advtKey && orgId && !amendment) {
    const existing = await findRecruitment(db, orgId, advtKey, null);
    if (existing) {
      const diff: Record<string, [unknown, unknown]> = {};
      const patch: Partial<typeof notices.$inferInsert> = { lastCheckedAt: now };
      const compare = <K extends "applyEnd" | "applyStart" | "totalPosts" | "examDate">(k: K, v: (typeof notices.$inferInsert)[K] | null) => {
        if (v != null && existing[k] !== v && existing.verification !== "reviewed") {
          diff[k] = [existing[k], v];
          (patch as Record<string, unknown>)[k] = v;
        }
      };
      compare("applyEnd", f.applyEnd);
      compare("applyStart", f.applyStart);
      compare("totalPosts", f.totalPosts);
      compare("examDate", f.examDate);
      if (Object.keys(diff).length) {
        patch.updatedAt = now;
        await db.update(notices).set(patch).where(eq(notices.id, existing.id));
        await db.insert(noticeRevisions).values({ noticeId: existing.id, changeType: diff.applyEnd ? "deadline_changed" : "updated", diff, actor: "pipeline" });
      } else {
        await db.update(notices).set(patch).where(eq(notices.id, existing.id));
      }
      await markProcessed(existing.id);
      return Object.keys(diff).length ? "updated" : "duplicate";
    }
  }

  // 6. Follow-ups attach to their recruitment for the timeline.
  let parentId: number | null = null;
  if (FOLLOW_UP_KINDS.includes(cls.kind) && orgId) {
    parentId = (await findRecruitment(db, orgId, advtKey, linkText))?.id ?? null;
  }

  // 7. Validation → publication decision.
  const notificationUrl = loaded?.notificationUrl ?? d.url;
  const reasons: string[] = [];
  if (src.trust !== "trusted") reasons.push("Source is configured for manual review");
  if (!isOfficialUrl(d.url, domains)) reasons.push("Link is not on an official domain");
  if (!loaded) reasons.push(docErrorKind ? `Document could not be fetched: ${docErrorKind}` : "Document not fetched");
  else if (loaded.doc.contentType === "pdf" && docText.length < 200) reasons.push("PDF has no extractable text (possibly scanned)");
  if (cls.confidence < 0.8) reasons.push("Notice type is uncertain");
  if (amendment) reasons.push("Amendment without a matching original notice");
  if (linkText.length < 15) reasons.push("Title too short");
  else if (looksGarbled(linkText)) reasons.push("Title looks garbled (several links merged)");
  let status: "published" | "needs_review" | "archived" = "published";
  if (cls.kind === "recruitment") {
    const stale = !f.applyEnd ? staleReason(linkText, f.advtNo, docText, today) : null;
    if (stale) {
      status = "archived";
      reasons.push(stale);
    } else if (!f.applyEnd) reasons.push("Closing date not found");
    else if (f.applyEnd < today) status = "archived";
    else if (f.applyEnd > addDays(today, 400)) reasons.push("Closing date is implausibly far away");
    if (status !== "archived" && f.applyEnd && ex.applyEndAlternatives.length) reasons.push("Notice gives conflicting closing dates");
  }
  if (status !== "archived" && reasons.length) status = "needs_review";
  if (status === "archived" && f.applyEnd && f.applyEnd < today) reasons.unshift("Closing date had already passed when discovered");

  const sectorId = detectSector(linkText, docText, deps.taxonomy.sectors) ?? src.organization?.sectorId ?? null;
  const org = src.organization;
  const isCentral = !!org && ["central", "psu", "autonomous"].includes(org.level) && !org.stateId;
  const title = truncate(linkText, 180);

  const [created] = await db
    .insert(notices)
    .values({
      slug: `${slugify(title, 70)}-${d.fingerprint.slice(0, 6)}`,
      kind: cls.kind,
      status,
      title,
      summary: f.summary,
      organizationId: orgId,
      sourceId: src.id,
      stateId: org?.stateId ?? null,
      sectorId,
      isCentral,
      parentId,
      advtNo: f.advtNo,
      totalPosts: f.totalPosts,
      postNames: f.postNames,
      location: f.location,
      qualificationText: f.qualificationText,
      ageMin: f.ageMin,
      ageMax: f.ageMax,
      ageText: f.ageText,
      feeText: f.feeText,
      salaryText: f.salaryText,
      jobType: f.jobType,
      selectionText: f.selectionText,
      howToApply: f.howToApply,
      importantDates: f.importantDates,
      noticeDate: f.noticeDate,
      applyStart: f.applyStart,
      applyEnd: f.applyEnd,
      examDate: f.examDate,
      notificationUrl,
      applyUrl: loaded?.applyUrl ?? null,
      sourcePageUrl: src.url,
      fieldSources,
      extractionConfidence: cls.confidence,
      verification: "auto",
      reviewReasons: reasons,
      dedupeKey: d.fingerprint,
      docHash: loaded?.hash ?? null,
      firstSeenAt: d.firstSeenAt,
      lastCheckedAt: now,
      publishedAt: status === "published" ? now : null,
    })
    .onConflictDoNothing()
    .returning({ id: notices.id });

  if (!created) {
    // Another worker created it concurrently (same dedupe key).
    const [row] = await db.select({ id: notices.id }).from(notices).where(eq(notices.dedupeKey, d.fingerprint));
    if (row) await markProcessed(row.id);
    return "duplicate";
  }

  if (cls.kind === "recruitment") {
    const qualIds = detectQualifications(f.qualificationText ?? docText.slice(0, 15_000), deps.taxonomy.qualifications);
    if (qualIds.length) {
      await db
        .insert(noticeQualifications)
        .values(qualIds.map((qualificationId) => ({ noticeId: created.id, qualificationId })))
        .onConflictDoNothing();
    }
  }
  await db.insert(noticeRevisions).values({ noticeId: created.id, changeType: "created", diff: { status: [null, status] }, actor: "pipeline" });
  await markProcessed(created.id);
  return status;
}

/**
 * Recruitment pages often keep years-old advertisements listed. Without a closing
 * date, a notice is treated as old when its advertisement/title year is before
 * last year, or when every date in the document is more than 90 days old.
 */
export function staleReason(title: string, advtNo: string | null, docText: string, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const years = [...`${title} ${advtNo ?? ""}`.matchAll(/(?:^|[^\d])(20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
  // "2025-26" style ranges: take the later year.
  const maxYear = years.length ? Math.max(...years) : null;
  if (maxYear && maxYear < year - 1) return `Older advertisement (${maxYear}) with no current closing date`;
  const dates = findAllDates(docText.slice(0, 30_000)).map((d) => d.iso).filter((d) => d <= addDays(today, 400));
  if (dates.length >= 2 && dates.every((d) => d < addDays(today, -90))) return "All dates in the notice are more than 90 days old";
  return null;
}

async function findRecruitment(db: DB, orgId: number, advtKey: string | null, title: string | null) {
  const candidates = await db
    .select()
    .from(notices)
    .where(
      and(
        eq(notices.organizationId, orgId),
        eq(notices.kind, "recruitment"),
        ne(notices.status, "rejected"),
        gte(notices.firstSeenAt, new Date(Date.now() - 2 * 365 * 86_400_000)),
      ),
    )
    .orderBy(desc(notices.firstSeenAt))
    .limit(200);
  if (advtKey) {
    const hit = candidates.find((c) => normalizeAdvt(c.advtNo) === advtKey);
    if (hit) return hit;
  }
  if (title) {
    let best: { row: (typeof candidates)[number]; score: number } | null = null;
    for (const c of candidates) {
      const s = similarity(title, c.title);
      if (s >= 0.5 && (!best || s > best.score)) best = { row: c, score: s };
    }
    return best?.row ?? null;
  }
  return null;
}

/** Marks published recruitments whose closing date has passed as closed. */
export async function closeExpired(db: DB, now = new Date()): Promise<number> {
  const today = todayIST(now);
  const rows = await db
    .select({ id: notices.id })
    .from(notices)
    .where(and(eq(notices.status, "published"), eq(notices.kind, "recruitment"), lt(notices.applyEnd, today)));
  const expired = rows.map((r) => r.id);
  if (!expired.length) return 0;
  await db.update(notices).set({ status: "closed", closedAt: now, updatedAt: now }).where(inArray(notices.id, expired));
  await db.insert(noticeRevisions).values(expired.map((noticeId) => ({ noticeId, changeType: "closed", diff: { status: ["published", "closed"] as [unknown, unknown] }, actor: "pipeline" })));
  return expired.length;
}
