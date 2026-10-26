import Link from "next/link";
import type { getNotice } from "@/lib/queries";
import { uploadPath } from "@/lib/storage";
import { OrgBadge } from "./NoticeCard";
import { daysLeft, displayStatus, KIND_LABEL, KIND_PATH, noticeHref } from "@/lib/status";
import { educationLd, graph, ORG_ID, organizationLd, textToHtml, WEBSITE_ID } from "@/lib/seo";
import { logoPath } from "@/lib/logo-url";
import { hostnameOf, isOfficialUrl, safeHref } from "@/lib/url";
import { siteUrl } from "@/lib/site";
import { todayIST } from "@/pipeline/dates";
import type { FieldSource } from "@/db/schema";
import { getI18n } from "@/lib/i18n-server";
import { formatDateL, qualName, sectorName, stateName, type Lang, type MessageKey, type T } from "@/lib/i18n";
import { StatusBadge } from "./NoticeCard";
import { Breadcrumbs } from "./Nav";
import { SaveButton } from "./SaveButton";
import { JsonLd } from "./JsonLd";
import { AlertIcon, BuildingIcon, ClockIcon, DocIcon, ExternalIcon, PinIcon, ShieldIcon } from "./icons";

type Data = NonNullable<Awaited<ReturnType<typeof getNotice>>>;

/** Labels the extractor stores for important dates, mapped to translated labels. */
const DATE_LABEL_KEY: Record<string, MessageKey> = {
  "Last date to apply": "detail.lastDateApply",
  "Application starts": "detail.opens",
  "Exam date": "detail.examDate",
  "Notification date": "detail.noticeDate",
};

const CHANGE_TYPES = ["deadline_extended", "deadline_changed", "updated", "cancelled", "withdrawn", "corrigendum", "closed"];

function dateTime(d: Date | null | undefined, lang: Lang) {
  if (!d) return "—";
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(d);
}

