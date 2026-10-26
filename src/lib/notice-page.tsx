import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getNotice } from "./queries";
import { formatDate, KIND_LABEL, noticeHref } from "./status";
import { NoticeDetail } from "@/components/NoticeDetail";
import { ogCard } from "./og";
import { SITE_NAME } from "./site";

const load = cache(getNotice);

export async function noticeMetadata(slug: string): Promise<Metadata> {
  const data = await load(slug);
  if (!data) notFound();
  const { n } = data;
  const parts = [
    data.orgName,
    n.totalPosts ? `${n.totalPosts.toLocaleString("en-IN")} posts` : null,
    n.applyEnd ? `Last date ${formatDate(n.applyEnd)}` : null,
    n.kind !== "recruitment" ? KIND_LABEL[n.kind] : null,
  ].filter(Boolean);
  const description = `${n.title}. ${parts.join(" · ")}. Official notification link, eligibility and important dates.`.slice(0, 300);
  return {
    title: n.title.length > 70 ? n.title.slice(0, 67) + "…" : n.title,
    description,
    alternates: { canonical: noticeHref(n) },
    openGraph: {
      title: n.title,
      description,
      type: "article",
      url: noticeHref(n),
      siteName: SITE_NAME,
      locale: "en_IN",
      publishedTime: (n.publishedAt ?? n.firstSeenAt).toISOString(),
      modifiedTime: n.updatedAt.toISOString(),
      section: KIND_LABEL[n.kind],
    },
    twitter: { card: "summary_large_image", title: n.title, description },
    robots: n.status === "withdrawn" ? { index: false, follow: true } : undefined,
  };
}

/** Renders a notice, redirecting to its canonical path when opened under the wrong prefix. */
export async function NoticePage({ slug, expectRecruitment }: { slug: string; expectRecruitment: boolean }) {
  const data = await load(slug);
  if (!data) notFound();
  if ((data.n.kind === "recruitment") !== expectRecruitment) permanentRedirect(noticeHref(data.n));
  return <NoticeDetail data={data} />;
}

/** Per-notice social preview card; falls back to the site card text when the notice is gone. */
export async function noticeOgImage(slug: string) {
  const data = await load(slug);
  if (!data) return ogCard({ eyebrow: "Government jobs", title: "Notice not found" });
  const { n } = data;
  const facts = [
    data.orgName,
    n.totalPosts ? `${n.totalPosts.toLocaleString("en-IN")} posts` : null,
    n.applyEnd ? `Last date ${formatDate(n.applyEnd)}` : null,
  ].filter((f): f is string => Boolean(f));
  return ogCard({ eyebrow: KIND_LABEL[n.kind], title: n.title, facts });
}
