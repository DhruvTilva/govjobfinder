/**
 * Sector and qualification taxonomy.
 * Sectors come from "Sector-wise-job.docx" (12 sections) and the groups in
 * "Top 50 Exams Technical Sector.xlsx", split where candidates search separately
 * (e.g. IT vs. engineering, judiciary vs. postal).
 */

export type SectorSeed = { slug: string; name: string; description: string; keywords: string[] };

export const SECTORS: SectorSeed[] = [
  {
    slug: "upsc-civil-services",
    name: "UPSC & Civil Services",
    description: "Civil Services (IAS, IPS, IFS), NDA, CDS, CAPF, Engineering Services and other UPSC recruitments.",
    keywords: ["upsc", "civil services", "ias", "ips", "nda", "cds", "capf", "engineering services", "ese", "combined medical services", "epfo"],
  },
  {
    slug: "ssc",
    name: "SSC & Central Government",
    description: "Staff Selection Commission exams (CGL, CHSL, MTS, CPO, GD, JE, Stenographer) and central ministry posts.",
    keywords: ["ssc", "staff selection", "cgl", "chsl", "mts", "multi tasking", "cpo", "stenographer", "selection post", "gd constable"],
  },
  {
    slug: "railways",
    name: "Railways",
    description: "Railway Recruitment Boards and Cells: NTPC, Group D, ALP, JE, RPF and metro rail.",
    keywords: ["railway", "rrb", "rrc", "ntpc", "group d", "alp", "loco pilot", "rpf", "metro rail", "irctc"],
  },
  {
    slug: "banking-insurance",
    name: "Banking & Insurance",
    description: "IBPS, SBI, RBI, NABARD, SEBI, LIC and public-sector insurance recruitments.",
    keywords: ["bank", "ibps", "sbi", "rbi", "nabard", "sebi", "lic", "insurance", "probationary officer", "specialist officer", "assurance"],
  },
  {
    slug: "defence",
    name: "Defence",
    description: "Army, Navy, Air Force, Coast Guard, Agniveer and defence civilian posts.",
    keywords: ["army", "navy", "air force", "agniveer", "agnipath", "coast guard", "afcat", "territorial army", "naval", "military", "defence"],
  },
  {
    slug: "police-paramilitary",
    name: "Police & Paramilitary",
    description: "State police constables and SIs, CAPFs (BSF, CRPF, CISF, ITBP, SSB) and Assam Rifles.",
    keywords: ["police", "constable", "sub inspector", "bsf", "crpf", "cisf", "itbp", "ssb", "assam rifles", "jail warder", "home guard", "fireman"],
  },
  {
    slug: "teaching",
    name: "Teaching & Education",
    description: "School teachers (PRT, TGT, PGT), TETs, KVS, NVS, lecturers and university faculty.",
    keywords: ["teacher", "tet", "ctet", "pgt", "tgt", "prt", "lecturer", "professor", "kvs", "nvs", "faculty", "school", "principal", "librarian"],
  },
  {
    slug: "medical",
    name: "Medical & Healthcare",
    description: "Doctors, nurses, pharmacists, lab technicians and paramedical posts in AIIMS, ESIC, NHM and state health departments.",
    keywords: ["nurse", "nursing", "medical officer", "mbbs", "pharmacist", "aiims", "esic", "nhm", "anm", "gnm", "lab technician", "doctor", "paramedical", "health", "hospital"],
  },
  {
    slug: "engineering",
    name: "Engineering & Technical",
    description: "Junior/Assistant Engineer, technician, ITI and diploma-level technical posts.",
    keywords: ["junior engineer", "assistant engineer", "engineer", "technician", "iti", "diploma", "draughtsman", "electrician", "fitter", "overseer"],
  },
  {
    slug: "it-computer",
    name: "IT & Computer Science",
    description: "IT officers, programmers, scientists (CS), data entry and cyber security roles.",
    keywords: ["computer", "it officer", "programmer", "data entry", "software", "cyber", "information technology", "system analyst", "nielit", "nic"],
  },
  {
    slug: "scientific-research",
    name: "Scientific & Research",
    description: "Scientist and research posts at ISRO, DRDO, BARC, CSIR, ICAR and research fellowships.",
    keywords: ["scientist", "research", "isro", "drdo", "barc", "csir", "icar", "jrf", "srf", "project associate", "research associate", "fellow"],
  },
  {
    slug: "psu",
    name: "PSUs & Government Companies",
    description: "Executive and management trainees and other posts in public sector undertakings.",
    keywords: ["psu", "ntpc", "bhel", "ongc", "iocl", "indian oil", "gail", "sail", "coal india", "hal", "bel", "powergrid", "executive trainee", "management trainee", "limited"],
  },
  {
    slug: "judiciary",
    name: "Judiciary & Courts",
    description: "Supreme Court, High Court and district court recruitments, including civil judge posts.",
    keywords: ["court", "judicial", "judge", "high court", "district court", "civil judge", "supreme court", "tribunal"],
  },
  {
    slug: "postal",
    name: "India Post",
    description: "Gramin Dak Sevak, Postman, Mail Guard and other India Post recruitments.",
    keywords: ["india post", "gds", "gramin dak sevak", "postal", "postman", "mail guard", "dak"],
  },
  {
    slug: "agriculture-forest",
    name: "Agriculture & Forest",
    description: "Forest guards and rangers, agriculture, horticulture, veterinary and fisheries posts.",
    keywords: ["forest", "forester", "forest guard", "agriculture", "horticulture", "veterinary", "fisheries", "range officer", "wildlife"],
  },
  {
    slug: "apprenticeship",
    name: "Apprenticeships",
    description: "Apprenticeships under the Apprentices Act for ITI, diploma and graduate candidates.",
    keywords: ["apprentice", "apprenticeship", "act apprentice", "trade apprentice", "graduate apprentice"],
  },
  {
    slug: "state-government",
    name: "State Government (General)",
    description: "General state posts: clerks, patwari, lekhpal, talathi, village development officers and state civil services.",
    keywords: ["patwari", "lekhpal", "talathi", "vdo", "village development", "clerk", "gram sevak", "panchayat", "revenue inspector", "state civil service", "pcs"],
  },
  {
    slug: "other",
    name: "Other Government Jobs",
    description: "Recruitments that do not fit another category.",
    keywords: [],
  },
];

