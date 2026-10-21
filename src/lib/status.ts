import type { NoticeKind, NoticeStatus } from "@/db/schema";

export const KIND_LABEL: Record<NoticeKind, string> = {
  recruitment: "Recruitment",
  admit_card: "Admit Card",
  result: "Result",
  answer_key: "Answer Key",
  syllabus: "Syllabus",
  exam_date: "Exam Schedule",
  admission: "Admission",
  other: "Notice",
};

/** Public listing route for each kind. */
export const KIND_PATH: Record<NoticeKind, string> = {
  recruitment: "/jobs",
  admit_card: "/admit-cards",
  result: "/results",
  answer_key: "/answer-keys",
  syllabus: "/updates",
  exam_date: "/updates",
  admission: "/admissions",
  other: "/updates",
};

export function noticeHref(n: { kind: NoticeKind; slug: string }) {
  return n.kind === "recruitment" ? `/jobs/${n.slug}` : `/updates/${n.slug}`;
}

export type DisplayStatus = "open" | "closing" | "upcoming" | "closed" | "cancelled" | "withdrawn" | "no_date" | "update";

/** Candidate-facing status derived from lifecycle status and dates (IST). */
export function displayStatus(
  n: { kind: NoticeKind; status: NoticeStatus; applyStart: string | null; applyEnd: string | null },
  today: string,
): DisplayStatus {
  if (n.status === "cancelled") return "cancelled";
  if (n.status === "withdrawn") return "withdrawn";
  if (n.kind !== "recruitment") return "update";
  if (n.status === "closed" || (n.applyEnd && n.applyEnd < today)) return "closed";
  if (n.applyStart && n.applyStart > today) return "upcoming";
  if (!n.applyEnd) return "no_date";
  const days = Math.round((Date.parse(n.applyEnd) - Date.parse(today)) / 86_400_000);
  return days <= 7 ? "closing" : "open";
}

export const STATUS_STYLE: Record<DisplayStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-ok-soft text-ok" },
  closing: { label: "Closing soon", cls: "bg-urgent-soft text-urgent" },
  upcoming: { label: "Opens soon", cls: "bg-navy-100 text-navy-900" },
  closed: { label: "Closed", cls: "bg-slate-200 text-slate-700" },
  cancelled: { label: "Cancelled", cls: "bg-danger-soft text-danger" },
  withdrawn: { label: "Withdrawn", cls: "bg-danger-soft text-danger" },
  no_date: { label: "Last date not stated", cls: "bg-slate-100 text-slate-700" },
  update: { label: "Update", cls: "bg-navy-50 text-navy-900" },
};

export function daysLeft(applyEnd: string | null, today: string): number | null {
  if (!applyEnd) return null;
  return Math.round((Date.parse(applyEnd) - Date.parse(today)) / 86_400_000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

export function timeAgo(d: Date | string | null | undefined, now = new Date()): string {
  if (!d) return "never";
  const ms = now.getTime() - new Date(d).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
