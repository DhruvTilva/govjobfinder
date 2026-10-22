import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, List, Section } from "@/components/InfoPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: `The terms for using ${SITE_NAME}, including acceptable use and your responsibility to verify application requirements with the official notification.`,
  alternates: { canonical: "/terms-of-use" },
};

const link = "text-accent underline";

export default function TermsPage() {
  return (
    <InfoPage title="Terms of use" crumb="Terms of Use" updated="22 October 2026">
      <p>By using {SITE_NAME} you agree to these terms. If you do not agree, please do not use the site.</p>

      <Section title="What the site is">
        <p>
          {SITE_NAME} is an independent information service that collects government recruitment notices from official websites. It is not a government website, and you cannot apply for a job through it. Please
          read the <Link href="/disclaimer" className={link}>Disclaimer</Link>.
        </p>
      </Section>

      <Section title="Your responsibility">
        <List>
          <li>Information here may contain errors or be out of date. You are responsible for reading the official notification and confirming eligibility, dates, fees, documents and the application procedure.</li>
          <li>Apply only through the official portal named in the official notification.</li>
          <li>Decisions you make on the basis of information on this site are your own responsibility.</li>
        </List>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <List>
          <li>use the site for anything unlawful, or to mislead others, including presenting yourself as a government body or as {SITE_NAME};</li>
          <li>interfere with or overload the site or its servers, or try to gain unauthorised access to any part of it;</li>
          <li>misuse listings to commit or promote fraud, for example by collecting money from candidates in return for jobs or selection.</li>
        </List>
        <p>The RSS feed may be used in feed readers and news apps for personal use.</p>
      </Section>

      <Section title="Your account">
        <p>
          An account is needed only to save jobs. If you log in, you are responsible for activity under your account, and you should keep your Google or Telegram account secure. You can delete your account at any time from the Account page. We may suspend
          accounts that are used to break these terms.
        </p>
      </Section>

      <Section title="Links to other websites">
        <p>Listings link to websites we do not control. We are not responsible for their content or practices, and your use of them is subject to their own terms.</p>
      </Section>

      <Section title="Availability and liability">
        <p>
          The site is provided “as is” and “as available”, without any warranty that it will be accurate, complete or uninterrupted. To the extent permitted by law, {SITE_NAME} is not liable for any loss
          arising from use of, or reliance on, the site.
        </p>
      </Section>

      <Section title="Changes">
        <p>We may change the site or these terms from time to time. The date at the top shows when they were last updated; continuing to use the site means you accept the current terms.</p>
      </Section>

      <p>
        See also the <Link href="/privacy-policy" className={link}>Privacy Policy</Link>.
      </p>
    </InfoPage>
  );
}
