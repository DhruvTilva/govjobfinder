import { DATE_PATTERN, addDays, parseDateMatch } from "./dates";
import { clean, truncate } from "@/lib/text";
import type { ImportantDate } from "@/db/schema";

/**
 * Deterministic field extraction from notice text. Each extractor returns null
 * rather than guessing; the caller records which fields were established.
 */

export type Extracted = {
  advtNo: string | null;
  totalPosts: number | null;
  applyStart: string | null;
  applyEnd: string | null;
  examDate: string | null;
  noticeDate: string | null;
  ageMin: number | null;
  ageMax: number | null;
  ageText: string | null;
  feeText: string | null;
  salaryText: string | null;
  jobType: "permanent" | "contract" | "apprentice" | "deputation" | "unknown";
  importantDates: ImportantDate[];
  qualificationText: string | null;
  /** Other closing dates in the notice that disagree with `applyEnd` by more than 10 days. */
  applyEndAlternatives: string[];
};

const LABELS: { key: "applyEnd" | "applyStart" | "examDate" | "noticeDate"; label: string; re: RegExp }[] = [
  {
    key: "applyEnd",
    label: "Last date to apply",
    re: /(last|closing|end|final)\s*date(?:\s*(?:and|&)\s*time)?\s*(?:for|of|to)?\s*(?:the\s*)?(?:online\s*)?(?:submission|receipt|registration|applying|apply|application|payment)?(?:\s*of\s*(?:online\s*)?(?:applications?|forms?))?|applications?\s+(?:must|should)\s+(?:reach|be submitted)[^.]{0,40}?(?:by|on or before|before)|on\s+or\s+before|(?:online\s+)?(?:application|registration)\s+(?:closes?|ends?)\s*(?:on)?|closure\s+of\s+(?:online\s+)?(?:registration|application|editing)(?:\s+of\s+(?:application|details))?|(?:अंतिम|आखिरी)\s*(?:तिथि|तारीख|दिनांक)|शेवटची\s*(?:तारीख|दिनांक)|અંતિમ\s*તારીખ|শেষ\s*তারিখ|ಕೊನೆಯ\s*ದಿನಾಂಕ|கடைசி\s*(?:நாள்|தேதி)|చివరి\s*తేదీ|ଶେଷ\s*ତାରିଖ|അവസാന\s*തീയതി|(?:ਆਖਰੀ|ਅੰਤਿਮ)\s*(?:ਮਿਤੀ|ਿਮਤੀ|ਤਾਰੀਖ)/i,
  },
  {
    key: "applyStart",
    label: "Application starts",
    re: /(start(?:ing)?|opening|commencement|begin(?:ning)?)\s*(?:date)?\s*(?:of|for)?\s*(?:online\s*)?(?:submission|registration|application|apply)s?(?:\s+of\s+application)?|(?:online\s+)?(?:application|registration)\s+(?:starts?|opens?|begins?)\s*(?:on|from)?/i,
  },
  {
    key: "examDate",
    label: "Exam date",
    re: /(?:tentative\s+)?date\s*of\s*(?:the\s*)?(?:written\s*|computer\s*based\s*|online\s*)?(?:exam(?:ination)?|test|cbt)|(?:exam(?:ination)?|cbt|test)\s*(?:will\s*be\s*held\s*on|date|schedule)/i,
  },
  { key: "noticeDate", label: "Notification date", re: /(?:date\s*of\s*(?:advertisement|notification|publication|issue)|dated|dt\.)/i },
];

type DateHit = { iso: string; snippet: string; index: number };

/**
 * A label used as a reference point rather than a statement of the date:
 * "…within one year from the last date of receipt of application i.e. 20.07.2027".
 */
const REFERENCE_PREFIX = /\b(?:from|within|after|since|beyond|prior\s+to)\s+(?:[a-z]+\s+){0,4}?(?:the\s+)?$/i;

/** Every place a label is followed closely (within ~90 chars) by a date. */
function labelledDates(text: string, label: RegExp): DateHit[] {
  const re = new RegExp(label.source, "gi");
  const out: DateHit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (REFERENCE_PREFIX.test(text.slice(Math.max(0, m.index - 50), m.index))) continue;
    const window = text.slice(m.index, m.index + m[0].length + 90);
    const after = window.slice(m[0].length);
    const dm = new RegExp(DATE_PATTERN.source, "i").exec(after);
    if (dm) {
      const iso = parseDateMatch(dm);
      if (iso) out.push({ iso, index: m.index, snippet: clean(window.slice(0, m[0].length + (dm.index ?? 0) + dm[0].length)) ?? "" });
    }
  }
  return out;
}

/** "Online Registration … 01-07-2026 to 21-07-2026" in an important-dates table. */
const RANGE_RE = new RegExp(
  `(?:on-?line\\s+)?(?:registration|application|apply(?:ing)?)(?:(?!${DATE_PATTERN.source})[\\s\\S]){0,120}?(${DATE_PATTERN.source})\\s*(?:to|till|upto|up\\s*to|-|–)\\s*(${DATE_PATTERN.source})`,
  "gi",
);

