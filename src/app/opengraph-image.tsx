import { OG_SIZE, ogCard } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} – latest government jobs, results and admit cards`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ eyebrow: "Sarkari Naukri · Results · Admit Cards", title: "Latest central & state government jobs from official sources", facts: ["Last dates", "Eligibility", "Official links"] });
}
