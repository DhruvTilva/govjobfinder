import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, List, Section } from "@/components/InfoPage";
import { freshness } from "@/lib/queries";
import { timeAgo } from "@/lib/status";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Us",
  description: `${SITE_NAME} is an independent service that collects government job notifications from official recruitment websites and links every listing to its official source.`,
  alternates: { canonical: "/about" },
};

const link = "text-accent underline";

export default async function AboutPage() {
  const fresh = await freshness();
  return (
    <InfoPage title={`About ${SITE_NAME}`} crumb="About Us">
      <p>
        {SITE_NAME} helps people in India find central and state government job notifications in one place. Recruitment notices are spread across hundreds of separate commission, board and
        department websites; we read those official websites and bring the notices together, with last dates, eligibility details and a direct link to the official notification on every listing.
      </p>
      <p>
        We are an independent service. We are not a government body, we are not affiliated with any recruiting organisation, and applications are always made on the official portal — never on {SITE_NAME}.
      </p>

      <Section title="What you can do here">
        <List>
          <li>
            Browse <Link href="/jobs" className={link}>latest jobs</Link>, <Link href="/admit-cards" className={link}>admit cards</Link>,{" "}
            <Link href="/results" className={link}>results</Link> and <Link href="/answer-keys" className={link}>answer keys</Link>.
          </li>
          <li>Filter by state, sector, qualification, job type and last date.</li>
          <li>Save jobs in your browser and check your age eligibility with the age calculator.</li>
          <li>Follow a personal RSS feed for your state and qualification, with no sign-up.</li>
        </List>
        <p>
          New to the site? Read the <Link href="/user-guide" className={link}>User Guide</Link> or the <Link href="/faq" className={link}>FAQ</Link>.
        </p>
      </Section>

      <Section title="How we collect and verify notices">
        <p>
          {SITE_NAME} is set up to monitor {fresh.sourcesConfigured} official recruitment websites ({fresh.sourcesMonitored} checked successfully in the last 3 days) — public service commissions, staff selection
          boards, police recruitment boards, central recruiters, PSUs and research organisations across all 28 states and 8 Union Territories. The most recent successful check of a website was{" "}
          {fresh.lastRunAt ? timeAgo(fresh.lastRunAt) : "— no check has completed yet"}.
        </p>
        <List ordered>
          <li>We read each website&apos;s notice or recruitment page politely (following its robots.txt and spacing out requests).</li>
          <li>New links that look like recruitment notices, admit cards, results or answer keys are opened and the notice text is read.</li>
          <li>Dates, advertisement numbers, vacancies, age limits and fees are extracted only when the notice states them.</li>
          <li>
            A notice is published automatically only when it comes from an official domain, its document could be read and it has a clear future closing date. Everything else waits for an editor.
          </li>
          <li>Extended deadlines, corrigenda and cancellations are attached to the original notice with a visible change history.</li>
          <li>Notices close automatically after their last date. We never delete them silently.</li>
        </List>
        <p>
          Details are extracted automatically and can contain mistakes. The official notification is always the final word — see our <Link href="/disclaimer" className={link}>Disclaimer</Link>.
        </p>
      </Section>
    </InfoPage>
  );
}