function rangeDates(text: string): { start: DateHit; end: DateHit }[] {
  const out: { start: DateHit; end: DateHit }[] = [];
  for (const m of text.matchAll(RANGE_RE)) {
    const snippet = clean(m[0]) ?? "";
    const dates = [...m[0].matchAll(new RegExp(DATE_PATTERN.source, "gi"))].map((d) => parseDateMatch(d));
    const [start, end] = dates.slice(-2);
    if (start && end && start <= end) out.push({ start: { iso: start, index: m.index!, snippet }, end: { iso: end, index: m.index!, snippet } });
  }
  return out;
}

/** Deadlines for steps other than applying ("last date for printing the application"). */
const NOT_APPLICATION_DEADLINE = /print|download|admit|call\s*letter|result|objection|interview|hard\s*copy\s*(?:of|for)\s*(?:the\s*)?admit/i;
const REVISED = /revised|extended|postponed|re-?scheduled/i;

const daysBetween =(a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

export function extractAdvtNo(text: string): string | null {
  const m =
    /\b(?:advt\.?|advertisement|notification|(?:employment\s+|recruitment\s+)?notice)\s*(?:no\.?|number|#)\s*[:.\-–]?\s*([A-Z0-9][A-Z0-9/().\-–\s]{1,40}?\d[A-Z0-9/()\-–]*)/i.exec(text) ??
    /\b(?:CEN|RRC|ADVT|NOTIFICATION)\s*(?:No\.?)?\s*[:\-]?\s*(\d{1,3}\s*\/\s*20\d{2})\b/i.exec(text);
  if (!m) return null;
  const v = clean(m[1]!.replace(/\s*[–-]\s*$/, ""));
  if (!v || v.length < 2 || v.length > 45) return null;
  return v;
}

export function extractTotalPosts(text: string): number | null {
  const patterns = [
    /total\s*(?:no\.?\s*of\s*)?(?:posts?|vacanc(?:y|ies))\s*[:\-–=]?\s*(\d{1,6})/i,
    /(?:no\.?|number)\s*of\s*(?:posts?|vacanc(?:y|ies))\s*[:\-–=]?\s*(\d{1,6})\b(?!\s*(?:years|yrs|%))/i,
    /\b(\d{1,6})\s*(?:\(\s*[a-z\s-]+\)\s*)?(?:posts?|vacanc(?:y|ies))\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const n = Number(m[1]);
      if (n > 0 && n < 500000) return n;
    }
  }
  return null;
}

export function extractAge(text: string): { min: number | null; max: number | null; text: string | null } {
  const m =
    /age\s*(?:limit)?[^.\n]{0,60}?(\d{2})\s*(?:years?|yrs\.?)?\s*(?:to|-|–|and)\s*(\d{2})\s*(?:years?|yrs\.?)/i.exec(text) ??
    /between\s*(\d{2})\s*(?:to|-|–|and)\s*(\d{2})\s*years/i.exec(text);
  if (m) {
    const min = Number(m[1]);
    const max = Number(m[2]);
    if (min >= 14 && max <= 70 && min < max) return { min, max, text: clean(m[0]) };
  }
  const maxOnly = /(?:upper\s*age\s*limit|maximum\s*age|not\s*(?:be\s*)?(?:more|older)\s*than|should\s*not\s*exceed)[^.\n]{0,30}?(\d{2})\s*years/i.exec(text);
  if (maxOnly) {
    const max = Number(maxOnly[1]);
    if (max >= 18 && max <= 70) return { min: null, max, text: clean(maxOnly[0]) };
  }
  return { min: null, max: null, text: null };
}

function sentenceAround(text: string, re: RegExp, max = 280): string | null {
  const m = re.exec(text);
  if (!m) return null;
  const start = Math.max(0, text.lastIndexOf("\n", m.index) + 1);
  let end = text.indexOf("\n", m.index + m[0].length);
  if (end < 0) end = text.length;
  // Include the following line too — fee tables often wrap.
  const next = text.indexOf("\n", end + 1);
  const chunk = text.slice(start, next > 0 && next - start < max ? next : end);
  return clean(truncate(chunk, max));
}

export function extractFee(text: string): string | null {
  return sentenceAround(text, /(application|examination|exam)\s*fee|fee\s*(?:payable|structure|details)/i);
}

export function extractSalary(text: string): string | null {
  return sentenceAround(text, /pay\s*(?:level|scale|matrix|band)|level[\s-]?\d{1,2}\s*\(|(?:monthly\s*)?(?:salary|emoluments|remuneration|stipend|consolidated\s*pay)/i);
}

export function extractQualificationText(text: string): string | null {
  return sentenceAround(text, /(?:essential\s*)?(?:educational\s*)?qualifications?\s*(?:required)?\s*[:\-–]|eligibility\s*criteria/i, 400);
}

export function extractJobType(text: string): Extracted["jobType"] {
  const t = text.slice(0, 6000);
  if (/\bapprentice(?:ship)?s?\b/i.test(t)) return "apprentice";
  if (/\bon\s+deputation\b|deputation\s+basis/i.test(t)) return "deputation";
  if (/\b(contract(?:ual)?\s*basis|on\s+contract|contractual|tenure\s+(?:basis|of)|walk[\s-]?in|temporary\s+basis|outsourc)/i.test(t)) return "contract";
  if (/\b(regular\s*basis|permanent|direct\s+recruitment)\b/i.test(t)) return "permanent";
  return "unknown";
}

export function extractFields(text: string): Extracted {
  const t = text.replace(/\r/g, "").slice(0, 60_000);
  const dates: Partial<Record<(typeof LABELS)[number]["key"], string>> = {};
  const importantDates: ImportantDate[] = [];
  const ranges = rangeDates(t);
  let applyEndAlternatives: string[] = [];
  for (const l of LABELS) {
    let hits = labelledDates(t, l.re);
    if (l.key === "applyEnd") hits = [...hits, ...ranges.map((r) => r.end)].filter((h) => !NOT_APPLICATION_DEADLINE.test(h.snippet));
    if (l.key === "applyStart") hits = [...hits, ...ranges.map((r) => r.start)];
    // The earliest mention wins (important-dates tables sit near the top of a notice),
    // except that an explicitly revised/extended date supersedes the original.
    hits.sort((a, b) => a.index - b.index);
    const revised = l.key === "applyEnd" ? hits.filter((h) => REVISED.test(h.snippet) && !/fee|remit|payment/i.test(h.snippet)).sort((a, b) => b.iso.localeCompare(a.iso))[0] : undefined;
    const hit = revised ?? hits[0];
    if (hit) {
      dates[l.key] = hit.iso;
      importantDates.push({ label: l.label, date: hit.iso, text: truncate(hit.snippet, 160) });
      // Fee-payment deadlines a few days later are normal; anything further apart is a conflict.
      // Dates superseded by a revision, and dates months earlier (age cut-offs, cited orders), are not.
      if (l.key === "applyEnd") {
        applyEndAlternatives = [
          ...new Set(
            hits
              .filter((h) => daysBetween(h.iso, hit.iso) > 10 && !(revised && h.iso < revised.iso) && h.iso > addDays(hit.iso, -90))
              .map((h) => h.iso),
          ),
        ];
      }
    }
  }
  // A start date after the end date means one of them was mis-read; drop the start date.
  if (dates.applyStart && dates.applyEnd && dates.applyStart > dates.applyEnd) {
    delete dates.applyStart;
    importantDates.splice(importantDates.findIndex((d) => d.label === "Application starts"), 1);
  }
  // "dated 07/01/2004" often refers to an old rule or order cited in the notice, not the notice itself.
  const ref = dates.applyEnd ?? dates.applyStart;
  if (dates.noticeDate && ref && dates.noticeDate < addDays(ref, -400)) {
    delete dates.noticeDate;
    importantDates.splice(importantDates.findIndex((d) => d.label === "Notification date"), 1);
  }
  const age = extractAge(t);
  return {
    advtNo: extractAdvtNo(t),
    totalPosts: extractTotalPosts(t),
    applyStart: dates.applyStart ?? null,
    applyEnd: dates.applyEnd ?? null,
    examDate: dates.examDate ?? null,
    noticeDate: dates.noticeDate ?? null,
    ageMin: age.min,
    ageMax: age.max,
    ageText: age.text,
    feeText: extractFee(t),
    salaryText: extractSalary(t),
    jobType: extractJobType(t),
    importantDates,
    qualificationText: extractQualificationText(t),
    applyEndAlternatives,
  };
}

/** Matches qualification patterns against text; returns matched qualification ids. */
export function detectQualifications(text: string, quals: { id: number; patterns: string[] }[]): number[] {
  const t = text.slice(0, 40_000);
  return quals
    .filter((q) =>
      q.patterns.some((p) => {
        try {
          return new RegExp(p, "i").test(t);
        } catch {
          return false;
        }
      }),
    )
    .map((q) => q.id);
}

/** Picks the best sector by keyword hits in title (weighted) and text. */
export function detectSector(title: string, text: string, sectors: { id: number; keywords: string[] }[]): number | null {
  const tl = title.toLowerCase();
  const bl = text.slice(0, 8000).toLowerCase();
  let best: { id: number; score: number } | null = null;
  for (const s of sectors) {
    let score = 0;
    for (const k of s.keywords) {
      const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      if (re.test(tl)) score += 3;
      else if (re.test(bl)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: s.id, score };
  }
  return best && best.score >= 2 ? best.id : null;
}
