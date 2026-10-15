import { NoticePage, noticeMetadata } from "@/lib/notice-page";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return noticeMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <NoticePage slug={(await params).slug} expectRecruitment />;
}
