import Link from "next/link";
import { referenceOptions } from "@/lib/admin-queries";
import { SECTIONS } from "@/lib/content";
import { ContentEditor } from "@/components/admin/ContentEditor";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Add content" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function NewContentPage({ searchParams }: Props) {
  const sp = await searchParams;
  const section = SECTIONS.find((s) => s.key === sp.section);
  if (!section) {
    return (
      <>
        <PageTitle title="Add content" />
        <p className="mb-4 text-sm text-muted">Choose where the new notice should appear on the website.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link key={s.key} href={`/bigboss/content/new?section=${s.key}`} className="card block p-4 hover:bg-navy-50">
              <p className="font-semibold text-navy-700">{s.label}</p>
              <p className="mt-1 text-xs text-muted">Public page: {s.path}</p>
              {"hint" in s && s.hint && <p className="mt-1 text-xs text-muted">{s.hint}</p>}
            </Link>
          ))}
        </div>
      </>
    );
  }
  const opts = await referenceOptions();
  return (
    <>
      <PageTitle title={`Add to ${section.label}`}>
        <Link href="/bigboss/content/new" className="btn-secondary">
          Change section
        </Link>
      </PageTitle>
      <p className="mb-4 text-sm text-muted">Save as a draft to finish later, or publish now. Nothing is published until you choose to.</p>
      <ContentEditor defaultKind={section.kind} sections={SECTIONS.map((s) => ({ kind: s.kind, label: s.label }))} opts={opts} />
    </>
  );
}
