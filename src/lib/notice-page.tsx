import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getNotice } from "./queries";
import { formatDate, KIND_LABEL, noticeHref } from "./status";
import { NoticeDetail } from "@/components/NoticeDetail";

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
    openGraph: { title: n.title, description, type: "article", url: noticeHref(n) },
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
