/**
 * Listing pages to scan instead of an organisation's home page. Home pages rarely link
 * notices directly; each URL here was checked on 2026-10-19 to load and to yield notice
 * links with the default harvester (count in the comment).
 *
 * Keyed by the configured home-page URL. Existing sources still pointing at the key are
 * moved to the listing URL on the next seed; sources an admin has already changed are left alone.
 */
export const LISTING_PAGES: Record<string, { url: string; domains?: string[] }> = {
  "https://psc.cg.gov.in": { url: "https://psc.cg.gov.in/Advertisement.php" }, // 40
  "https://www.tnpsc.gov.in": { url: "https://www.tnpsc.gov.in/English/Notification.aspx" }, // 40
  "https://sbi.bank.in/web/careers": { url: "https://sbi.bank.in/web/careers/current-openings" }, // 40
  "https://www.sebi.gov.in": { url: "https://www.sebi.gov.in/sebiweb/about/AboutAction.do?doVacancies=yes" }, // 40
  "https://www.cdac.in": { url: "https://www.cdac.in/index.aspx?id=current_jobs", domains: ["careers.cdac.in"] }, // 26
  "https://www.bharatpetroleum.in": { url: "https://www.bharatpetroleum.in/careers/job-openings" }, // 23
  // ICAR's scientific recruitment is run by its Agricultural Scientists Recruitment Board.
  "https://icar.org.in": { url: "https://asrb.gov.in/", domains: ["asrb.gov.in"] }, // 10
  "https://bel-india.in": { url: "https://bel-india.in/job-notifications/" }, // 8
  "https://licindia.in": { url: "https://licindia.in/web/guest/careers" }, // 2
  "https://cbi.gov.in": { url: "https://cbi.gov.in/vacancies" }, // 1
};