export type QualificationSeed = { slug: string; name: string; level: number; patterns: string[] };

/** Patterns are case-insensitive regex sources matched against notice text. */
export const QUALIFICATIONS: QualificationSeed[] = [
  { slug: "8th-pass", name: "8th Pass", level: 1, patterns: ["\\b8th\\s+(?:class\\s+)?pass", "class\\s+viii\\b", "middle\\s+(?:school\\s+)?pass"] },
  { slug: "10th-pass", name: "10th Pass", level: 2, patterns: ["\\b10th\\b", "\\bmatric(?:ulation)?\\b", "\\bsslc\\b", "high\\s+school", "class\\s+x\\b", "secondary school certificate"] },
  { slug: "12th-pass", name: "12th Pass", level: 3, patterns: ["\\b12th\\b", "\\bintermediate\\b", "higher\\s+secondary", "10\\s*\\+\\s*2", "senior\\s+secondary", "\\bhsc\\b"] },
  { slug: "iti", name: "ITI", level: 4, patterns: ["\\biti\\b", "\\bncvt\\b", "\\bscvt\\b", "industrial training institute"] },
  { slug: "diploma", name: "Diploma", level: 5, patterns: ["\\bdiploma\\b", "polytechnic"] },
  { slug: "graduate", name: "Graduate (Any Degree)", level: 6, patterns: ["\\bgraduat(?:e|ion)\\b", "bachelor'?s?\\s+degree", "\\bb\\.\\s?a\\.?\\b", "\\bb\\.\\s?sc\\b", "\\bb\\.\\s?com\\b", "any\\s+degree"] },
  { slug: "btech", name: "B.E. / B.Tech", level: 7, patterns: ["\\bb\\.?\\s?tech\\b", "\\bb\\.e\\.?(?=[\\s/,)])", "bachelor\\s+of\\s+(?:engineering|technology)", "engineering\\s+degree"] },
  { slug: "post-graduate", name: "Post Graduate", level: 8, patterns: ["post[\\s-]?graduat", "master'?s?\\s+degree", "\\bm\\.\\s?sc\\b", "\\bm\\.\\s?com\\b", "\\bmba\\b", "\\bmca\\b", "\\bm\\.?\\s?tech\\b", "\\bm\\.a\\.?\\b"] },
  { slug: "mbbs-medical", name: "MBBS / Medical Degree", level: 8, patterns: ["\\bmbbs\\b", "\\bbds\\b", "\\bbams\\b", "\\bbhms\\b", "\\bm\\.?d\\.?\\s*/\\s*m\\.?s\\.?\\b"] },
  { slug: "nursing", name: "Nursing (ANM / GNM / B.Sc Nursing)", level: 5, patterns: ["\\bgnm\\b", "\\banm\\b", "b\\.?\\s?sc\\.?\\s*\\(?nursing", "\\bnursing\\b"] },
  { slug: "pharmacy", name: "Pharmacy (D.Pharm / B.Pharm)", level: 6, patterns: ["\\bd\\.?\\s?pharm", "\\bb\\.?\\s?pharm", "\\bpharmacy\\b"] },
  { slug: "law", name: "Law (LLB)", level: 7, patterns: ["\\bll\\.?\\s?b\\b", "law\\s+graduate", "degree\\s+in\\s+law"] },
  { slug: "bed", name: "B.Ed / D.El.Ed", level: 7, patterns: ["\\bb\\.\\s?ed\\b", "\\bd\\.?\\s?el\\.?\\s?ed\\b", "\\bbtc\\b"] },
  { slug: "ca-cma-cs", name: "CA / CMA / CS", level: 8, patterns: ["chartered\\s+accountant", "\\bcma\\b", "\\bicwa\\b", "company\\s+secretary"] },
  { slug: "phd", name: "Ph.D", level: 9, patterns: ["\\bph\\.?\\s?d\\b", "doctorate"] },
];
