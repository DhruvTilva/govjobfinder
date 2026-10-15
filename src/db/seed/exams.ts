/**
 * "Top 50 Exams Technical Sector.xlsx" (Sheet1; Sheet2 is a formatted duplicate).
 * Columns kept: rank, position, group, recruiting body, link, historical notification
 * window, approx. salary, difficulty, core IT focus. Salary and difficulty are
 * unsourced in the workbook and are stored as indicative only — never shown as fact.
 */

export type ExamSeed = {
  rank: number;
  name: string;
  group: string;
  body: string;
  org?: string;
  url?: string;
  window: string;
  salary: string;
  difficulty: string;
  focus: string;
  note?: string;
  active?: boolean;
};

const FIN = "Financial & Regulatory";
const SCI = "Scientific & Technical (R&D)";
const PSU = "PSU Executive Trainee (via GATE)";
const ESE = "Technical Group 'A' Services (via UPSC ESE)";
const INT = "Specialised Intelligence & Audit";
const CEN = "Central Government Departments (Technical Roles)";

export const EXAMS: ExamSeed[] = [
  { rank: 1, name: "RBI Grade B Officer (DSIM/DEPR)", group: FIN, body: "RBI", org: "rbi", url: "https://opportunities.rbi.org.in", window: "July - September", salary: "₹1.50 Lakh+", difficulty: "Very High", focus: "Data Science, Predictive Modeling, FinTech" },
  { rank: 2, name: "SEBI Grade A Officer (IT Stream)", group: FIN, body: "SEBI", org: "sebi", url: "https://www.sebi.gov.in", window: "March - May", salary: "₹1.40 Lakh+", difficulty: "High", focus: "Cybersecurity, Network Ops, IT Regulation, IT Audit" },
  { rank: 3, name: "NABARD Grade A Officer (IT Stream)", group: FIN, body: "NABARD", org: "nabard", url: "https://www.nabard.org", window: "July - August", salary: "₹1.00 Lakh+", difficulty: "Medium-High", focus: "Core Banking Systems, IT Infrastructure, Digitalization" },
  { rank: 4, name: "SBI Specialist Officer (IT Manager/Developer)", group: FIN, body: "State Bank of India (SBI)", org: "sbi", url: "https://sbi.bank.in/web/careers", window: "Varies (multiple ads/year)", salary: "₹80,000 - ₹1.20 Lakh+", difficulty: "Medium-High", focus: "Digital Banking, System Development, Project Management" },
  { rank: 5, name: "IBPS SO (IT Officer Scale I)", group: FIN, body: "PSBs (via IBPS)", org: "ibps", url: "https://www.ibps.in", window: "November", salary: "₹65,000 - ₹75,000+", difficulty: "Medium", focus: "Core Banking Systems, Security, IT Operations" },
  { rank: 6, name: "DRDO Scientist 'B' (Computer Science)", group: SCI, body: "DRDO (RAC)", org: "drdo", url: "https://rac.gov.in", window: "June - August (via GATE)", salary: "₹85,000 - ₹1.00 Lakh+", difficulty: "Very High", focus: "AI, Cyber Warfare, Robotics, Defence Software R&D" },
  { rank: 7, name: "ISRO Scientist/Engineer-SC (CS/ECE)", group: SCI, body: "ISRO (ICRB)", org: "isro", url: "https://www.isro.gov.in/Careers.html", window: "May - June (varies by centre)", salary: "₹85,000 - ₹95,000+", difficulty: "High", focus: "Spacecraft Software, Satellite Data Processing, Ground Station IT" },
  { rank: 8, name: "BARC Scientific Officer (Computer Science)", group: SCI, body: "BARC (OCES/DGFS)", org: "barc", url: "https://www.barc.gov.in", window: "January - February", salary: "₹85,000 - ₹95,000+", difficulty: "High", focus: "Supercomputing, Nuclear Reactor Simulation, Critical IT" },
  { rank: 9, name: "NIC Scientist 'B'", group: SCI, body: "NIC / NIELIT", org: "nielit", url: "https://www.nielit.gov.in", window: "Infrequent (last cycle was Mar/Apr)", salary: "₹80,000 - ₹90,000+", difficulty: "Medium-High", focus: "E-Governance, System Architecture, Cloud Services" },
  { rank: 10, name: "C-DAC Scientist C/D", group: SCI, body: "C-DAC", org: "cdac", url: "https://www.cdac.in", window: "Varies (multiple times a year)", salary: "₹95,000 - ₹1.10 Lakh+", difficulty: "Medium-High", focus: "HPC, AI/ML, Data Security, Advanced Computing Research" },
  { rank: 11, name: "NTRO Scientist 'B'", group: SCI, body: "National Technical Research Organisation (NTRO)", org: "ntro", url: "https://ntro.gov.in", window: "Infrequent (often via GATE/direct)", salary: "₹85,000 - ₹95,000+", difficulty: "High", focus: "Technical Intelligence, Cyber Security, Cryptography" },
  { rank: 12, name: "MeitY Scientist 'C'", group: SCI, body: "MeitY", org: "meity", url: "https://www.meity.gov.in", window: "Infrequent", salary: "₹95,000 - ₹1.05 Lakh+", difficulty: "High", focus: "IT Policy, Standardization, Digital India Initiatives" },
  { rank: 13, name: "CSIR Scientist/Technical Officer", group: SCI, body: "CSIR Labs", org: "csir", url: "https://www.csir.res.in", window: "Varies by lab", salary: "₹80,000 - ₹90,000+", difficulty: "Medium-High", focus: "Scientific Research IT Support, Lab Automation" },
  { rank: 14, name: "ONGC Executive Trainee (ET) - IT/CSE", group: PSU, body: "ONGC", org: "ongc", url: "https://www.ongcindia.com", window: "April - May (application after GATE)", salary: "₹1.00 Lakh+ (during training)", difficulty: "Very High", focus: "Enterprise IT, ERP Systems, Geo-Informatics, Data Mgt." },
  { rank: 15, name: "NTPC Executive Trainee (ET) - IT/CSE", group: PSU, body: "NTPC", org: "ntpc", url: "https://careers.ntpc.co.in", window: "May - June (application after GATE)", salary: "₹90,000 - ₹1.05 Lakh+", difficulty: "High", focus: "Power Plant IT, Grid Management, SCADA Systems" },
  { rank: 16, name: "IOCL Officer/ET - IT", group: PSU, body: "IOCL", org: "iocl", url: "https://iocl.com", window: "April - May (application after GATE)", salary: "₹90,000 - ₹1.05 Lakh+", difficulty: "High", focus: "Petroleum IT Systems, Supply Chain Software, Automation" },
  { rank: 17, name: "GAIL Executive Trainee (ET) - IT/CSE", group: PSU, body: "GAIL", org: "gail", url: "https://gailonline.com", window: "Feb - March (application after GATE)", salary: "₹90,000 - ₹1.05 Lakh+", difficulty: "High", focus: "Gas Pipeline IT, Telecom, SCADA Security" },
  { rank: 18, name: "PGCIL Executive Trainee (ET) - IT/CSE", group: PSU, body: "PGCIL", org: "powergrid", url: "https://www.powergrid.in", window: "May - June (application after GATE)", salary: "₹90,000 - ₹1.05 Lakh+", difficulty: "High", focus: "Power Grid IT, Telecom Infrastructure, Network Security" },
  { rank: 19, name: "BHEL Engineer Trainee - IT", group: PSU, body: "BHEL", org: "bhel", url: "https://careers.bhel.in", window: "May - June (application after GATE)", salary: "₹90,000 - ₹1.00 Lakh+", difficulty: "High", focus: "Heavy Industry IT, Manufacturing Systems, Robotics" },
  { rank: 20, name: "AAI Executive Trainee (IT)", group: PSU, body: "AAI", org: "aai", url: "https://www.aai.aero", window: "Varies (via GATE/direct exam)", salary: "₹80,000 - ₹95,000+", difficulty: "Medium-High", focus: "Airport IT Systems, Air Traffic Management Software, Cybersecurity" },
  { rank: 21, name: "Indian Telecommunication Service (ITS)", group: ESE, body: "UPSC ESE", org: "upsc", url: "https://upsc.gov.in", window: "September", salary: "₹80,000 - ₹90,000+", difficulty: "Very High", focus: "Telecom Policy, Spectrum Management, Digital Infrastructure" },
  { rank: 22, name: "Indian Railway Management Service (formerly IRSSE)", group: ESE, body: "UPSC ESE", org: "upsc", url: "https://upsc.gov.in", window: "September", salary: "₹80,000 - ₹90,000+", difficulty: "Very High", focus: "Railway Signaling, Telecom & Control Systems", note: "IRSSE was merged into the Indian Railway Management Service (IRMS)." },
  { rank: 23, name: "DFO (Deputy Field Officer) Technical", group: INT, body: "Cabinet Secretariat", window: "Infrequent (often via GATE)", salary: "₹85,000 - ₹95,000+", difficulty: "High", focus: "Technical Intelligence, Strategic IT Operations, Cryptography", note: "Workbook mapped this to NTRO; DFO posts are recruited by the Cabinet Secretariat." },
  { rank: 24, name: "IA&AS (Indian Audit & Accounts Service)", group: INT, body: "UPSC CSE", org: "upsc", url: "https://upsc.gov.in", window: "February", salary: "₹80,000 - ₹90,000+", difficulty: "Very High", focus: "Financial Auditing, Extensive IT Audit and System Review" },
  { rank: 25, name: "Indian Civil Accounts Service (ICAS)", group: INT, body: "UPSC CSE", org: "upsc", url: "https://upsc.gov.in", window: "February", salary: "₹80,000 - ₹90,000+", difficulty: "Very High", focus: "Managing Central Payment Systems (PFMS), Govt. Accounting IT" },
  { rank: 26, name: "IB ACIO Grade-II/Executive (Technical)", group: INT, body: "Intelligence Bureau (IB)", org: "mha", url: "https://www.mha.gov.in", window: "November/December", salary: "₹70,000 - ₹80,000+", difficulty: "High", focus: "Technical Intelligence, Cyber Forensics, Surveillance Systems" },
  { rank: 27, name: "Assistant Professor (IITs/NITs/Central Univ.)", group: CEN, body: "Respective institutes", window: "Varies (rolling/specific ads)", salary: "₹1.00 Lakh+", difficulty: "Medium-High", focus: "Teaching, Research, Academic IT Systems, AI/ML" },
  { rank: 28, name: "Deputy Director (Computer/IT) in Census/Statistics Dept.", group: CEN, body: "UPSC/SSC/Direct Recruitment", org: "upsc", url: "https://upsc.gov.in", window: "Infrequent", salary: "₹90,000 - ₹1.00 Lakh+", difficulty: "High", focus: "National Data Management, Large-Scale Survey Analytics" },
  { rank: 29, name: "Technical Officer/Engineer (Central Water Commission)", group: CEN, body: "UPSC ESE/Direct", org: "upsc", url: "https://upsc.gov.in", window: "September", salary: "₹80,000 - ₹90,000+", difficulty: "High", focus: "Water Resource Modeling, Data Monitoring (IoT/Sensor Tech)" },
  { rank: 30, name: "Controller of Communication Accounts (CCA) Officer", group: CEN, body: "DoT/UPSC ESE", org: "upsc", url: "https://upsc.gov.in", window: "September", salary: "₹80,000 - ₹90,000+", difficulty: "Very High", focus: "Telecom Revenue Assurance, Spectrum Auction IT" },
  { rank: 31, name: "Defence Services - Technical Officer (Major/Eq.)", group: CEN, body: "CDS/AFCAT/Direct Technical Entry", org: "indian-army", url: "https://joinindianarmy.nic.in", window: "Varies (June/Dec)", salary: "₹80,000 - ₹1.00 Lakh+", difficulty: "Medium-High", focus: "Military Technology, Network Warfare, Communication IT" },
  { rank: 32, name: "Scientist/Technical Officer (Geological Survey of India)", group: CEN, body: "UPSC/GSI", org: "upsc", url: "https://upsc.gov.in", window: "Infrequent", salary: "₹85,000 - ₹95,000+", difficulty: "High", focus: "GIS, Remote Sensing, Data Processing for Earth Sciences" },
  { rank: 33, name: "Scientist 'C' (MHA/Cyber)", group: CEN, body: "Ministry of Home Affairs", org: "mha", url: "https://www.mha.gov.in", window: "Infrequent", salary: "₹95,000 - ₹1.05 Lakh+", difficulty: "High", focus: "Cybersecurity Policy, Critical Infrastructure Protection" },
  { rank: 34, name: "BBNL (BharatNet) Executive Trainee", group: CEN, body: "BSNL (BBNL merged into BSNL)", org: "bsnl", url: "https://www.bsnl.co.in", window: "Infrequent", salary: "₹90,000 - ₹1.00 Lakh+", difficulty: "High", focus: "National Fiber Optic Network Management, Telecom Infrastructure", note: "BBNL has been merged into BSNL; separate BBNL recruitment is unlikely.", active: false },
  { rank: 35, name: "CBI Technical Officer/Analyst", group: CEN, body: "SSC CGL/Direct Recruitment", org: "cbi", url: "https://cbi.gov.in", window: "Varies", salary: "₹75,000 - ₹90,000+", difficulty: "High", focus: "Investigation, Cyber Forensics, Digital Evidence Analysis" },
  { rank: 36, name: "ED Officer (Financial Analyst/IT)", group: CEN, body: "Directorate of Enforcement (ED)", org: "enforcement-directorate", url: "https://enforcementdirectorate.gov.in", window: "SSC CGL/Direct", salary: "₹70,000 - ₹85,000+", difficulty: "High", focus: "Financial Crime Investigation (High focus on data analysis)", note: "Workbook had the link and notification-month columns swapped; corrected." },
  { rank: 37, name: "Railway Recruitment Board (RRB) JE/SSE (IT)", group: CEN, body: "RRB", org: "rrb", url: "https://www.rrbapply.gov.in", window: "Infrequent", salary: "₹55,000 - ₹70,000+", difficulty: "Medium", focus: "Railway Network Systems, Ticketing Infrastructure" },
  { rank: 38, name: "Income Tax Inspector (Group B)", group: CEN, body: "SSC CGL", org: "ssc", url: "https://ssc.gov.in", window: "April - May", salary: "₹60,000 - ₹75,000+", difficulty: "Medium-High", focus: "Initial Level (High potential for IT-related assessment work)", note: "\"IT\" in the workbook title means Income Tax, not information technology." },
  { rank: 39, name: "Assistant Section Officer (ASO) (MeitY/DoT)", group: CEN, body: "SSC CGL", org: "ssc", url: "https://ssc.gov.in", window: "April - May", salary: "₹60,000 - ₹75,000+", difficulty: "Medium-High", focus: "Central Secretariat Admin (Crucial support in IT policy wings)" },
  { rank: 40, name: "Trainee Officer (Electronics/IT) in BEL", group: CEN, body: "BEL", org: "bel", url: "https://bel-india.in", window: "Varies (multiple ads/year)", salary: "₹65,000 - ₹80,000+", difficulty: "Medium", focus: "Defence Electronics, Embedded Software, Communication Systems" },
  { rank: 41, name: "HAL Management Trainee (Technical)", group: CEN, body: "HAL", org: "hal", url: "https://hal-india.co.in", window: "March - April (often via GATE)", salary: "₹80,000 - ₹95,000+", difficulty: "High", focus: "Aviation IT, Design Software, Maintenance Systems" },
  { rank: 42, name: "Coal India Ltd. Management Trainee (System)", group: CEN, body: "CIL", org: "coal-india", url: "https://www.coalindia.in", window: "March - April (often via GATE)", salary: "₹80,000 - ₹95,000+", difficulty: "High", focus: "Mining IT Systems, ERP, Data Center Operations" },
  { rank: 43, name: "NMDC Executive Trainee (Technical)", group: CEN, body: "NMDC", org: "nmdc", url: "https://www.nmdc.co.in", window: "Sept/Oct (via GATE)", salary: "₹80,000 - ₹95,000+", difficulty: "High", focus: "Mining IT Systems, Automation" },
  { rank: 44, name: "BPCL Management Trainee (Systems)", group: CEN, body: "BPCL", org: "bpcl", url: "https://www.bharatpetroleum.in", window: "Infrequent (via GATE)", salary: "₹90,000 - ₹1.05 Lakh+", difficulty: "High", focus: "Refinery IT, ERP, SCADA Systems" },
  { rank: 45, name: "NPCIL Executive Trainee (IT)", group: CEN, body: "NPCIL", org: "npcil", url: "https://www.npcil.nic.in", window: "April - May (via GATE)", salary: "₹80,000 - ₹95,000+", difficulty: "High", focus: "Nuclear Power Plant IT, Critical Infrastructure" },
  { rank: 46, name: "CVC Technical Officer/Analyst", group: CEN, body: "Central Vigilance Commission (CVC)", org: "cvc", url: "https://cvc.gov.in", window: "Infrequent (direct recruitment/deputation)", salary: "₹85,000 - ₹95,000+", difficulty: "High", focus: "Vigilance IT Systems, Monitoring and Audit Tools" },
  { rank: 47, name: "CGDA IDAS (Indian Defence Accounts Service)", group: CEN, body: "UPSC CSE", org: "upsc", url: "https://upsc.gov.in", window: "February", salary: "₹80,000 - ₹90,000+", difficulty: "Very High", focus: "Defence Finance, High-Volume Financial System Management" },
  { rank: 48, name: "Indian Railway Management Service (formerly IRPS)", group: CEN, body: "UPSC CSE", org: "upsc", url: "https://upsc.gov.in", window: "February", salary: "₹80,000 - ₹90,000+", difficulty: "Very High", focus: "Railway HR Management (Extensive use of IT/HRMS)", note: "IRPS was merged into the Indian Railway Management Service (IRMS)." },
  { rank: 49, name: "Assistant Director (Handlooms/Textiles)", group: CEN, body: "UPSC Recruitment", org: "upsc", url: "https://upsc.gov.in", window: "Varies", salary: "₹75,000 - ₹85,000+", difficulty: "Medium", focus: "Industry Data Analysis, IT Infrastructure for MSMEs" },
  { rank: 50, name: "State-Level IT Officer", group: CEN, body: "State PSCs / IT Departments", window: "Varies by state", salary: "₹70,000 - ₹95,000+", difficulty: "Medium-High", focus: "Managing State IT Infrastructure/Data Centers, E-Governance", note: "Workbook title included \"MNC\", which is not a government employer; see the state pages for State PSC links." },
];
