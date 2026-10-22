import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, List, Section } from "@/components/InfoPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "User Guide",
  description: `How to search, filter, save and verify government job listings on ${SITE_NAME}.`,
  alternates: { canonical: "/user-guide" },
};

const link = "text-accent underline";

export default function UserGuidePage() {
  return (
    <InfoPage title="User guide" crumb="User Guide">
      <p>A short guide to finding a job notification and checking it before you apply.</p>

      <Section title="1. Search">
        <List>
          <li>Type a post, exam or organisation name in the search box at the top of the page.</li>
          <li>
            Or open a list: <Link href="/jobs" className={link}>Latest Jobs</Link>, <Link href="/jobs?status=closing&sort=closing" className={link}>Closing Soon</Link>,{" "}
            <Link href="/admit-cards" className={link}>Admit Cards</Link>, <Link href="/results" className={link}>Results</Link> or <Link href="/answer-keys" className={link}>Answer Keys</Link>.
          </li>
          <li>
            Browse by <Link href="/states" className={link}>state</Link>, <Link href="/sectors" className={link}>sector</Link> or <Link href="/qualifications" className={link}>qualification</Link>, or look
            up an exam in the <Link href="/exams" className={link}>Exam Directory</Link>.
          </li>
        </List>
      </Section>

      <Section title="2. Filter">
        <p>On the job lists you can narrow the results by:</p>
        <List>
          <li>Status — for example open, closing soon, upcoming or closed.</li>
          <li>State, sector and qualification.</li>
          <li>Job type — permanent, contract, apprentice or deputation.</li>
          <li>When it was posted, and the sort order (latest, closing soonest, or most posts).</li>
        </List>
      </Section>

      <Section title="3. Save jobs">
        <List>
          <li>Use the bookmark button on a listing to save it. Saved jobs are collected under <Link href="/saved" className={link}>Saved</Link> in the header.</li>
          <li>Saving a job needs an account. If you are not logged in, the bookmark button takes you to the login page (Google or Telegram), and you can save the job after logging in.</li>
          <li>Your saved jobs are kept in your account and are available on every device where you log in. Browsing and searching never need an account.</li>
        </List>
      </Section>

      <Section title="4. Check your eligibility">
        <p>
          The <Link href="/tools/eligibility" className={link}>age calculator</Link> shows age limits with common central government relaxations. Each notice can set different limits, cut-off dates and
          relaxations, so always follow the notification.
        </p>
      </Section>

      <Section title="5. Verify a listing before you apply">
        <List ordered>
          <li>Open the Official notification link and read the notice from the recruiting body.</li>
          <li>Check the posts, eligibility, age limit and its “as on” date, fee and last date in that notice.</li>
          <li>Look at the label on the listing: “Auto-collected from official source” means details were read automatically and may contain errors; “Reviewed by an editor” means a person compared them with the notice.</li>
          <li>Check that the link is on an official domain. If a listing warns that a link is not a .gov.in domain, verify it carefully.</li>
          <li>Apply only on the official portal. Nobody can sell you a government job, and we never ask for payment.</li>
        </List>
      </Section>

      <Section title="Other features">
        <List>
          <li>Follow a personal RSS feed for your state and qualification using the alerts tool on the home page.</li>
          <li>Switch between English and Hindi, and change the text size, from the header.</li>
        </List>
        <p>
          More answers are in the <Link href="/faq" className={link}>FAQ</Link>.
        </p>
      </Section>
    </InfoPage>
  );
}
