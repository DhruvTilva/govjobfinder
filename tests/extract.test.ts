import { describe, it, expect } from "vitest";
import { parseDate, findAllDates, todayIST } from "@/pipeline/dates";
import { classify, detectAmendment } from "@/pipeline/classify";
import { extractFields, extractAdvtNo, extractTotalPosts, extractAge, detectQualifications, detectSector } from "@/pipeline/extract";
import { harvestLinks } from "@/pipeline/harvest";
import { QUALIFICATIONS, SECTORS } from "@/db/seed/taxonomy";

describe("dates", () => {
  it("parses day-first numeric dates", () => {
    expect(parseDate("15/10/2026")).toBe("2026-10-15");
    expect(parseDate("05.01.2027")).toBe("2027-01-05");
    expect(parseDate("5-1-26")).toBe("2026-01-05");
  });
  it("parses written dates", () => {
    expect(parseDate("15th October, 2026")).toBe("2026-10-15");
    expect(parseDate("15-Oct-2026")).toBe("2026-10-15");
    expect(parseDate("October 15, 2026")).toBe("2026-10-15");
    expect(parseDate("1st Sept 2026")).toBe("2026-09-01");
  });
  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("10/13/2026")).toBeNull();
  });
  it("finds multiple dates", () => {
    expect(findAllDates("from 01/10/2026 to 31/10/2026").map((d) => d.iso)).toEqual(["2026-10-01", "2026-10-31"]);
  });
  it("computes IST date", () => {
    expect(todayIST(new Date("2026-10-15T20:00:00Z"))).toBe("2026-10-16");
  });
});

describe("classify", () => {
  it("prefers follow-up kinds over recruitment", () => {
    expect(classify("Result of Recruitment of Assistant Engineer 2026").kind).toBe("result");
    expect(classify("Admit Card for Constable Recruitment Exam").kind).toBe("admit_card");
    expect(classify("Provisional Answer Key - CBT held on 12.10.2026").kind).toBe("answer_key");
  });
  it("detects recruitment notices", () => {
    expect(classify("Advertisement No. 05/2026 for recruitment of 120 Staff Nurse").kind).toBe("recruitment");
    expect(classify("Walk-in interview for Project Associate").kind).toBe("recruitment");
    expect(classify("भर्ती विज्ञापन 2026").kind).toBe("recruitment");
  });
  it("classifies real follow-up titles that start with an advertisement number", () => {
    // Seen on isro.gov.in / drdo.gov.in on 2026-10-15.
    expect(classify("Advt. No. ISRO:ICRB:02(EMC-CEPO):2026 dated 28-07-2026 - List of candidates screened in for interview").kind).toBe("result");
    expect(classify("Advt No. ISRO:ICRB:02(EMC):2025 dated 27.05.2025 - Schedule of Interview for the post of Scientist/Engineer").kind).toBe("exam_date");
    expect(classify("ADVT NO. ISRO:ICRB:01(A-JPA):2026 DATED 27.07.2026 - Tentative Date of conducting the Skill Test: 25th October").kind).toBe("exam_date");
    expect(classify("List of provisionally selected and waitlisted candidates for awarding JRF through Walk-in-Interview").kind).toBe("result");
    expect(classify("Advt. No. HSFC:02:RMT:2026, Dated:09.10.2026 - Inviting applications for the post GROUP 'A' Medical Officer").kind).toBe("recruitment");
  });
  it("classifies more real follow-up phrasings (HSSC, GPSC, KEA, state PSC programmes)", () => {
    expect(classify("Declaration of waiting list for the post of Primary Teacher (Mewat Cadre) against Advt. No 3/2024").kind).toBe("result");
    expect(classify("Important Ineligibility List (Interview) - 124/2025-26 (Deputy Executive Engineer)").kind).toBe("result");
    expect(classify("Assistant Engineer Recruitment 2026 – Eligible & Rejected Candidates List").kind).toBe("result");
    expect(classify("TENTATIVE PROGRAMME FOR THE MONTH OF NOVEMBER 2025 for the post of INSPECTOR OF HOUSING").kind).toBe("exam_date");
  });
  it("separates admissions and counselling from recruitments, and reads city intimation slips (2026-10-21)", () => {
    expect(classify("Inviting Online Applications for the National Institute of Fashion Technology (NIFT) Admission 2027").kind).toBe("admission");
    expect(classify("UP B.Ed Joint Entrance Exam 2027 Notification").kind).toBe("admission");
    expect(classify("NEET UG 2026 Counselling Schedule").kind).toBe("admission");
    expect(classify("Bihar Polytechnic DCECE Admission 2026").kind).toBe("admission");
    expect(classify("NEET UG 2026 Result Declared").kind).toBe("result");
    expect(classify("JEE Main 2027 Admit Card").kind).toBe("admit_card");
    expect(classify("SSC CGL 2026 City Intimation Slip").kind).toBe("admit_card");
    // Recruitment counselling stays a schedule, and job notices stay recruitments.
    expect(classify("Counselling for the post of Staff Nurse").kind).toBe("exam_date");
    expect(classify("Recruitment of TGT (B.Ed required) 2026").kind).toBe("recruitment");
  });
  it("keeps state-commission process notices out of recruitments (JKPSC, PSSSB, DSSSB, TPSC, TNPSC; 2026-10-19)", () => {
    expect(classify("Deficiency of documents for the post of Assistant Architect").kind).toBe("other");
    expect(classify("Rejection of candidature of Mr. X for the post of Lecturer").kind).toBe("other");
    expect(classify("Public Notice regarding Rejection of Incomplete Applications for the post of Clerk").kind).toBe("other");
    expect(classify("Scribe Notice for the post of Group-D (Advt. no. 04 of 2026)").kind).toBe("other");
    expect(classify("Junior_assistant_ (Revised Distribution of Vacancies)").kind).toBe("other");
    expect(classify("Recommendation list for recruitment to the post of Programme Assistant").kind).toBe("result");
    expect(classify("NOTICE : Conducting of Physical Endurance Test (PET) for the post of Forest Guard").kind).toBe("exam_date");
    // Genuine adverts are unaffected.
    expect(classify("Filling up of the post of Medical Officer (Allopathic) in Health Department").kind).toBe("recruitment");
    expect(classify("Advertisement No. 13 of 2026 for the Posts of Head Draftsman, Law Officer").kind).toBe("recruitment");
  });
  it("falls back to other", () => {
    expect(classify("Annual report 2025-26").kind).toBe("other");
  });
  it("detects amendments", () => {
    expect(detectAmendment("Corrigendum to Advt No 3/2026")).toBe("corrigendum");
    expect(detectAmendment("Extension of last date for online application")).toBe("extension");
    expect(detectAmendment("Cancellation of advertisement no 4/2026")).toBe("cancelled");
    expect(detectAmendment("Recruitment of Clerk")).toBeNull();
  });
});

