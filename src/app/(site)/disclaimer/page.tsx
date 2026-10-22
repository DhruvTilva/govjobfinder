import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, List, Section } from "@/components/InfoPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: `${SITE_NAME} is an independent information service, not affiliated with any government organisation. Official notifications remain the authoritative source.`,
  alternates: { canonical: "/disclaimer" },
};

const link = "text-accent underline";

export default function DisclaimerPage() {
  return (
    <InfoPage title="Disclaimer" crumb="Disclaimer" updated="22 October 2026">
      <Section title="Independent service">
        <p>
          {SITE_NAME} is an independent information service. We are not a government website and are not affiliated with, endorsed by or connected to any government department, commission, board, public
          sector organisation or other recruiting body. Names of recruiting bodies belong to their respective authorities.
        </p>
      </Section>
      <Section title="Official notifications are authoritative">
        <p>
          Information on {SITE_NAME} is collected from official recruitment websites for public use. Many details are extracted automatically and may be incomplete, out of date or wrong. Dates, vacancies,
          eligibility, fees and links can change after we publish them.
        </p>
        <p>
          The official notification published by the recruiting body is the only authoritative source. Always read it, and confirm the details on the official website, before you apply or pay any fee. If
          this site and an official notification differ, the official notification applies.
        </p>
      </Section>
      <Section title="No guarantees">
        <List>
          <li>We do not guarantee that any listing is complete, accurate or current, or that a vacancy still exists.</li>
          <li>Listing a notice is not a recommendation or an offer of employment, and we do not take part in any selection process.</li>
          <li>We are not responsible for loss or missed opportunities that result from relying on information on this site.</li>
        </List>
      </Section>
      <Section title="No fees, no agents">
        <p>
          We never charge a fee, never accept money for listings or selection, and never ask for personal documents or payment. Be wary of anyone who claims to guarantee a government job.
        </p>
      </Section>
      <Section title="External links">
        <p>Our listings link to websites run by other organisations. We do not control those websites and are not responsible for their content, availability or privacy practices.</p>
      </Section>
      <p>
        See also our <Link href="/terms-of-use" className={link}>Terms of Use</Link> and <Link href="/privacy-policy" className={link}>Privacy Policy</Link>.
      </p>
    </InfoPage>
  );
}
