import type { NoticeKind } from "@/db/schema";

/** Default vocabulary a link must contain to be considered a recruitment-related notice. */
export const DEFAULT_INCLUDE = [
  "recruit", "advertisement", "advt", "vacanc", "notification", "walk[\\s-]?in", "engagement", "apply online",
  "online application", "applications? (?:are )?invited", "posts? of", "admit card", "hall ticket", "call letter",
  "result", "merit list", "answer key", "syllabus", "selection list", "selected candidates", "exam(?:ination)? (?:date|schedule)",
  "interview", "cut[\\s-]?off", "apprentice", "contractual", "deputation", "bharti", "भर्ती", "विज्ञापन", "रिक्ति",
];

/** Links matching these are never notices (procurement, RTI, publications, navigation). */
export const DEFAULT_EXCLUDE = [
  "tender", "e-?auction", "quotation", "\\beoi\\b", "expression of interest", "\\brfp\\b", "\\brti\\b", "annual report",
  "press release", "gallery", "photo", "video", "newsletter", "circular regarding leave", "holiday", "budget",
  "citizen charter", "disposal of", "sale of", "rate contract", "empanelment of (?:vendors|agencies)", "login", "sign ?in",
  "register here", "forgot password", "screen reader", "sitemap", "contact us", "feedback", "privacy policy", "disclaimer",
];

const KIND_RULES: [NoticeKind, RegExp][] = [
  ["answer_key", /\b(answer[\s-]?keys?|provisional keys?|final keys?|response sheets?)\b/i],
  ["admit_card", /\b(admit[\s-]?cards?|hall[\s-]?tickets?|call[\s-]?letters?|e-?admit|exam(?:ination)? city (?:intimation|slip))\b/i],
  ["result", /\b(results?|merit[\s-]?lists?|select(?:ion|ed)[\s-]?(?:list|candidates)|(?:provisionally|finally) selected|wait(?:ing)?[\s-]?list(?:ed)?|screened[\s-]?in|(?:in)?eligib(?:le|ility)(?: (?:and|&) rejected)?(?: candidates)? lists?|rejected candidates|short[\s-]?listed|marks? (?:obtained|of)|cut[\s-]?off|final selection|scorecards?|qualified candidates|list of (?:eligible|successful|candidates))\b/i],
  ["syllabus", /\b(syllabus|scheme of (?:exam|examination)|exam(?:ination)? pattern)\b/i],
  ["exam_date", /\b(exam(?:ination)? (?:schedule|dates?|calendar|programme)|(?:date|schedule) of (?:the )?(?:exam|examination|interview|conduct|conducting|cbt|test|skill test|written test|trade test)|interview schedule|skill test|(?:tentative )?programme (?:of|for) (?:the )?(?:exam|examination|interview|month)|tentative programme|time[\s-]?table|postpone(?:d|ment)|re-?schedul)/i],
  ["recruitment", /\b(recruit(?:ment)?|advertisement|advt\.?|vacanc(?:y|ies)|walk[\s-]?in|engagement of|applications? (?:are )?invited|apply online|online applications?|posts? of|notification for|direct recruitment|appointment of|contractual|deputation basis|apprentices?)\b|भर्ती|विज्ञापन/i],
];

export type Classification = { kind: NoticeKind; confidence: number };

/**
 * Classifies a notice from its title (and optionally body text). Title evidence
 * is strong; body-only evidence is weak. Recruitment is checked last because
 * follow-up notices (results, admit cards) often mention "recruitment" too.
 */
export function classify(title: string, body = ""): Classification {
  for (const [kind, re] of KIND_RULES) {
    if (re.test(title)) return { kind, confidence: kind === "recruitment" ? 0.85 : 0.9 };
  }
  const head = body.slice(0, 3000);
  for (const [kind, re] of KIND_RULES) {
    if (re.test(head)) return { kind, confidence: 0.55 };
  }
  return { kind: "other", confidence: 0.3 };
}

export function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.flatMap((p) => {
    try {
      return [new RegExp(p, "i")];
    } catch {
      return [];
    }
  });
}

/** Detects cancellation / withdrawal / corrigendum notices. */
export function detectAmendment(title: string): "cancelled" | "withdrawn" | "corrigendum" | "extension" | null {
  if (/\b(cancell?ed|cancell?ation|annulled)\b/i.test(title)) return "cancelled";
  if (/\bwithdrawn|withdrawal\b/i.test(title)) return "withdrawn";
  if (/\b(extension|extended|extend(?:ing)?)\b.*\b(date|deadline|last)\b|\b(date|deadline)\b.*\bextend/i.test(title)) return "extension";
  if (/\b(corrigend(?:um|a)|addend(?:um|a)|amendment|errat(?:um|a)|revised)\b/i.test(title)) return "corrigendum";
  return null;
}