const SAMPLE = `
STAFF SELECTION BOARD
Advertisement No. 07/2026
Recruitment of Junior Assistant (Total Posts: 245)
Applications are invited on regular basis.
Important Dates
Starting date of online application: 01/10/2026
Last date for submission of online application: 31-10-2026 (11:59 PM)
Tentative date of written examination: December 14, 2026
Age Limit: 18 to 40 years as on 01.01.2026. Relaxation as per rules.
Application Fee: General/OBC Rs. 500/-; SC/ST/PwBD/Women: Nil
Pay Level-4 (Rs. 25,500 - 81,100) in the Pay Matrix
Educational Qualification: Graduate from a recognised university with knowledge of computer operation.
`;

describe("extractFields", () => {
  const f = extractFields(SAMPLE);
  it("extracts dates by label", () => {
    expect(f.applyStart).toBe("2026-10-01");
    expect(f.applyEnd).toBe("2026-10-31");
    expect(f.examDate).toBe("2026-12-14");
  });
  it("extracts numbers and text fields", () => {
    expect(f.advtNo).toBe("07/2026");
    expect(f.totalPosts).toBe(245);
    expect(f.ageMin).toBe(18);
    expect(f.ageMax).toBe(40);
    expect(f.feeText).toMatch(/Rs\. 500/);
    expect(f.salaryText).toMatch(/Pay Level-4/);
    expect(f.qualificationText).toMatch(/Graduate/);
    expect(f.jobType).toBe("permanent");
  });
  it("returns nulls instead of guessing", () => {
    const e = extractFields("Notice regarding office timings.");
    expect(e.applyEnd).toBeNull();
    expect(e.totalPosts).toBeNull();
    expect(e.advtNo).toBeNull();
    expect(e.ageMax).toBeNull();
  });
  it("handles common alternative phrasings", () => {
    expect(extractAdvtNo("Notification No: CEN 03/2026 (JE)")).toMatch(/CEN 03\/2026/);
    expect(extractTotalPosts("No. of Vacancies – 1,200".replace(",", ""))).toBe(1200);
    expect(extractAge("candidates should be between 21 and 35 years of age").max).toBe(35);
    expect(extractFields("Applications must reach this office on or before 15th November, 2026.").applyEnd).toBe("2026-11-15");
  });
  it("ignores old cited dates as the notification date (seen in a CRPF notice)", () => {
    const f = extractFields("As per MHA order dated 07/01/2004. Starting date of Online application : 12/10/2026 Closing date of Online application : 11/11/2026");
    expect(f.applyEnd).toBe("2026-11-11");
    expect(f.noticeDate).toBeNull();
    expect(f.importantDates.map((d) => d.label)).not.toContain("Notification date");
  });
  it("reads IBPS-style important-events tables and DRDO start/end labels", () => {
    const ibps = extractFields("Important Events | Dates | Commencement of online registration of application | 01/10/2026 | Closure of registration of application | 01/11/2026 |");
    expect(ibps.applyStart).toBe("2026-10-01");
    expect(ibps.applyEnd).toBe("2026-11-01");
    const drdo = extractFields("Advertisement No DMRL/HRD/JRF/2026/01 Published Date 06-10-2026 Start Date 06-10-2026 End Date 27-10-2026");
    expect(drdo.applyEnd).toBe("2026-10-27");
  });
  it("reads date ranges and ignores a closing-date label used as a reference point (IBPS CRP PO/MT-XVI)", () => {
    const f = extractFields(
      "IMPORTANT DATES \nActivity Tentative Schedule \nOnline Registration including Edit/Modification\nof Application by candidates\n01-07-2026 to 21-07-2026 \n" +
        "Payment of Application Fees/Intimation Charges\n(Online)\n01-07-2026 to 21-07-2026 \n" +
        "Ex-Servicemen … whose assignment is due to be completed within one year from the\nlast date of receipt of application i.e., 20.07.2027) otherwise than by way of dismissal",
    );
    expect(f.applyStart).toBe("2026-07-01");
    expect(f.applyEnd).toBe("2026-07-21");
    expect(f.applyEndAlternatives).toEqual([]);
  });
  it("prefers a revised application deadline over the original and over a fee extension (ISRO IPRC)", () => {
    const f = extractFields(
      "The last date of submission of online application is revised to 24.10.2026 (up to 5 pm). " +
        "The last date of remittance of online application fee is extended up to 29.10.2026 (till 5 pm). " +
        "Last date for submission of online application is\n05.10.2026 16:00 hrs",
    );
    expect(f.applyEnd).toBe("2026-10-24");
    expect(f.applyEndAlternatives).toEqual([]);
  });
  it("reads closing-date labels in Indian languages (Gujarat OJAS, Hindi notices)", () => {
    expect(extractFields("GSSSB - Staff Nurse (PwD SRD) ( અંતિમ તારીખ 29-October-2026 )").applyEnd).toBe("2026-10-29");
    expect(extractFields("ऑनलाइन आवेदन की अंतिम तिथि: 15/11/2026").applyEnd).toBe("2026-11-15");
    // PSSSB Advt. 13/2026 as extracted from the PDF (the ਿ vowel sign comes out before its consonant).
    expect(extractFields("ਆਨਲਾਈਨ ਅਪਲਾਈ ਕਰਨ ਦੀ ਸ਼ੁਰੂਆਤੀ ਿਮਤੀ : - 01-10-2026 \nਆਖਰੀ ਿਮਤੀ - 22-10-2026").applyEnd).toBe("2026-10-22");
  });
  it("ignores printing deadlines and flags genuinely conflicting closing dates", () => {
    const print = extractFields("Closure of registration of application | 28/10/2026 | Last date for printing your application | 12/11/2026");
    expect(print.applyEnd).toBe("2026-10-28");
    expect(print.applyEndAlternatives).toEqual([]);
    const conflict = extractFields("Last date for receipt of applications: 10.11.2026. … Applications must reach the office on or before 15.12.2026.");
    expect(conflict.applyEnd).toBe("2026-11-10");
    expect(conflict.applyEndAlternatives).toEqual(["2026-12-15"]);
  });
});

