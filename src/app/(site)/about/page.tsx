import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Nav";
import { JsonLd } from "@/components/JsonLd";
import { freshness } from "@/lib/queries";
import { timeAgo } from "@/lib/status";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "How We Collect and Verify Notices",
  description: `How ${SITE_NAME} finds government job notices on official websites, what "auto-collected" and "reviewed" mean, and how to report an error.`,
  alternates: { canonical: "/about" },
};

const FAQ: [string, string][] = [
  [
    "Is GovJobFinder a government website?",
    "No. We are an independent service. We read official government recruitment websites and link to them; applications are always made on the official portal.",
  ],
  [
    "Where does the information come from?",
    "Only from official websites of commissions, boards, departments, PSUs and recruiting bodies (mostly .gov.in and .nic.in domains). We do not copy other job portals.",
  ],
  [
    "What does “Auto-collected from official source” mean?",
    "The notice was found on an official website and passed automatic checks: the link is on an official domain, the document could be read, the notice type is clear and a future closing date was found. Details are extracted automatically and can contain mistakes — the official notification is always the final word.",
  ],
  [
    "What does “Reviewed by an editor” mean?",
    "A person checked the extracted details against the official notification.",
  ],
  [
    "Why do some details say “Not stated in notice”?",
    "Either the notice doesn't mention it or we could not read it reliably. We never guess dates, vacancy numbers, fees or salaries.",
  ],
  ["Do you charge any fee?", "No. We never ask for money or personal documents. Be careful of anyone who asks for payment to “guarantee” a government job."],
  ["How often is the site updated?", "Important recruitment websites are checked every few hours, others less often. Each notice shows when it was last checked."],
];

export default async function AboutPage() {
  const fresh = await freshness();
  return (
    <div className="container-page max-w-3xl py-6">
      <Breadcrumbs items={[{ label: "About" }]} />
      <h1 className="mb-4 mt-3 text-3xl font-bold">How we collect and verify notices</h1>
      <div className="space-y-4 text-[15px] leading-relaxed">
        <p>
          {SITE_NAME} monitors {fresh.sourcesMonitored} official recruitment websites — public service commissions, staff selection boards, police recruitment boards,
          central recruiters, PSUs and research organisations across all 28 states and 8 Union Territories. The last automatic check finished{" "}
          {fresh.lastRunAt ? timeAgo(fresh.lastRunAt) : "— no check has completed yet"}.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>We read each website&apos;s notice or recruitment page politely (following its robots.txt and spacing out requests).</li>
          <li>New links that look like recruitment notices, admit cards, results or answer keys are opened and the notice text is read.</li>
          <li>Dates, advertisement numbers, vacancies, age limits and fees are extracted only when the notice states them.</li>
          <li>
            A notice is published automatically only when it comes from an official domain, its document could be read and it has a clear future closing date.
            Everything else waits for an editor.
          </li>
          <li>Extended deadlines, corrigenda and cancellations are attached to the original notice with a visible change history.</li>
          <li>Notices close automatically after their last date. We never delete them silently.</li>
        </ol>
        <h2 id="faq" className="pt-4 text-2xl font-bold">
          Frequently asked questions
        </h2>
        <dl className="space-y-4">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold text-ink">{q}</dt>
              <dd className="mt-1 text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
        }}
      />
    </div>
  );
}
