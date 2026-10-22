import Link from "next/link";
import { ChevronRight } from "./icons";
import { siteUrl } from "@/lib/site";
import { JsonLd } from "./JsonLd";
import { getI18n } from "@/lib/i18n-server";
import { LinkPending } from "./Loader";

export async function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  const { t } = await getI18n();
  const all = [{ href: "/", label: t("common.home") }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((c, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {c.href && i < all.length - 1 ? (
                <Link href={c.href} className="hover:text-navy-950 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={i === all.length - 1 ? "page" : undefined} className="text-body">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, ...(c.href ? { item: siteUrl(c.href) } : {}) })),
        }}
      />
    </>
  );
}

export async function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (p: number) => string }) {
  if (pageCount <= 1) return null;
  const { t } = await getI18n();
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount].filter((p) => p >= 1 && p <= pageCount))].sort((a, b) => a - b);
  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-center gap-1 text-sm">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className="btn-secondary" rel="prev">
          {t("common.previous")}
          <LinkPending label={t("loading.page")} />
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-9 rounded-lg px-3 py-2 text-center font-semibold ${p === page ? "bg-navy-950 text-white" : "border border-line bg-white hover:bg-navy-50"}`}
          >
            {p}
            <LinkPending label={t("loading.page")} />
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} className="btn-secondary" rel="next">
          {t("common.next")}
          <LinkPending label={t("loading.page")} />
        </Link>
      )}
    </nav>
  );
}