describe("staleReason", () => {
  it("archives years-old advertisements without a closing date", async () => {
    const { staleReason } = await import("@/pipeline/process");
    expect(staleReason("Recruitment of Ayurvedic Medical Officer (Regular),Advt.No.-09/2022", null, "", "2026-10-15")).toMatch(/2022/);
    expect(staleReason("Recruitment of Drug Inspector Advt.No.-12/2025", null, "", "2026-10-15")).toBeNull();
    expect(staleReason("Recruitment of Clerk", null, "Notice dated 01/01/2026. Interview on 05/02/2026.", "2026-10-15")).toMatch(/90 days/);
    expect(staleReason("Recruitment of Clerk", null, "Notice dated 01/10/2026.", "2026-10-15")).toBeNull();
  });
});

describe("taxonomy detection", () => {
  const quals = QUALIFICATIONS.map((q, i) => ({ id: i + 1, patterns: q.patterns }));
  const slugOf = (ids: number[]) => ids.map((id) => QUALIFICATIONS[id - 1].slug);
  it("detects qualifications", () => {
    expect(slugOf(detectQualifications("B.Tech / B.E. in Computer Science or MCA", quals))).toEqual(
      expect.arrayContaining(["btech", "post-graduate"]),
    );
    expect(slugOf(detectQualifications("10th pass with ITI in Electrician trade", quals))).toEqual(expect.arrayContaining(["10th-pass", "iti"]));
    expect(slugOf(detectQualifications("GNM or B.Sc Nursing", quals))).toContain("nursing");
  });
  it("detects sector from title keywords", () => {
    const sectors = SECTORS.map((s, i) => ({ id: i + 1, keywords: s.keywords }));
    const slug = (id: number | null) => (id ? SECTORS[id - 1].slug : null);
    expect(slug(detectSector("Recruitment of Staff Nurse in AIIMS", "", sectors))).toBe("medical");
    expect(slug(detectSector("Police Constable Recruitment 2026", "", sectors))).toBe("police-paramilitary");
    expect(slug(detectSector("Office notice", "", sectors))).toBeNull();
  });
});

