import { noticeOgImage } from "@/lib/notice-page";
import { OG_SIZE } from "@/lib/og";

export const alt = "Government job notice";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return noticeOgImage((await params).slug);
}
