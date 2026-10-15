/**
 * Date parsing for Indian government notices. Numeric dates are day-first
 * (dd-mm-yyyy). Returns ISO yyyy-mm-dd strings; never guesses a missing year.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

export function toIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Matches a single date expression anywhere in the string. */
export const DATE_PATTERN = new RegExp(
  [
    "\\b(\\d{1,2})[./-](\\d{1,2})[./-](\\d{4}|\\d{2})\\b", // 15-10-2026, 15.10.26
    `\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s-]+(?:of\\s+)?${MONTH_RE}\\.?,?[\\s-]+(\\d{4})\\b`, // 15th October, 2026 / 15-Oct-2026
    `\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, // October 15, 2026
    "\\b(\\d{4})-(\\d{2})-(\\d{2})\\b", // 2026-10-15
  ].join("|"),
  "gi",
);

export function parseDateMatch(m: RegExpExecArray | RegExpMatchArray): string | null {
  if (m[1] && m[2] && m[3]) return toIso(Number(m[3]), Number(m[2]), Number(m[1]));
  if (m[4] && m[5] && m[6]) return toIso(Number(m[6]), MONTHS[m[5].toLowerCase()] ?? 0, Number(m[4]));
  if (m[7] && m[8] && m[9]) return toIso(Number(m[9]), MONTHS[m[7].toLowerCase()] ?? 0, Number(m[8]));
  if (m[10] && m[11] && m[12]) return toIso(Number(m[10]), Number(m[11]), Number(m[12]));
  return null;
}

export function parseDate(text: string): string | null {
  const re = new RegExp(DATE_PATTERN.source, "i");
  const m = re.exec(text);
  return m ? parseDateMatch(m) : null;
}

export function findAllDates(text: string): { iso: string; index: number; raw: string }[] {
  const out: { iso: string; index: number; raw: string }[] = [];
  for (const m of text.matchAll(new RegExp(DATE_PATTERN.source, "gi"))) {
    const iso = parseDateMatch(m);
    if (iso) out.push({ iso, index: m.index ?? 0, raw: m[0] });
  }
  return out;
}

/** Today's date in India (IST), as yyyy-mm-dd. */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  return Math.round((Date.parse(toIsoDate + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86_400_000);
}
