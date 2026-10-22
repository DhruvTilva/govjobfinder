/**
 * Logo decisions from reviewing every downloaded logo by eye (2026-10-22). These organisations
 * show the initials badge instead of a logo; an editor can still upload one in the admin.
 */

/**
 * The website icon is the State Emblem of India or a state emblem containing it. Its use is
 * restricted by the State Emblem of India (Prohibition of Improper Use) Act, 2005.
 */
export const EMBLEM_LOGO_ORGS = [
  "andhra-pradesh-ap-dsc", "andhra-pradesh-appsc", "andhra-pradesh-ap-slprb", "assam-apsc", "assam-gauhati-hc", "bihar-bpsc", "bihar-patna-hc",
  "bsf", "cbi", "chhattisgarh-cg-hc", "chhattisgarh-cgpsc", "delhi-delhi-hc", "delhi-delhi-police", "enforcement-directorate",
  "goa-goa-government-portal", "gujarat-gpsc", "gujarat-high-court", "gujarat-seb", "haryana-hssc", "himachal-pradesh-hprca", "icar", "icmr",
  "indian-coast-guard", "indian-railways", "itbp", "jammu-kashmir-jammu-and-kashmir-police", "karnataka-karnataka-state-police",
  "madhya-pradesh-mp-hc", "maharashtra-mpsc", "meghalaya-meghalaya-government-portal", "odisha-opsc", "puducherry-government-of-puducherry",
  "punjab-ppsc", "punjab-psssb", "punjab-punjab-police", "rajasthan-rajasthan-hc", "rajasthan-rajasthan-police", "rajasthan-rpsc",
  "rajasthan-rssb", "rpf", "tamil-nadu-madras-hc", "tamil-nadu-tn-mrb", "tamil-nadu-tn-trb", "tamil-nadu-tnpsc", "tamil-nadu-tnusrb",
  "tripura-tpsc", "uttar-pradesh-uppsc", "uttarakhand-ukpsc", "west-bengal-west-bengal-police",
];

/**
 * The website declares an icon that is not the organisation's logo (the Indian flag, a web-server
 * default icon, a certification badge, a generic document icon, another body's logo, a banner).
 */
export const WRONG_ICON_ORGS = [
  "arunachal-pradesh-appsc-arunachal", "assam-nhm-assam", "bihar-btsc", "crpf", "ctet", "dadra-nagar-haveli-daman-diu-dnh-and-dd-administration",
  "gujarat-health", "jharkhand-jharkhand-hc", "ladakh-ladakh-administration", "lakshadweep-lakshadweep-administration",
  "mizoram-mizoram-government-portal", "mizoram-mpsc-mizoram", "nhm", "uttar-pradesh-sgpgims", "uttar-pradesh-upessc",
  "uttar-pradesh-uprvunl", "uttar-pradesh-upsssc", "uttarakhand-ubse", "uttarakhand-uksssc",
  // Main corporate sites checked too; their icons are still not the logo (app logo, LPG helpline
  // banner, certification badges, RTI badge, document icon, ministry emblem, cropped banner).
  "union-bank", "hpcl", "nhpc", "thdc", "cochin-shipyard", "hindustan-copper", "hll", "nicl", "indian-navy",
];

export const HIDDEN_LOGO_ORGS = [...EMBLEM_LOGO_ORGS, ...WRONG_ICON_ORGS];

/**
 * Page to look for the logo on when the recruitment site's own icon is wrong — usually the
 * organisation's main corporate site (e.g. AWEIL's careers pages are on ddpdoo.gov.in).
 */
export const LOGO_PAGES: Record<string, string> = {
  aweil: "https://aweil.in/",
  ntpc: "https://ntpc.co.in/",
  ongc: "https://ongcindia.com/",
  ecgc: "https://main.ecgc.in/",
};
