/**
 * All 28 states and 8 Union Territories with their recruiting bodies.
 * Source: "State_Wise_Govt_Jobs_Hub.xlsx" (sheets "State-Wise Hub", "All Links", "Notes").
 * Corrections against the workbook are recorded in `note` and in docs/DATA_SOURCES.md.
 */

export type BodyCategory = "commission" | "board" | "police" | "teaching" | "portal" | "health";

export type StateBody = {
  name: string;
  short?: string;
  url: string;
  category: BodyCategory;
  note?: string;
  /** Login/application portals are not scanned for notices. */
  scan?: boolean;
};

export type StateSeed = {
  code: string;
  slug: string;
  name: string;
  type: "state" | "ut";
  highlights: string;
  needsLinkCheck?: boolean;
  bodies: StateBody[];
};

export const STATES: StateSeed[] = [
  {
    code: "AP", slug: "andhra-pradesh", name: "Andhra Pradesh", type: "state",
    highlights: "Village/ward secretariat posts, AP DSC teachers",
    bodies: [
      { name: "Andhra Pradesh Public Service Commission", short: "APPSC", url: "https://psc.ap.gov.in", category: "commission" },
      { name: "AP State Level Police Recruitment Board", short: "AP SLPRB", url: "https://slprb.ap.gov.in", category: "police" },
      { name: "AP District Selection Committee (Teachers)", short: "AP DSC", url: "https://apdsc.apcfss.in", category: "teaching" },
      { name: "Grama/Ward Sachivalayam", url: "https://gramawardsachivalayam.ap.gov.in", category: "board", note: "Domain did not resolve when checked on 2026-10-15; kept for admin follow-up." },
    ],
  },
  {
    code: "AR", slug: "arunachal-pradesh", name: "Arunachal Pradesh", type: "state",
    highlights: "APCCE, state civil services",
    bodies: [
      { name: "Arunachal Pradesh Public Service Commission", short: "APPSC (Arunachal)", url: "https://appsc.gov.in", category: "commission", note: "Shares the acronym APPSC with Andhra Pradesh; distinct body." },
      { name: "Arunachal Pradesh Government Portal", url: "https://arunachalpradesh.gov.in", category: "portal" },
    ],
  },
  {
    code: "AS", slug: "assam", name: "Assam", type: "state",
    highlights: "ADRE Grade III/IV, Assam Police",
    bodies: [
      { name: "Assam Public Service Commission", short: "APSC", url: "https://apsc.nic.in", category: "commission" },
      { name: "Board of Secondary Education, Assam (ADRE)", short: "SEBA", url: "https://sebaonline.org", category: "teaching", note: "An exam board, listed because it conducts ADRE recruitment exams." },
      { name: "State Level Police Recruitment Board, Assam", short: "SLPRB Assam", url: "https://slprbassam.in", category: "police" },
    ],
  },
  {
    code: "BR", slug: "bihar", name: "Bihar", type: "state",
    highlights: "BPSC TRE teachers, Bihar Police constable/SI, Panchayat Sachiv",
    bodies: [
      { name: "Bihar Public Service Commission", short: "BPSC", url: "https://bpsc.bihar.gov.in", category: "commission" },
      { name: "Bihar Staff Selection Commission", short: "BSSC", url: "https://bssc.bihar.gov.in", category: "board" },
      { name: "Bihar Police Subordinate Services Commission", short: "BPSSC", url: "https://bpssc.bihar.gov.in", category: "police" },
      { name: "Central Selection Board of Constable", short: "CSBC", url: "https://csbc.bihar.gov.in", category: "police" },
      { name: "Bihar Technical Service Commission", short: "BTSC", url: "https://btsc.bihar.gov.in", category: "health" },
    ],
  },
  {
    code: "CG", slug: "chhattisgarh", name: "Chhattisgarh", type: "state",
    highlights: "CG Vyapam (Patwari, teacher, ANM), CG Police",
    bodies: [
      { name: "Chhattisgarh Public Service Commission", short: "CGPSC", url: "https://psc.cg.gov.in", category: "commission" },
      { name: "Chhattisgarh Professional Examination Board", short: "CG Vyapam", url: "https://vyapam.cgstate.gov.in", category: "board" },
    ],
  },
  {
    code: "GA", slug: "goa", name: "Goa", type: "state", needsLinkCheck: true,
    highlights: "Goa Police, state department posts",
    bodies: [
      { name: "Goa Public Service Commission", short: "GPSC (Goa)", url: "https://gpsc.goa.gov.in", category: "commission" },
      { name: "Goa Government Portal", url: "https://www.goa.gov.in", category: "portal" },
    ],
  },
  {
    code: "GJ", slug: "gujarat", name: "Gujarat", type: "state",
    highlights: "Police LRD/PSI, Talati-cum-Mantri, GSSSB Clerk, GSRTC, GUVNL/GETCO Vidyut Sahayak",
    bodies: [
      { name: "Gujarat Public Service Commission", short: "GPSC", url: "https://gpsc.gujarat.gov.in", category: "commission" },
      { name: "Gujarat Subordinate Service Selection Board", short: "GSSSB", url: "https://gsssb.gujarat.gov.in", category: "board" },
      // OJAS is the state government's official recruitment portal, so it is treated as a board, not a general portal.
      { name: "OJAS (Online Job Application System)", short: "OJAS", url: "https://ojas.gujarat.gov.in", category: "board" },
    ],
  },
  {
    code: "HR", slug: "haryana", name: "Haryana", type: "state",
    highlights: "HSSC CET, HTET, Haryana Police constable, Patwari",
    bodies: [
      { name: "Haryana Public Service Commission", short: "HPSC", url: "https://hpsc.gov.in", category: "commission" },
      { name: "Haryana Staff Selection Commission", short: "HSSC", url: "https://hssc.gov.in", category: "board" },
    ],
  },
  {
    code: "HP", slug: "himachal-pradesh", name: "Himachal Pradesh", type: "state",
    highlights: "HP Police, JOA (IT), state department posts",
    bodies: [
      { name: "Himachal Pradesh Public Service Commission", short: "HPPSC", url: "https://hppsc.hp.gov.in", category: "commission" },
      { name: "Himachal Pradesh Rajya Chayan Aayog", short: "HPRCA", url: "https://hprca.hp.gov.in", category: "board", note: "Workbook listed hpsssb.hp.gov.in, the site of the dissolved HPSSSB; replaced with HPRCA's own domain (verify with sources:validate)." },
    ],
  },
  {
    code: "JH", slug: "jharkhand", name: "Jharkhand", type: "state",
    highlights: "JSSC CGL, Jharkhand Police constable",
    bodies: [
      { name: "Jharkhand Public Service Commission", short: "JPSC", url: "https://jpsc.gov.in", category: "commission" },
      { name: "Jharkhand Staff Selection Commission", short: "JSSC", url: "https://jssc.nic.in", category: "board" },
    ],
  },
  {
    code: "KA", slug: "karnataka", name: "Karnataka", type: "state",
    highlights: "KAS, PSI, KSRTC, KPTCL",
    bodies: [
      { name: "Karnataka Public Service Commission", short: "KPSC", url: "https://kpsc.kar.nic.in", category: "commission" },
      { name: "Karnataka Examinations Authority", short: "KEA", url: "https://cetonline.karnataka.gov.in/kea", category: "board" },
      { name: "Karnataka State Police", url: "https://ksp.karnataka.gov.in", category: "police" },
    ],
  },
  {
    code: "KL", slug: "kerala", name: "Kerala", type: "state",
    highlights: "Kerala PSC (nearly all state posts), KSEB, Devaswom Board. Single unified recruiter for the state",
    bodies: [{ name: "Kerala Public Service Commission", short: "Kerala PSC", url: "https://www.keralapsc.gov.in", category: "commission" }],
  },
  {
    code: "MP", slug: "madhya-pradesh", name: "Madhya Pradesh", type: "state",
    highlights: "MPESB (Patwari, Samooh, teachers), MP Police",
    bodies: [
      { name: "Madhya Pradesh Public Service Commission", short: "MPPSC", url: "https://mppsc.mp.gov.in", category: "commission" },
      { name: "Madhya Pradesh Employees Selection Board", short: "MPESB", url: "https://esb.mp.gov.in", category: "board" },
    ],
  },
  {
    code: "MH", slug: "maharashtra", name: "Maharashtra", type: "state",
    highlights: "Talathi, Police Bharti, MSRTC, Zilla Parishad",
    bodies: [
      { name: "Maharashtra Public Service Commission", short: "MPSC", url: "https://mpsc.gov.in", category: "commission" },
      { name: "Maharashtra Police", url: "https://mahapolice.gov.in", category: "police" },
    ],
  },
  {
    code: "MN", slug: "manipur", name: "Manipur", type: "state",
    highlights: "Manipur Police, MCS",
    bodies: [
      { name: "Manipur Public Service Commission", short: "MPSC (Manipur)", url: "https://mpscmanipur.gov.in", category: "commission" },
      { name: "Manipur Government Portal", url: "https://manipur.gov.in", category: "portal" },
    ],
  },
  {
    code: "ML", slug: "meghalaya", name: "Meghalaya", type: "state", needsLinkCheck: true,
    highlights: "Meghalaya Police, MSSB posts",
    bodies: [
      { name: "Meghalaya Public Service Commission", short: "MPSC (Meghalaya)", url: "https://mpsc.meghalaya.gov.in", category: "commission", note: "Workbook listed mpsc.nic.in, which no longer resolves (checked 2026-10-15); the commission now uses mpsc.meghalaya.gov.in." },
      { name: "Meghalaya Government Portal", url: "https://meghalaya.gov.in", category: "portal" },
    ],
  },
  {
    code: "MZ", slug: "mizoram", name: "Mizoram", type: "state",
    highlights: "Mizoram Police, state civil services",
    bodies: [
      { name: "Mizoram Public Service Commission", short: "MPSC (Mizoram)", url: "https://mpsc.mizoram.gov.in", category: "commission" },
      { name: "Mizoram Government Portal", url: "https://mizoram.gov.in", category: "portal" },
    ],
  },
  {
    code: "NL", slug: "nagaland", name: "Nagaland", type: "state",
    highlights: "NCS, Nagaland Police",
    bodies: [
      { name: "Nagaland Public Service Commission", short: "NPSC", url: "https://npsc.co.in", category: "commission", note: "Not a .gov.in domain; treated as the organisation's own domain." },
      { name: "Nagaland Government Portal", url: "https://nagaland.gov.in", category: "portal" },
    ],
  },
  {
    code: "OD", slug: "odisha", name: "Odisha", type: "state",
    highlights: "OCS, Revenue Inspector, Amin, Odisha Police SI",
    bodies: [
      { name: "Odisha Public Service Commission", short: "OPSC", url: "https://opsc.gov.in", category: "commission" },
      { name: "Odisha Staff Selection Commission", short: "OSSC", url: "https://ossc.gov.in", category: "board" },
      { name: "Odisha Subordinate Staff Selection Commission", short: "OSSSC", url: "https://osssc.gov.in", category: "board" },
      { name: "Odisha Police", url: "https://odishapolice.gov.in", category: "police" },
    ],
  },
  {
    code: "PB", slug: "punjab", name: "Punjab", type: "state",
    highlights: "PCS, Patwari, Punjab Police constable",
    bodies: [
      { name: "Punjab Public Service Commission", short: "PPSC", url: "https://ppsc.gov.in", category: "commission" },
      { name: "Punjab Subordinate Services Selection Board", short: "PSSSB", url: "https://sssb.punjab.gov.in", category: "board" },
      { name: "Punjab Police", url: "https://punjabpolice.gov.in", category: "police" },
    ],
  },
  {
    code: "RJ", slug: "rajasthan", name: "Rajasthan", type: "state",
    highlights: "RAS, Patwari, VDO, 4th Grade, Rajasthan Police",
    bodies: [
      { name: "Rajasthan Public Service Commission", short: "RPSC", url: "https://rpsc.rajasthan.gov.in", category: "commission" },
      { name: "Rajasthan Staff Selection Board", short: "RSSB", url: "https://rssb.rajasthan.gov.in", category: "board" },
      { name: "Rajasthan Police", url: "https://police.rajasthan.gov.in", category: "police" },
      { name: "SSO Rajasthan (application login portal)", short: "SSO Rajasthan", url: "https://sso.rajasthan.gov.in", category: "portal", scan: false },
    ],
  },
  {
    code: "SK", slug: "sikkim", name: "Sikkim", type: "state", needsLinkCheck: true,
    highlights: "Sikkim Police, state civil services",
    bodies: [
      { name: "Sikkim Public Service Commission", short: "SPSC", url: "https://spsc.sikkim.gov.in", category: "commission" },
      { name: "Sikkim Government Portal", url: "https://sikkim.gov.in", category: "portal" },
    ],
  },
  {
    code: "TN", slug: "tamil-nadu", name: "Tamil Nadu", type: "state",
    highlights: "TNPSC Group 1/2/4, TN Police, MRB nurses, TN teachers",
    bodies: [
      { name: "Tamil Nadu Public Service Commission", short: "TNPSC", url: "https://www.tnpsc.gov.in", category: "commission" },
      { name: "Teachers Recruitment Board, Tamil Nadu", short: "TN TRB", url: "https://trb.tn.gov.in", category: "teaching" },
      { name: "Tamil Nadu Uniformed Services Recruitment Board", short: "TNUSRB", url: "https://www.tnusrb.tn.gov.in", category: "police" },
      { name: "Medical Services Recruitment Board, Tamil Nadu", short: "TN MRB", url: "https://mrb.tn.gov.in", category: "health" },
    ],
  },
  {
    code: "TG", slug: "telangana", name: "Telangana", type: "state",
    highlights: "Group 1/2/3/4, TG Police, TG TET",
    bodies: [
      { name: "Telangana Public Service Commission", short: "TGPSC", url: "https://tgpsc.gov.in", category: "commission" },
      { name: "Telangana State Level Police Recruitment Board", short: "TGPRB", url: "https://www.tgprb.in", category: "police", note: "Not a .gov.in domain; treated as the organisation's own domain." },
    ],
  },
  {
    code: "TR", slug: "tripura", name: "Tripura", type: "state",
    highlights: "TRBT teachers, Tripura Police",
    bodies: [
      { name: "Tripura Public Service Commission", short: "TPSC", url: "https://tpsc.tripura.gov.in", category: "commission" },
      { name: "Teachers Recruitment Board, Tripura", short: "TRBT", url: "https://trb.tripura.gov.in", category: "teaching", note: "Workbook listed trbt.tripura.gov.in, which does not resolve; the board's site is trb.tripura.gov.in." },
    ],
  },
  {
    code: "UP", slug: "uttar-pradesh", name: "Uttar Pradesh", type: "state",
    highlights: "PCS, UPSSSC PET/Lekhpal, UP Police constable, UPESSC TGT/PGT",
    bodies: [
      { name: "Uttar Pradesh Public Service Commission", short: "UPPSC", url: "https://uppsc.up.nic.in", category: "commission" },
      { name: "UP Subordinate Services Selection Commission", short: "UPSSSC", url: "https://upsssc.gov.in", category: "board" },
      { name: "UP Police Recruitment & Promotion Board", short: "UPPRPB", url: "https://uppbpb.gov.in", category: "police" },
      { name: "UP Education Service Selection Commission", short: "UPESSC", url: "https://upessc.up.gov.in", category: "teaching" },
    ],
  },
  {
    code: "UK", slug: "uttarakhand", name: "Uttarakhand", type: "state",
    highlights: "UKSSSC group C, Uttarakhand Police",
    bodies: [
      { name: "Uttarakhand Public Service Commission", short: "UKPSC", url: "https://psc.uk.gov.in", category: "commission" },
      { name: "Uttarakhand Subordinate Service Selection Commission", short: "UKSSSC", url: "https://sssc.uk.gov.in", category: "board" },
    ],
  },
  {
    code: "WB", slug: "west-bengal", name: "West Bengal", type: "state",
    highlights: "WBCS, SLST teachers, WB Police constable/SI",
    bodies: [
      { name: "West Bengal Public Service Commission", short: "WBPSC", url: "https://wbpsc.gov.in", category: "commission" },
      { name: "West Bengal School Service Commission", short: "WBSSC", url: "https://wbssc.gov.in", category: "teaching" },
      { name: "West Bengal Police", url: "https://wbpolice.gov.in", category: "police" },
    ],
  },
  // ---- Union Territories ----
  {
    code: "AN", slug: "andaman-nicobar", name: "Andaman & Nicobar Islands", type: "ut", needsLinkCheck: true,
    highlights: "A&N Police, island administration posts. Departmental recruitment pages",
    bodies: [{ name: "Andaman & Nicobar Administration", url: "https://andaman.gov.in", category: "portal" }],
  },
  {
    code: "CH", slug: "chandigarh", name: "Chandigarh", type: "ut",
    highlights: "Chandigarh Police, municipal posts. Department pages",
    bodies: [{ name: "Chandigarh Administration", url: "https://chandigarh.gov.in", category: "portal" }],
  },
  {
    code: "DH", slug: "dadra-nagar-haveli-daman-diu", name: "Dadra & Nagar Haveli and Daman & Diu", type: "ut",
    highlights: "UT administration posts. Department pages",
    bodies: [
      { name: "DNH & DD Administration", url: "https://dnh.gov.in", category: "portal" },
      { name: "Daman District Portal", url: "https://daman.nic.in", category: "portal" },
    ],
  },
  {
    code: "DL", slug: "delhi", name: "Delhi", type: "ut",
    highlights: "DSSSB teachers/clerks, Delhi Police, DMRC",
    bodies: [
      { name: "Delhi Subordinate Services Selection Board", short: "DSSSB", url: "https://dsssb.delhi.gov.in", category: "board" },
      { name: "Delhi Police", url: "https://delhipolice.gov.in", category: "police" },
    ],
  },
  {
    code: "JK", slug: "jammu-kashmir", name: "Jammu & Kashmir", type: "ut",
    highlights: "Naib Tehsildar, Junior Assistant, JK Police",
    bodies: [
      { name: "Jammu & Kashmir Public Service Commission", short: "JKPSC", url: "https://jkpsc.nic.in", category: "commission" },
      { name: "J&K Services Selection Board", short: "JKSSB", url: "https://jkssb.nic.in", category: "board" },
      { name: "Jammu & Kashmir Police", url: "https://jkpolice.gov.in", category: "police" },
    ],
  },
  {
    code: "LA", slug: "ladakh", name: "Ladakh", type: "ut", needsLinkCheck: true,
    highlights: "UT Ladakh departmental posts. Department pages",
    bodies: [{ name: "Ladakh Administration", url: "https://ladakh.gov.in", category: "portal" }],
  },
  {
    code: "LD", slug: "lakshadweep", name: "Lakshadweep", type: "ut", needsLinkCheck: true,
    highlights: "Island administration, health and teaching posts. Department pages",
    bodies: [{ name: "Lakshadweep Administration", url: "https://lakshadweep.gov.in", category: "portal" }],
  },
  {
    code: "PY", slug: "puducherry", name: "Puducherry", type: "ut",
    highlights: "UT departmental posts, Puducherry Police. Department pages",
    bodies: [{ name: "Government of Puducherry", url: "https://py.gov.in", category: "portal" }],
  },
];
