import type { Metadata } from "next";
import Link from "next/link";
import { listExams } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Nav";
import { hostnameOf, safeHref } from "@/lib/url";

export const metadata: Metadata = {
  title: "Technical & IT Government Exam Directory",
  description:
    "Directory of 50 technical, IT, scientific, PSU and regulatory government recruitments in India — recruiting body, official website and typical notification window.",
  alternates: { canonical: "/exams" },
};

export default async function ExamsPage() {
  const rows = await listExams();
  const groups = [...new Set(rows.map((r) => r.exam.group))];
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: "Exam directory" }]} />
      <h1 className="mb-2 mt-3 text-3xl font-bold">Technical &amp; IT government exam directory</h1>
      <p className="max-w-3xl text-sm text-muted">
        Recruitments for engineering, IT, science and regulatory roles, with the recruiting body and its official website. The “usually notified” column is a
        historical pattern, not a schedule — recruiting bodies change dates every year. Open an organisation to see its current notices.
      </p>
      {groups.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="mb-3 text-xl font-bold">{g}</h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Post / service</th>
                  <th scope="col" className="px-3 py-2">Recruited by</th>
                  <th scope="col" className="px-3 py-2">Usually notified</th>
                  <th scope="col" className="px-3 py-2">Work areas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows
                  .filter((r) => r.exam.group === g)
                  .map(({ exam, orgSlug, orgName }) => (
                    <tr key={exam.id} className="align-top">
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
                        {safeHref(exam.officialUrl) && (
                          <a href={safeHref(exam.officialUrl)!} target="_blank" rel="noopener noreferrer nofollow" className="block text-xs text-muted hover:underline">
                            {hostnameOf(exam.officialUrl!)}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted">{exam.typicalWindow}</td>
                      <td className="px-3 py-2.5 text-muted">{exam.focusAreas}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="mt-6 text-xs text-muted">
        Source: compiled from the “Top 50 Exams – Technical Sector” reference list and corrected where services were merged or renamed. Salary and difficulty figures
        in that list were unsourced and are not shown.
      </p>
    </div>
  );
}
