import { hostnameOf, safeHref } from "@/lib/url";
import { getI18n } from "@/lib/i18n-server";
import { ExternalIcon } from "./icons";

type Org = {
  org: { id: number; name: string; shortName: string | null; slug: string; notes: string | null };
  sources: { id: number; url: string; name: string; urlStatus: string; enabled: boolean; method: string }[];
};

/** Official recruitment websites for an organisation list, with link health. */
export async function SourceList({ orgs }: { orgs: Org[] }) {
  const { t } = await getI18n();
  return (
    <ul className="divide-y divide-line">
      {orgs.map(({ org, sources }) => (
        <li key={org.id} className="py-3">
          <a href={`/organizations/${org.slug}`} className="font-semibold text-ink hover:underline">
            {org.name}
            {org.shortName && <span className="font-normal text-muted"> ({org.shortName})</span>}
          </a>
          <ul className="mt-1 space-y-0.5">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <a href={safeHref(s.url) ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-navy-700 hover:underline">
                  {hostnameOf(s.url)} <ExternalIcon className="h-3 w-3" />
                </a>
                {s.urlStatus === "ok" && <span className="text-xs text-ok">{t("src.reachable")}</span>}
                {["broken", "timeout", "blocked"].includes(s.urlStatus) && <span className="text-xs text-urgent">{t("src.problem")}</span>}
                {!s.enabled && <span className="text-xs text-muted">{t("src.reference")}</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
