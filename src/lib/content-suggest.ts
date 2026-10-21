import { classify } from "@/pipeline/classify";
import { extractFields } from "@/pipeline/extract";
import type { NoticeKind } from "@/db/schema";

/**
 * Suggested form values from an uploaded notice's text, using the same extractors the
 * pipeline uses. Only values actually found are returned; the editor reviews them before
 * anything is saved, so nothing extracted here is published without a person checking it.
 */
export type Suggestions = Partial<{
  title: string;
  kind: NoticeKind;
  advtNo: string;
  totalPosts: number;
  noticeDate: string;
  applyStart: string;
  applyEnd: string;
  examDate: string;
  ageMin: number;
  ageMax: number;
  ageText: string;
  feeText: string;
  salaryText: string;
  qualificationText: string;
  jobType: string;
}>;

const TITLE_WORDS = /recruit|advertisement|notification|vacanc|posts? of|engagement|walk.?in|admit card|result|answer key|admission|syllabus|examination/i;

/** A heading-like line from the first part of the document that names the notice. */
export function guessTitle(text: string): string | null {
  const lines = text.slice(0, 4000).split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const line = lines.find((l) => l.length >= 20 && l.length <= 200 && TITLE_WORDS.test(l) && !/^(page|www\.|http)/i.test(l));
  return line ?? null;
}

export function suggestFromText(text: string): Suggestions {
  const f = extractFields(text);
  const title = guessTitle(text);
  const cls = classify(title ?? "", text);
  const out: Suggestions = {};
  if (title) out.title = title;
  if (cls.kind !== "other") out.kind = cls.kind;
  const put = <K extends keyof Suggestions>(k: K, v: Suggestions[K] | null | undefined) => {
    if (v != null && v !== "unknown") out[k] = v;
  };
  put("advtNo", f.advtNo);
  put("totalPosts", f.totalPosts);
  put("noticeDate", f.noticeDate);
  put("applyStart", f.applyStart);
  put("applyEnd", f.applyEnd);
  put("examDate", f.examDate);
  put("ageMin", f.ageMin);
  put("ageMax", f.ageMax);
  put("ageText", f.ageText);
  put("feeText", f.feeText);
  put("salaryText", f.salaryText);
  put("qualificationText", f.qualificationText);
  put("jobType", f.jobType);
  return out;
}
