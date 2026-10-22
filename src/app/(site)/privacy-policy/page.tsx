import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, List, Section } from "@/components/InfoPage";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What information ${SITE_NAME} collects, how it is used, and the cookies and browser storage the site uses.`,
  alternates: { canonical: "/privacy-policy" },
};

const link = "text-accent underline";

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy policy" crumb="Privacy Policy" updated="22 October 2026">
      <p>
        This page explains what {SITE_NAME} collects and stores when you use the site. We keep data collection to a minimum: you can browse and search jobs without an account, and an account is needed only to save jobs.
      </p>

      <Section title="Login and your account">
        <p>You can browse and search jobs without logging in. Saving jobs needs an account, and you can log in with Google or with Telegram. Your saved jobs are then available on every device.</p>
        <List>
          <li>
            <strong>Google:</strong> we receive your name, your email address (when Google has verified it) and a Google account identifier. We do not receive your Google password.
          </li>
          <li>
            <strong>Telegram:</strong> you open our Telegram bot and it sends you a one-time code. We receive your Telegram user ID, your name and your Telegram username (if you have one) from Telegram. We do not receive your phone number.
          </li>
          <li>
            <strong>Saved jobs:</strong> the jobs you save are stored in our database against your account.
          </li>
        </List>
        <p>
          We use this information only to log you in and to keep your saved jobs. You can log out, or delete your account on the Account page; deleting it removes these details and your saved jobs from our database. Google and Telegram handle
          your data under their own privacy policies.
        </p>
      </Section>

      <Section title="Information you give us">
        <p>
          Apart from the login above, the site has no forms that ask for your name, email address or other personal details. If you email {SUPPORT_EMAIL}, we receive your email address and whatever you write, and we use it only to
          respond to you.
        </p>
      </Section>

      <Section title="Searches and filters">
        <p>
          When you search or apply a filter, your search terms and choices are sent to our server as part of the page address so that it can return the matching results. The personal RSS feed tool only builds
          a feed link from the filters you pick; no email address or account is involved.
        </p>
      </Section>

      <Section title="Cookies and browser storage">
        <p>The site stores a few items in your browser to remember your preferences:</p>
        <List>
          <li>
            <strong>Language cookie (gjf_lang)</strong> — remembers whether you chose English or Hindi. It lasts up to one year.
          </li>
          <li>
            <strong>Saved jobs (browser local storage)</strong> — while you are logged in, a working copy of your saved jobs is kept in your browser so the pages load quickly. It is removed when you log out.
          </li>
          <li>
            <strong>Text size (browser local storage)</strong> — remembers the text size you chose.
          </li>
        </List>
        <List>
          <li>
            <strong>Login cookie (gjf_user)</strong> — set only if you log in; keeps you logged in for up to 30 days, until you log out.
          </li>
          <li>
            <strong>Short-lived login cookies (gjf_oauth, gjf_tg)</strong> — set while you are in the middle of logging in with Google or Telegram, and they expire within 10 minutes.
          </li>
        </List>
        <p>
          You can remove these at any time by clearing your browser&apos;s cookies and site data. Staff who manage the site use a separate sign-in cookie; it is not set for visitors.
        </p>
      </Section>

      <Section title="Analytics, advertising and third parties">
        <p>
          The site does not use advertising or analytics scripts, and it loads its scripts and fonts from its own domain. If you log in, you are sent to Google, or to Telegram, to confirm who you are. Listings link to external
          government websites, which have their own privacy practices that we do not control.
        </p>
      </Section>

      <Section title="Technical data">
        <p>
          Like most websites, the servers that deliver this site may process standard technical request information, such as your IP address, browser type and the pages requested, in order to serve pages and
          keep the site secure.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update this policy as the site changes; the date above shows the latest update. For questions about privacy, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>{SUPPORT_EMAIL}</a>. See also our <Link href="/terms-of-use" className={link}>Terms of Use</Link>.
        </p>
      </Section>
    </InfoPage>
  );
}