export async function NoticeDetail({ data }: { data: Data }) {
  const { t, lang } = await getI18n();
  const { n } = data;
  const today = todayIST();
  const ds = displayStatus(n, today);
  const left = daysLeft(n.applyEnd, today);
  const isJob = n.kind === "recruitment";
  const domains = data.orgDomains ?? [];
  const fs = n.fieldSources ?? {};
  const listPath = KIND_PATH[n.kind];
  const fmt = (iso: string | null) => (iso ? formatDateL(iso, lang) : null);
  const kindLabel = t(`kind.${n.kind}` as MessageKey);
  // Editor-entered notices show only the fields the editor filled; "not stated in notice" is
  // kept for collected notices, where it tells readers the automatic reading found nothing.
  const manual = n.verification === "manual" && !n.dedupeKey;
  const show = (v: unknown) => !manual || (v != null && v !== "" && v !== "unknown");
  const hasFacts = [n.applyEnd, n.applyStart, n.totalPosts, n.advtNo, n.examDate, n.noticeDate, n.ageMin ?? n.ageMax, n.jobType].some((v) => v != null && v !== "unknown");

  return (
    <div className="container-page py-6">
      <Breadcrumbs
        items={[
          { href: listPath, label: isJob ? t("detail.latestJobs") : kindLabel },
          ...(data.stateSlug ? [{ href: `/states/${data.stateSlug}`, label: stateName(lang, data.stateSlug, data.stateName!) }] : []),
          { label: n.title.length > 60 ? n.title.slice(0, 57) + "…" : n.title },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <article className="min-w-0 space-y-5">
          <header className="card p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {isJob ? <StatusBadge status={ds} /> : <span className="chip bg-navy-50 text-navy-900">{kindLabel}</span>}
              {n.isCentral && <span className="chip bg-slate-100 text-slate-700">{t("detail.centralGovt")}</span>}
              {n.verification === "reviewed" || n.verification === "manual" ? (
                <span className="chip bg-ok-soft text-ok">
                  <ShieldIcon className="h-3 w-3" /> {t("detail.reviewed")}
                </span>
              ) : (
                <span className="chip bg-slate-100 text-slate-700" title={t("detail.autoTitle")}>
                  {t("detail.auto")}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl leading-tight sm:text-[28px]">{n.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              {data.orgName && (
                <Link href={`/organizations/${data.orgSlug}`} className="flex items-center gap-1.5 hover:text-navy-950 hover:underline">
                  {data.orgLogoId ? <OrgBadge short={data.orgShort} name={data.orgName} logoId={data.orgLogoId} size="sm" /> : <BuildingIcon />} {data.orgName}
                </Link>
              )}
              <span className="flex items-center gap-1">
                <PinIcon /> {data.stateName ? stateName(lang, data.stateSlug, data.stateName) : n.isCentral ? t("common.allIndia") : t("detail.locationUnknown")}
              </span>
              {data.sectorName && (
                <Link href={`/sectors/${data.sectorSlug}`} className="hover:text-navy-950 hover:underline">
                  {sectorName(lang, data.sectorSlug, data.sectorName)}
                </Link>
              )}
            </div>

            {(n.status === "cancelled" || n.status === "withdrawn") && <Banner tone="danger">{t("detail.cancelled", { s: t(`status.${n.status}` as MessageKey) })}</Banner>}
            {isJob && ds === "closed" && <Banner tone="muted">{n.applyEnd ? t("detail.closedOn", { date: fmt(n.applyEnd)! }) : t("detail.closed")}</Banner>}
            {isJob && ds === "closing" && left != null && <Banner tone="urgent">{left === 0 ? t("detail.lastDayToday") : t("detail.onlyLeft", { n: left })}</Banner>}

            <div className="mt-4 flex flex-wrap gap-2">
              <OfficialLink url={n.notificationUrl} label={t("detail.officialNotification")} domains={domains} primary t={t} />
              {data.attachmentId && data.attachmentName && (
                <a href={uploadPath({ id: data.attachmentId, fileName: data.attachmentName })} target="_blank" rel="noopener noreferrer" className={n.notificationUrl ? "btn-secondary" : "btn-primary"}>
                  <span>
                    {t("detail.pdfCopy")}
                    <span className={`block text-[11px] font-normal ${n.notificationUrl ? "text-muted" : "text-white/80"}`}>{t("detail.pdfCopyNote")}</span>
                  </span>
                  <DocIcon />
                </a>
              )}
              <OfficialLink url={n.applyUrl} label={t("detail.applyPortal")} domains={domains} t={t} />
              <SaveButton item={{ slug: n.slug, kind: n.kind, title: n.title, applyEnd: n.applyEnd, org: data.orgShort ?? data.orgName }} />
            </div>
          </header>

          {isJob && (!manual || hasFacts) && (
            <section className="card p-5" aria-labelledby="facts">
              <h2 id="facts" className="text-xl">
                {t("detail.keyDetails")}
              </h2>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {show(n.applyEnd) && <Fact t={t} label={t("detail.lastDateApply")} value={fmt(n.applyEnd)} source={fs.applyEnd} strong />}
                {show(n.applyStart) && <Fact t={t} label={t("detail.opens")} value={fmt(n.applyStart)} source={fs.applyStart} />}
                {show(n.totalPosts) && <Fact t={t} label={t("detail.totalPosts")} value={n.totalPosts?.toLocaleString("en-IN")} source={fs.totalPosts} />}
                {show(n.advtNo) && <Fact t={t} label={t("detail.advt")} value={n.advtNo} source={fs.advtNo} />}
                {show(n.examDate) && <Fact t={t} label={t("detail.examDate")} value={fmt(n.examDate)} source={fs.examDate} />}
                {show(n.noticeDate) && <Fact t={t} label={t("detail.noticeDate")} value={fmt(n.noticeDate)} source={fs.noticeDate} />}
                {show(n.ageMin ?? n.ageMax) && <Fact
                  t={t}
                  label={t("detail.age")}
                  value={n.ageMin || n.ageMax ? t("detail.ageRange", { a: n.ageMin ?? "—", b: n.ageMax ?? "—" }) : null}
                  source={fs.ageMax ?? fs.ageMin}
                  note={n.ageText ?? undefined}
                />}
                {show(n.jobType) && <Fact t={t} label={t("detail.jobType")} value={n.jobType !== "unknown" ? t(`jobType.${n.jobType}` as MessageKey) : null} source={fs.jobType} />}
              </dl>
            </section>
          )}

          {n.summary && (
            <Section t={t} title={t("detail.summary")} source={fs.summary}>
              <p>{n.summary}</p>
            </Section>
          )}

          {isJob && (!manual || n.qualificationText || data.quals.length > 0 || n.experienceText) && (
            <Section t={t} title={t("detail.eligibility")} source={fs.qualificationText}>
              {data.quals.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {data.quals.map((q) => (
                    <li key={q.slug}>
                      <Link href={`/qualifications/${q.slug}`} className="chip border border-line bg-white text-ink hover:bg-navy-50">
                        {qualName(lang, q.slug, q.name)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {n.qualificationText ? <p>{n.qualificationText}</p> : <NotStated t={t} what={t("detail.whatQual")} />}
              {n.experienceText && <p className="mt-2">{n.experienceText}</p>}
            </Section>
          )}
          {isJob && show(n.feeText) && (
            <Section t={t} title={t("detail.fee")} source={fs.feeText}>
              {n.feeText ? <p>{n.feeText}</p> : <NotStated t={t} what={t("detail.whatFee")} />}
            </Section>
          )}
          {isJob && show(n.salaryText) && (
            <Section t={t} title={t("detail.pay")} source={fs.salaryText}>
              {n.salaryText ? <p>{n.salaryText}</p> : <NotStated t={t} what={t("detail.whatPay")} />}
            </Section>
          )}
          {n.selectionText && (
            <Section t={t} title={t("detail.selection")} source={fs.selectionText}>
              <p>{n.selectionText}</p>
            </Section>
          )}
          {n.howToApply && (
            <Section t={t} title={t("detail.howToApply")} source={fs.howToApply}>
              <p className="whitespace-pre-line">{n.howToApply}</p>
            </Section>
          )}
          {n.documentsText && (
            <Section t={t} title={t("detail.documents")}>
              <p className="whitespace-pre-line">{n.documentsText}</p>
            </Section>
          )}

          {n.importantDates.length > 0 && (
            <Section t={t} title={t("detail.dates")}>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {n.importantDates.map((d, i) => (
                    <tr key={i}>
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                        {DATE_LABEL_KEY[d.label] ? t(DATE_LABEL_KEY[d.label]) : d.label}
                      </th>
                      <td className="py-2">
                        <span className="font-semibold text-ink">{d.date ? formatDateL(d.date, lang) : "—"}</span>
                        {d.text && <span className="mt-0.5 block text-xs text-muted">“{d.text}”</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {(data.parent || data.children.length > 0 || n.links.length > 0) && (
            <Section t={t} title={t("detail.updates")}>
              <ol className="space-y-2 border-l-2 border-navy-100 pl-4">
                {data.parent && (
                  <li>
                    <span className="text-xs font-semibold uppercase text-muted">{t("detail.original")}</span>
                    <Link href={noticeHref(data.parent)} className="block text-navy-700 hover:underline">
                      {data.parent.title}
                    </Link>
                  </li>
                )}
                {data.children.map((c) => (
                  <li key={c.slug}>
                    <span className="text-xs font-semibold uppercase text-muted">
                      {t(`kind.${c.kind}` as MessageKey)} · {formatDateL((c.publishedAt ?? c.firstSeenAt).toISOString(), lang)}
                    </span>
                    <Link href={noticeHref(c)} className="block text-navy-700 hover:underline">
                      {c.title}
                    </Link>
                  </li>
                ))}
                {n.links.map((l) => (
                  <li key={l.url}>
                    <span className="text-xs font-semibold uppercase text-muted">{t("detail.officialDoc")}</span>
                    <a href={safeHref(l.url) ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="block text-navy-700 hover:underline">
                      {l.label} <ExternalIcon className="inline h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {data.revisions.length > 0 && (
            <Section t={t} title={t("detail.history")}>
              <ul className="space-y-1 text-sm">
                {data.revisions.map((r, i) => (
                  <li key={i}>
                    <span className="text-muted">{dateTime(r.createdAt, lang)}</span> —{" "}
                    {CHANGE_TYPES.includes(r.changeType) ? t(`change.${r.changeType}` as MessageKey) : r.changeType}
                    {r.diff.applyEnd && (
                      <>
                        : {t("change.lastDate")} {formatDateL(String(r.diff.applyEnd[0] ?? ""), lang)} → <strong>{formatDateL(String(r.diff.applyEnd[1]), lang)}</strong>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <p className="flex gap-2 rounded-lg bg-urgent-soft p-3 text-sm text-ink">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-urgent" />
            {t("detail.disclaimer")}
          </p>
        </article>

        <aside className="min-w-0 space-y-4">
          <section className="card p-4 text-sm">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted">
              <DocIcon /> {t("detail.source")}
            </h2>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="text-xs text-muted">{t("detail.foundOn")}</dt>
                <dd>
                  {n.sourcePageUrl ? (
                    <a href={safeHref(n.sourcePageUrl) ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-navy-700 hover:underline">
                      {hostnameOf(n.sourcePageUrl)}
                    </a>
                  ) : (
                    t("detail.addedByEditor")
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("detail.firstSeen")}</dt>
                <dd>{dateTime(n.firstSeenAt, lang)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("detail.lastChecked")}</dt>
                <dd className="flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5 text-muted" /> {dateTime(n.lastCheckedAt ?? n.updatedAt, lang)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("detail.howFilled")}</dt>
                <dd className="text-xs">
                  {manual ? (
                    t("detail.filledManual")
                  ) : (
                    <>
                      {t("detail.filledAuto")}
                      {Object.values(fs).includes("ai") ? t("detail.filledAi") : ""}
                      {n.verification !== "auto" ? t("detail.filledEditor") : ""}
                    </>
                  )}
                  .
                </dd>
              </div>
            </dl>
          </section>
          {data.related.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-1 text-lg">{t("detail.moreFrom", { org: data.orgShort ?? data.orgName ?? "" })}</h2>
              <ul className="divide-y divide-line">
                {data.related.slice(0, 6).map((r) => {
                  const rs = displayStatus(r, today);
                  return (
                    <li key={r.id} className="py-2.5">
                      <Link href={noticeHref(r)} className="line-clamp-2 text-sm font-medium text-ink hover:underline">
                        {r.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        {r.kind === "recruitment"
                          ? r.applyEnd
                            ? `${t("common.lastDate")} ${formatDateL(r.applyEnd, lang)}`
                            : t(`status.${rs}` as MessageKey)
                          : t(`kind.${r.kind}` as MessageKey)}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {data.orgSlug && (
                <Link href={`/organizations/${data.orgSlug}`} className="mt-2 inline-block text-sm font-semibold text-navy-700 hover:underline">
                  {t("detail.allFrom", { org: data.orgShort ?? data.orgName ?? "" })}
                </Link>
              )}
            </section>
          )}
        </aside>
      </div>
      <ArticleLd data={data} />
      {isJob && ds !== "closed" && n.status === "published" && <JobPostingLd data={data} />}
    </div>
  );
}

function OfficialLink({ url, label, domains, primary, t }: { url: string | null; label: string; domains: string[]; primary?: boolean; t: T }) {
  const href = safeHref(url);
  if (!href) return null;
  const official = isOfficialUrl(href, domains);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={primary ? "btn-primary" : "btn-secondary"}>
      <span>
        {label}
        <span className={`block text-[11px] font-normal ${primary ? "text-white/80" : "text-muted"}`}>
          {hostnameOf(href)} · {official ? t("detail.officialDomain") : t("detail.verifyDomain")}
        </span>
      </span>
      <ExternalIcon />
    </a>
  );
}

function Banner({ tone, children }: { tone: "danger" | "urgent" | "muted"; children: React.ReactNode }) {
  const cls = { danger: "bg-danger-soft text-danger", urgent: "bg-urgent-soft text-urgent", muted: "bg-slate-100 text-slate-700" }[tone];
  return <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${cls}`}>{children}</p>;
}

function SourceTag({ source, t }: { source?: FieldSource; t: T }) {
  if (source === "ai") return <span className="chip ml-1.5 bg-navy-50 text-[10px] text-navy-700">{t("detail.aiTag")}</span>;
  if (source === "admin") return <span className="chip ml-1.5 bg-ok-soft text-[10px] text-ok">{t("detail.editorTag")}</span>;
  return null;
}

function Fact({ label, value, source, note, strong, t }: { label: string; value?: string | null; source?: FieldSource; note?: string; strong?: boolean; t: T }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
        <SourceTag source={value ? source : undefined} t={t} />
      </dt>
      <dd className={value ? (strong ? "text-lg font-bold text-ink" : "font-semibold text-ink") : "text-sm italic text-muted"}>{value ?? t("common.notStatedNotice")}</dd>
      {note && <dd className="mt-0.5 text-xs text-muted">{note}</dd>}
    </div>
  );
}

function Section({ title, source, children, t }: { title: string; source?: FieldSource; children: React.ReactNode; t: T }) {
  return (
    <section className="card p-5 text-[15px] leading-relaxed">
      <h2 className="mb-2 text-xl">
        {title}
        <SourceTag source={source} t={t} />
      </h2>
      {children}
    </section>
  );
}

function NotStated({ what, t }: { what: string; t: T }) {
  return <p className="text-sm italic text-muted">{t("detail.notReadable", { what })}</p>;
}

const EMPLOYMENT_TYPE: Record<string, string> = { permanent: "FULL_TIME", contract: "CONTRACTOR", apprentice: "INTERN", deputation: "OTHER" };

/** schema.org JobPosting — only for open recruitments with enough real description. */
function JobPostingLd({ data }: { data: Data }) {
  const { n } = data;
  const description = [n.summary, n.qualificationText && `Eligibility: ${n.qualificationText}`, n.salaryText && `Pay: ${n.salaryText}`, n.feeText && `Fee: ${n.feeText}`]
    .filter(Boolean)
    .join("\n\n");
  if (!description || !data.orgName) return null;
  const education = educationLd(data.quals);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: n.title,
        description: textToHtml(description),
        datePosted: (n.publishedAt ?? n.firstSeenAt).toISOString(),
        ...(n.applyEnd ? { validThrough: `${n.applyEnd}T23:59:59+05:30` } : {}),
        ...(n.totalPosts ? { totalJobOpenings: n.totalPosts } : {}),
        ...(EMPLOYMENT_TYPE[n.jobType] ? { employmentType: EMPLOYMENT_TYPE[n.jobType] } : {}),
        ...(education ? { educationRequirements: education } : {}),
        hiringOrganization: {
          "@type": "Organization",
          name: data.orgName,
          ...(data.orgWebsite ? { sameAs: data.orgWebsite } : {}),
          ...(data.orgLogoId ? { logo: siteUrl(logoPath(data.orgLogoId)) } : {}),
        },
        jobLocation: {
          "@type": "Place",
          address: { "@type": "PostalAddress", addressCountry: "IN", ...(data.stateName ? { addressRegion: data.stateName } : {}) },
        },
        ...(n.isCentral ? { applicantLocationRequirements: { "@type": "Country", name: "India" } } : {}),
        identifier: n.advtNo ? { "@type": "PropertyValue", name: data.orgName, value: n.advtNo } : undefined,
        url: siteUrl(noticeHref(n)),
        directApply: false,
      }}
    />
  );
}

/** schema.org Article for every notice page (results, admit cards and recruitments alike). */
function ArticleLd({ data }: { data: Data }) {
  const { n } = data;
  const url = siteUrl(noticeHref(n));
  const description = n.summary ?? `${n.title}${data.orgName ? ` – ${data.orgName}` : ""}. Official notification link, eligibility and important dates.`;
  return (
    <JsonLd
      data={graph({
        "@type": "Article",
        "@id": `${url}#article`,
        headline: n.title.length > 110 ? n.title.slice(0, 107) + "…" : n.title,
        description,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        datePublished: (n.publishedAt ?? n.firstSeenAt).toISOString(),
        dateModified: n.updatedAt.toISOString(),
        // Per-notice OG image paths carry a build hash, so use the stable site images here.
        image: [siteUrl("/opengraph-image"), siteUrl("/logo.png")],
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        isPartOf: { "@id": WEBSITE_ID },
        articleSection: KIND_LABEL[n.kind],
        inLanguage: "en-IN",
        ...(data.orgName ? { about: { "@type": "Organization", name: data.orgName, ...(data.orgWebsite ? { sameAs: data.orgWebsite } : {}) } } : {}),
      }, organizationLd())}
    />
  );
}

