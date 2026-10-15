/**
 * Central government, PSU and autonomous recruiting bodies.
 * ref: "sector" = Sector-wise-job.docx, "top50" = Top 50 Exams Technical Sector.xlsx,
 *      "research" = added to close coverage gaps (see docs/DATA_SOURCES.md).
 */

export type CentralOrg = {
  slug: string;
  name: string;
  short?: string;
  level: "central" | "psu" | "autonomous";
  sector: string;
  url: string;
  ref: string;
  /** Extra domains to treat as official for this organisation. */
  domains?: string[];
  /** Additional pages to monitor besides `url`. */
  extraSources?: { name: string; url: string; scan?: boolean }[];
  scan?: boolean;
  priority?: 1 | 2 | 3;
  note?: string;
};

export const CENTRAL_ORGS: CentralOrg[] = [
  // 1. UPSC & civil services
  { slug: "upsc", name: "Union Public Service Commission", short: "UPSC", level: "central", sector: "upsc-civil-services", url: "https://upsc.gov.in", ref: "sector,top50", priority: 1, domains: ["upsconline.nic.in", "upsconline.gov.in"], extraSources: [{ name: "UPSC Online Application (OTR)", url: "https://upsconline.nic.in", scan: false }] },
  // 2. Railways
  { slug: "indian-railways", name: "Indian Railways", level: "central", sector: "railways", url: "https://indianrailways.gov.in", ref: "sector", priority: 2 },
  { slug: "rrb", name: "Railway Recruitment Boards", short: "RRB", level: "central", sector: "railways", url: "https://www.rrbapply.gov.in", ref: "sector,top50", priority: 1, scan: false, note: "Application portal; notices are published on regional RRB sites.", extraSources: [{ name: "RRB Ahmedabad", url: "https://www.rrbahmedabad.gov.in" }] },
  { slug: "rpf", name: "Railway Protection Force", short: "RPF", level: "central", sector: "railways", url: "https://rpf.indianrailways.gov.in", ref: "sector" },
  // 3. Defence
  { slug: "indian-army", name: "Indian Army", level: "central", sector: "defence", url: "https://joinindianarmy.nic.in", ref: "sector,top50", priority: 1 },
  { slug: "indian-navy", name: "Indian Navy", level: "central", sector: "defence", url: "https://www.joinindiannavy.gov.in", ref: "sector", priority: 1 },
  { slug: "indian-air-force", name: "Indian Air Force", short: "IAF", level: "central", sector: "defence", url: "https://careerindianairforce.cdac.in", ref: "sector", priority: 1, domains: ["agnipathvayu.cdac.in"] },
  { slug: "indian-coast-guard", name: "Indian Coast Guard", level: "central", sector: "defence", url: "https://joinindiancoastguard.cdac.in", ref: "sector" },
  // 4. Police & paramilitary
  { slug: "bsf", name: "Border Security Force", short: "BSF", level: "central", sector: "police-paramilitary", url: "https://rectt.bsf.gov.in", ref: "sector" },
  { slug: "crpf", name: "Central Reserve Police Force", short: "CRPF", level: "central", sector: "police-paramilitary", url: "https://rect.crpf.gov.in", ref: "sector" },
  { slug: "cisf", name: "Central Industrial Security Force", short: "CISF", level: "central", sector: "police-paramilitary", url: "https://www.cisfrectt.cisf.gov.in", ref: "sector" },
  { slug: "itbp", name: "Indo-Tibetan Border Police", short: "ITBP", level: "central", sector: "police-paramilitary", url: "https://recruitment.itbpolice.nic.in", ref: "sector" },
  { slug: "ssb", name: "Sashastra Seema Bal", short: "SSB", level: "central", sector: "police-paramilitary", url: "https://ssb.gov.in", ref: "sector", domains: ["ssbrectt.gov.in"], note: "Document listed ssbrectt.gov.in, which did not resolve on 2026-10-15; using ssb.gov.in." },
  { slug: "assam-rifles", name: "Assam Rifles", level: "central", sector: "police-paramilitary", url: "https://assamrifles.gov.in", ref: "research" },
  // 5. Banking & insurance
  { slug: "sbi", name: "State Bank of India", short: "SBI", level: "psu", sector: "banking-insurance", url: "https://sbi.bank.in/web/careers", ref: "sector,top50", priority: 1, domains: ["sbi.co.in", "bank.sbi"], note: "sbi.co.in now redirects to sbi.bank.in." },
  { slug: "ibps", name: "Institute of Banking Personnel Selection", short: "IBPS", level: "autonomous", sector: "banking-insurance", url: "https://www.ibps.in", ref: "sector,top50", priority: 1 },
  { slug: "rbi", name: "Reserve Bank of India", short: "RBI", level: "central", sector: "banking-insurance", url: "https://opportunities.rbi.org.in", ref: "sector,top50", priority: 1, domains: ["rbi.org.in"] },
  { slug: "lic", name: "Life Insurance Corporation of India", short: "LIC", level: "psu", sector: "banking-insurance", url: "https://licindia.in", ref: "sector" },
  { slug: "nabard", name: "National Bank for Agriculture and Rural Development", short: "NABARD", level: "central", sector: "banking-insurance", url: "https://www.nabard.org", ref: "sector,top50" },
  { slug: "sebi", name: "Securities and Exchange Board of India", short: "SEBI", level: "central", sector: "banking-insurance", url: "https://www.sebi.gov.in", ref: "top50" },
  // 6. SSC & central government
  { slug: "ssc", name: "Staff Selection Commission", short: "SSC", level: "central", sector: "ssc", url: "https://ssc.gov.in", ref: "sector,top50", priority: 1, domains: ["ssc.nic.in"], note: "Top-50 file used the old ssc.nic.in domain; normalised to ssc.gov.in." },
  { slug: "ncs", name: "National Career Service", short: "NCS", level: "central", sector: "other", url: "https://www.ncs.gov.in", ref: "sector", scan: false, note: "Job portal with login-driven search; used as a fallback link, not scanned." },
  { slug: "employment-news", name: "Employment News (Rozgar Samachar)", level: "central", sector: "other", url: "https://www.employmentnews.gov.in", ref: "research", priority: 1, note: "Official weekly publication of central government vacancies." },
  { slug: "mha", name: "Ministry of Home Affairs (incl. Intelligence Bureau)", short: "MHA", level: "central", sector: "police-paramilitary", url: "https://www.mha.gov.in", ref: "top50" },
  { slug: "cbi", name: "Central Bureau of Investigation", short: "CBI", level: "central", sector: "police-paramilitary", url: "https://cbi.gov.in", ref: "top50" },
  { slug: "enforcement-directorate", name: "Directorate of Enforcement", short: "ED", level: "central", sector: "ssc", url: "https://enforcementdirectorate.gov.in", ref: "top50", note: "Top-50 row had link and notification-month columns swapped; corrected." },
  { slug: "cvc", name: "Central Vigilance Commission", short: "CVC", level: "central", sector: "other", url: "https://cvc.gov.in", ref: "top50", priority: 3 },
  { slug: "epfo", name: "Employees' Provident Fund Organisation", short: "EPFO", level: "central", sector: "other", url: "https://www.epfo.gov.in", ref: "research", domains: ["epfindia.gov.in"] },
  { slug: "fci", name: "Food Corporation of India", short: "FCI", level: "psu", sector: "psu", url: "https://fci.gov.in", ref: "research" },
  // 7. Teaching & education
  { slug: "ctet", name: "Central Teacher Eligibility Test (CBSE)", short: "CTET", level: "central", sector: "teaching", url: "https://ctet.nic.in", ref: "sector" },
  { slug: "kvs", name: "Kendriya Vidyalaya Sangathan", short: "KVS", level: "central", sector: "teaching", url: "https://kvs.gov.in", ref: "sector", domains: ["kvsangathan.nic.in"], note: "kvsangathan.nic.in redirects to kvs.gov.in." },
  { slug: "nvs", name: "Navodaya Vidyalaya Samiti", short: "NVS", level: "central", sector: "teaching", url: "https://navodaya.gov.in", ref: "sector" },
  { slug: "nta", name: "National Testing Agency", short: "NTA", level: "autonomous", sector: "teaching", url: "https://nta.ac.in", ref: "research", domains: ["ugcnet.nta.ac.in", "csirnet.nta.ac.in"], extraSources: [{ name: "UGC NET (NTA)", url: "https://ugcnet.nta.ac.in" }] },
  { slug: "gujarat-seb", name: "State Examination Board, Gujarat (TET/TAT)", level: "autonomous", sector: "teaching", url: "https://sebexam.org", ref: "sector", note: "State body listed in the sector document." },
  // 8. Medical
  { slug: "aiims", name: "All India Institute of Medical Sciences (exams)", short: "AIIMS", level: "autonomous", sector: "medical", url: "https://www.aiimsexams.ac.in", ref: "sector", priority: 1 },
  { slug: "esic", name: "Employees' State Insurance Corporation", short: "ESIC", level: "central", sector: "medical", url: "https://www.esic.gov.in", ref: "sector" },
  { slug: "nhm", name: "National Health Mission", short: "NHM", level: "central", sector: "medical", url: "https://nhm.gov.in", ref: "sector" },
  { slug: "pgimer", name: "PGIMER Chandigarh", short: "PGIMER", level: "autonomous", sector: "medical", url: "https://pgimer.edu.in", ref: "sector" },
  { slug: "gujarat-health", name: "Gujarat Health Recruitment (Arogya Sathi)", level: "autonomous", sector: "medical", url: "https://arogyasathi.gujarat.gov.in", ref: "sector" },
  // 10. Engineering, technical & scientific
  { slug: "drdo", name: "Defence Research & Development Organisation", short: "DRDO", level: "central", sector: "scientific-research", url: "https://www.drdo.gov.in/drdo/en", ref: "sector,top50", priority: 1, extraSources: [{ name: "DRDO Recruitment & Assessment Centre (RAC)", url: "https://rac.gov.in" }] },
  { slug: "isro", name: "Indian Space Research Organisation", short: "ISRO", level: "central", sector: "scientific-research", url: "https://www.isro.gov.in/Careers.html", ref: "sector,top50", priority: 1, domains: ["isro.gov.in"] },
  { slug: "barc", name: "Bhabha Atomic Research Centre", short: "BARC", level: "central", sector: "scientific-research", url: "https://www.barc.gov.in", ref: "sector,top50" },
  { slug: "cdac", name: "Centre for Development of Advanced Computing", short: "C-DAC", level: "autonomous", sector: "it-computer", url: "https://www.cdac.in", ref: "sector,top50" },
  { slug: "nielit", name: "NIELIT (recruitment for NIC & MeitY)", short: "NIELIT", level: "autonomous", sector: "it-computer", url: "https://www.nielit.gov.in", ref: "top50,research", note: "Top-50 listed recruitment.nic.in; NIC Scientist-B drives are run through NIELIT." },
  { slug: "ntro", name: "National Technical Research Organisation", short: "NTRO", level: "central", sector: "it-computer", url: "https://ntro.gov.in", ref: "top50", priority: 3 },
  { slug: "meity", name: "Ministry of Electronics & IT", short: "MeitY", level: "central", sector: "it-computer", url: "https://www.meity.gov.in", ref: "top50", priority: 3 },
  { slug: "csir", name: "Council of Scientific & Industrial Research", short: "CSIR", level: "autonomous", sector: "scientific-research", url: "https://www.csir.res.in", ref: "top50" },
  { slug: "icar", name: "Indian Council of Agricultural Research", short: "ICAR", level: "autonomous", sector: "agriculture-forest", url: "https://icar.org.in", ref: "research" },
  { slug: "apprenticeship-india", name: "Apprenticeship India", level: "central", sector: "apprenticeship", url: "https://www.apprenticeshipindia.gov.in", ref: "sector", scan: false, note: "Application portal." },
  { slug: "nats", name: "National Apprenticeship Training Scheme", short: "NATS", level: "central", sector: "apprenticeship", url: "https://nats.education.gov.in", ref: "research", scan: false, note: "Application portal." },
  // 11. PSUs
  { slug: "ntpc", name: "NTPC Limited", short: "NTPC", level: "psu", sector: "psu", url: "https://careers.ntpc.co.in", ref: "sector,top50", domains: ["ntpc.co.in"] },
  { slug: "bhel", name: "Bharat Heavy Electricals Limited", short: "BHEL", level: "psu", sector: "psu", url: "https://careers.bhel.in", ref: "sector,top50", domains: ["bhel.com", "bhel.in"] },
  { slug: "ongc", name: "Oil and Natural Gas Corporation", short: "ONGC", level: "psu", sector: "psu", url: "https://www.ongcindia.com", ref: "sector,top50" },
  { slug: "iocl", name: "Indian Oil Corporation Limited", short: "IOCL", level: "psu", sector: "psu", url: "https://iocl.com", ref: "sector,top50" },
  { slug: "sail", name: "Steel Authority of India Limited", short: "SAIL", level: "psu", sector: "psu", url: "https://sailcareers.com", ref: "sector", domains: ["sail.co.in"] },
  { slug: "coal-india", name: "Coal India Limited", short: "CIL", level: "psu", sector: "psu", url: "https://www.coalindia.in", ref: "sector,top50" },
  { slug: "gail", name: "GAIL (India) Limited", short: "GAIL", level: "psu", sector: "psu", url: "https://gailonline.com", ref: "sector,top50" },
  { slug: "powergrid", name: "Power Grid Corporation of India", short: "POWERGRID", level: "psu", sector: "psu", url: "https://www.powergrid.in", ref: "sector,top50" },
  { slug: "hal", name: "Hindustan Aeronautics Limited", short: "HAL", level: "psu", sector: "psu", url: "https://hal-india.co.in", ref: "sector,top50" },
  { slug: "bel", name: "Bharat Electronics Limited", short: "BEL", level: "psu", sector: "psu", url: "https://bel-india.in", ref: "sector,top50" },
  { slug: "aai", name: "Airports Authority of India", short: "AAI", level: "psu", sector: "psu", url: "https://www.aai.aero", ref: "top50" },
  { slug: "nmdc", name: "NMDC Limited", short: "NMDC", level: "psu", sector: "psu", url: "https://www.nmdc.co.in", ref: "top50" },
  { slug: "bpcl", name: "Bharat Petroleum Corporation Limited", short: "BPCL", level: "psu", sector: "psu", url: "https://www.bharatpetroleum.in", ref: "top50", domains: ["bharatpetroleum.com"] },
  { slug: "npcil", name: "Nuclear Power Corporation of India", short: "NPCIL", level: "psu", sector: "psu", url: "https://www.npcil.nic.in", ref: "top50" },
  { slug: "bsnl", name: "Bharat Sanchar Nigam Limited (incl. former BBNL)", short: "BSNL", level: "psu", sector: "psu", url: "https://www.bsnl.co.in", ref: "top50,research", priority: 3, note: "BBNL (Top-50 #34) has been merged into BSNL." },
  // 12. Other
  { slug: "india-post", name: "India Post", level: "central", sector: "postal", url: "https://www.indiapost.gov.in", ref: "sector", priority: 1, domains: ["indiapostgdsonline.gov.in"], extraSources: [{ name: "India Post GDS Online", url: "https://indiapostgdsonline.gov.in" }] },
  { slug: "supreme-court", name: "Supreme Court of India", level: "central", sector: "judiciary", url: "https://www.sci.gov.in", ref: "sector" },
  { slug: "ecourts", name: "District Courts (eCourts)", level: "central", sector: "judiciary", url: "https://districts.ecourts.gov.in", ref: "sector", scan: false, note: "Index of district court websites; each district publishes its own recruitment." },
  { slug: "gujarat-high-court", name: "High Court of Gujarat", level: "autonomous", sector: "judiciary", url: "https://gujarathighcourt.nic.in", ref: "sector" },
];

/** Organisations that are state-level but were listed in the central-oriented sector document. */
export const STATE_SCOPED_CENTRAL_SLUGS: Record<string, string> = {
  "gujarat-seb": "GJ",
  "gujarat-health": "GJ",
  "gujarat-high-court": "GJ",
};
