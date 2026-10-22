import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: `Answers to common questions about searching for government jobs on ${SITE_NAME}, eligibility, last dates, official links and how notifications are collected.`,
  alternates: { canonical: "/faq" },
};

const FAQ: [string, string][] = [
  [
    "Is GovJobFinder a government website?",
    "No. We are an independent service. We read official government recruitment websites and link to them; applications are always made on the official portal.",
  ],
  [
    "How do I search for a job?",
    "Use the search box at the top of the site, or open Latest Jobs and narrow the list by state, sector, qualification, job type, status and how recently it was posted. The User Guide explains each filter.",
  ],
  [
    "How do I know if I am eligible?",
    "Each listing shows the qualification and age limit read from the official notice, where the notice states them. The age calculator shows common central government relaxations, but every notice can set its own limits, cut-off date and relaxations. Check the official notification before applying.",
  ],
  [
    "How do I find the last date to apply?",
    "The last date is shown on each listing and in the Closing Soon list. Deadlines are sometimes extended or changed — the change history on a notice shows this — but the official website is the authority, so confirm the date there.",
  ],
  [
    "How do I reach the official notification or application page?",
    "Every listing has an Official notification link, and an apply link where the notice provides one. We mark whether a link is on an official (.gov.in-type) domain; if it is not, verify it carefully.",
  ],
  [
    "Where does the information come from?",
    "Only from official websites of commissions, boards, departments, PSUs and recruiting bodies (mostly .gov.in and .nic.in domains). We do not copy other job portals.",
  ],
  [
    "What does “Auto-collected from official source” mean?",
    "The notice was found on an official website and passed automatic checks: the link is on an official domain, the document could be read, the notice type is clear and a future closing date was found. Details are extracted automatically and can contain mistakes — the official notification is always the final word.",
  ],
  ["What does “Reviewed by an editor” mean?", "A person checked the extracted details against the official notification."],
  [
    "Why do some details say “Not stated in notice”?",
    "Either the notice doesn't mention it or we could not read it reliably. We never guess dates, vacancy numbers, fees or salaries.",
  ],
  ["How often is the site updated?", "Important recruitment websites are checked every few hours, others less often. Each notice shows when it was last checked."],
  [
    "Can I get job alerts?",
    "Yes. The home page has a tool that builds a personal RSS feed for the state, sector and qualification you choose. Follow it in any RSS reader. No sign-up is needed and we do not collect an email address for it.",
  ],
  [
    "Where are my saved jobs stored?",
    "Saved jobs are stored in your account, so you need to log in (with Google or Telegram) to save a job. They follow you to any device where you log in, and you can delete your account, and with it your saved jobs, at any time.",
  ],
  [
    "Do I need to log in?",
    "Only to save jobs. You can browse and search jobs, read notices and use every tool without an account. Logging in with Google or Telegram lets you save jobs and keeps them on all your devices. You can delete your account at any time from the Account page.",
  ],
  ["Do you charge any fee?", "No. We never ask for money or personal documents. Be careful of anyone who asks for payment to “guarantee” a government job."],
  [
    "I found a wrong detail or a broken link. What should I do?",
    `Email us at ${SUPPORT_EMAIL} with the link to the page and what looks wrong, and compare it with the official notification in the meantime.`,
  ],
];

export default function FaqPage() {
  return (
    <InfoPage title="Frequently asked questions" crumb="FAQ">
      <dl className="space-y-4">
        {FAQ.map(([q, a]) => (
          <div key={q}>
            <dt className="font-semibold text-ink">{q}</dt>
            <dd className="mt-1 text-muted">{a}</dd>
          </div>
        ))}
      </dl>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
        }}
      />
    </InfoPage>
  );
}