describe("harvestLinks", () => {
  it("titles generic 'Download Advertisement' links from their notice row or card (NPCIL, BEL; 2026-10-21)", () => {
    const npcil = `<table><tr><td>08.10.2026</td><td>NPCIL / HQ / HRM / ET / 2026 / 03</td><td>Recruitment of Engineering Graduates in NPCIL Through Gate.</td>
      <td><a href="/writereaddata/Advt-ET-2026.pdf">Download Advertisement</a></td></tr></table>`;
    expect(harvestLinks(npcil, "https://www.npcil.nic.in/content/289_1_Opportunities.aspx")[0].text).toContain("Recruitment of Engineering Graduates in NPCIL");
    const bel = `<div class="career-result-box"><h4>Application for the post of Director (Research and Development)</h4><div class="advertisements"><div class="row"><div class="col-md-4">
      <div class="attchment-pdf"><div class="pdf-file-info"><a href="/wp-content/uploads/2026/10/Director-RD-Advertisement.pdf">Click here to view the Detailed Advertisement - [pdf, 175.01 KB]</a></div></div></div></div></div></div>`;
    const [link] = harvestLinks(bel, "https://bel-india.in/job-notifications/");
    expect(link.text).toContain("Application for the post of Director (Research and Development)");
    expect(link.text).not.toContain("Click here");
  });
  it("does not borrow a block's text when it holds several notices' links", () => {
    const block = `<div><h4>Recruitment of Officers 2026</h4><a href="/a.pdf">Download Advertisement</a> <a href="/b.pdf">Download Advertisement</a> <a href="/c.pdf">Download Advertisement</a></div>`;
    for (const l of harvestLinks(block, "https://example.gov.in/")) expect(l.text).toBe("Download Advertisement");
  });
  const html = `<html><body>
    <nav><a href="/recruitment">Recruitment</a></nav>
    <ul>
      <li>Advertisement No. 3/2026 for recruitment of Assistant Professor <a href="/docs/advt3.pdf">Click here</a></li>
      <li><a href="/docs/tender.pdf">Tender notice for recruitment agency housekeeping</a></li>
      <li><a href="https://example.gov.in/result.pdf">Result of Written Exam for Clerk Recruitment 2026</a></li>
      <li><a href="javascript:void(0)">Recruitment popup</a></li>
      <li><a href="/photo.jpg">Recruitment drive photos</a></li>
    </ul></body></html>`;
  const links = harvestLinks(html, "https://example.gov.in/home");
  it("resolves generic anchors using their row text", () => {
    expect(links[0]).toMatchObject({ url: "https://example.gov.in/docs/advt3.pdf" });
    expect(links[0].text).toMatch(/Assistant Professor/);
  });
  it("drops tenders, scripts, images and bare section links", () => {
    expect(links.map((l) => l.url)).toEqual(["https://example.gov.in/docs/advt3.pdf", "https://example.gov.in/result.pdf"]);
  });
  it("skips un-rendered template placeholders (seen on a JS-rendered PSC site)", () => {
    const html = `<ul><li><a href="/n/1.pdf">{{'PreExamMainExamInt_HM' | translate }} recruitment notice</a></li></ul>`;
    expect(harvestLinks(html, "https://example.gov.in/")).toEqual([]);
  });
  it("ignores navigation menus even when the link has a page extension", () => {
    const nav = `<body><div><a href="/recruitment.html">Recruitment</a><a href="/advt.aspx">Advertisement</a>
      <a href="/about.html">About</a> Home About RAC Chairperson Director About Us Programmes Recruitment Assessment</div></body>`;
    expect(harvestLinks(nav, "https://example.gov.in/")).toEqual([]);
  });
});

