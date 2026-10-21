import type { Metadata } from "next";
import Link from "next/link";
import { listExams } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Nav";
import { ExamFilter } from "@/components/ExamFilter";
import { ExternalIcon } from "@/components/icons";
import { NATIONAL_GROUP_ORDER } from "@/db/seed/exams-national";
import { hostnameOf, safeHref } from "@/lib/url";
import { slugify } from "@/lib/text";

export const metadata: Metadata = {
  title: "Government Exam Directory",
  description:
    "Directory of central and state government recruitment exams in India — UPSC, SSC, railways, banking, defence, police, teaching, state PSCs and selection boards — with the recruiting body and official website.",
  alternates: { canonical: "/exams" },
};

export default async function ExamsPage() {
  const rows = await listExams();
  const present = new Set(rows.map((r) => r.exam.group));
  // National groups in their curated order, then any other groups (the technical "Top 50" list) in rank order.
  const national = NATIONAL_GROUP_ORDER.filter((g) => present.has(g));
  const technical = [...new Set(rows.map((r) => r.exam.group))].filter((g) => !NATIONAL_GROUP_ORDER.includes(g));
  const count = (g: string) => rows.filter((r) => r.exam.group === g).length;

  const groupSection = (g: string) => (
    <section key={g} id={slugify(g)} data-exam-group className="mt-8 scroll-mt-24">
      <h2 className="mb-3 text-xl font-bold">{g}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Exam / post</th>
              <th scope="col" className="px-3 py-2">Recruited by</th>
              <th scope="col" className="px-3 py-2">Usually notified</th>
              <th scope="col" className="px-3 py-2">Posts / work areas</th>
              <th scope="col" className="px-3 py-2">Official link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows
              .filter((r) => r.exam.group === g)
              .map(({ exam, orgSlug, orgName }) => (
                <tr key={exam.id} className="align-top" data-exam={`${exam.name} ${orgName ?? ""} ${exam.recruitingBody ?? ""} ${exam.focusAreas ?? ""}`.toLowerCase()}>
                  <td className="px-3 py-2.5 font-semibold text-ink">
                    {exam.name}
                    {exam.notes && <span className="mt-0.5 block text-xs font-normal text-muted">{exam.notes}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {orgSlug ? (
                      <Link href={`/organizations/${orgSlug}`} className="text-navy-700 hover:underline">
                        {orgName}
                      </Link>
                    ) : (
                      exam.recruitingBody
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{exam.typicalWindow}</td>
                  <td className="px-3 py-2.5 text-muted">{exam.focusAreas}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {safeHref(exam.officialUrl) ? (
                      <a
                        href={safeHref(exam.officialUrl)!}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        title={hostnameOf(exam.officialUrl!) ?? undefined}
                        className="inline-flex items-center gap-1 rounded-md border border-navy-700 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-700 hover:text-white"
                      >
                        Visit site <ExternalIcon className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: "Exam directory" }]} />
      <h1 className="mb-2 mt-3 text-3xl font-bold">Government exam directory</h1>
      <ExamFilter total={rows.length} />
      <nav aria-label="Exam groups" className="mt-4 flex flex-wrap gap-1.5 text-sm">
        {[...national, ...technical].map((g) => (
          <a key={g} href={`#${slugify(g)}`} className="chip border border-line bg-white text-ink hover:bg-navy-50">
            {g} <span className="text-muted">({count(g)})</span>
          </a>
        ))}
      </nav>
      {national.map(groupSection)}
      {technical.length > 0 && (
        <>
          <h2 className="mt-12 border-t border-line pt-6 text-2xl font-bold">Technical, IT &amp; scientific roles</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">Engineering, IT, research and regulatory posts, including PSU recruitment through GATE.</p>
          {technical.map(groupSection)}
        </>
      )}
      <p className="mt-6 text-xs text-muted">
        Sources: the recruiting bodies’ official websites, our list of monitored recruitment sources, and the “Top 50 Exams – Technical Sector” reference list
        (corrected where services were merged or renamed). Salary and difficulty figures are not shown because they are not officially published.
      </p>
    </div>
  );
}