describe("titles", () => {
  it("tidies shouted titles but keeps acronyms", async () => {
    const { tidyTitle } = await import("@/lib/text");
    expect(tidyTitle("FINAL RESULT FOR RECRUITMENT TO 101 POSTS OF HORTICULTURE DEVELOPMENT OFFICER")).toBe(
      "Final Result for Recruitment to 101 Posts of Horticulture Development Officer",
    );
    expect(tidyTitle("UPSC CSE 2026 NOTIFICATION")).toBe("UPSC CSE 2026 Notification");
    expect(tidyTitle("Recruitment of Staff Nurse")).toBe("Recruitment of Staff Nurse");
  });
  it("flags labels merged from multi-link rows (seen on mpsc.mizoram.gov.in)", async () => {
    const { looksGarbled } = await import("@/lib/text");
    expect(looksGarbled("Induction Induction NotificationsInduction Valid/Rejected ListInduction Results")).toBe(true);
    expect(looksGarbled("LDE Results LDE Results 2022-2025LDE Results 2024-2026")).toBe(true);
    expect(looksGarbled("Recruitment of Assistant Engineer (Civil) in PWD")).toBe(false);
  });
  it("does not merge row text when a row has several links", () => {
    const html = `<table><tr><td>Induction <a href="/a.pdf">Notifications</a> <a href="/b.pdf">Valid/Rejected List</a> <a href="/c.pdf">Results</a></td></tr></table>`;
    const links = harvestLinks(html, "https://mpsc.mizoram.gov.in/");
    expect(links.every((l) => !/Induction/.test(l.text))).toBe(true);
  });
});

describe("pickNoticePdf", async () => {
  const { pickNoticePdf } = await import("@/pipeline/process");
  it("prefers the notice's own attachment over site-wide PDFs (GPSC news page)", () => {
    const links = [
      { url: "https://gpsc.gujarat.gov.in/Documents/ES-14-10-20261.pdf", text: "Exam Schedule" },
      { url: "https://gpsc.gujarat.gov.in/Documents/Online-Application.pdf", text: "Online Application" },
      { url: "https://gpsc.gujarat.gov.in/Documents/AdvertismentDocument/DIP-106-2025-26.pdf", text: "View Attachment" },
    ];
    expect(pickNoticePdf(links, "Interview Schedule - 106/2025-26 Detailed Interview Programme (Chief Scientific Officer)")?.url).toContain("DIP-106-2025-26.pdf");
  });
  it("follows a lone PDF but refuses to guess among unrelated ones", () => {
    expect(pickNoticePdf([{ url: "https://x.gov.in/a.pdf", text: "Notice" }], "Anything")?.url).toBe("https://x.gov.in/a.pdf");
    const unrelated = [
      { url: "https://x.gov.in/rti.pdf", text: "RTI Act" },
      { url: "https://x.gov.in/holidays.pdf", text: "Holiday list" },
    ];
    expect(pickNoticePdf(unrelated, "Recruitment of Staff Nurse 2026")).toBeNull();
  });
});

describe("corporate notices on PSU and bank sites", () => {
  it("are not harvested as notices (IRCON, NALCO, GRSE investor pages; 2026-10-21)", () => {
    const html = `<ul>
      <li><a href="/a.pdf">Published Unaudited Financial Results for the quarter ended 30th June 2026</a></li>
      <li><a href="/b.pdf">110th AGM - Voting Results and Scrutinizers Report 2025-26</a></li>
      <li><a href="/c.pdf">Notice of Board Meeting to consider results</a></li>
      <li><a href="/d.pdf">Recruitment of Tradesman Trainees 2026 - Detailed Advertisement</a></li></ul>`;
    expect(harvestLinks(html, "https://www.example.gov.in/").map((l) => l.text)).toEqual(["Recruitment of Tradesman Trainees 2026 - Detailed Advertisement"]);
  });
});
