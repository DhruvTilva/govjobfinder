import { referenceOptions } from "@/lib/admin-queries";
import { NoticeEditor } from "@/components/admin/NoticeEditor";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Add notice" };

export default async function NewNoticePage() {
  return (
    <>
      <PageTitle title="Add notice manually" />
      <p className="mb-4 text-sm text-muted">Use this for notices from sources the pipeline cannot read. New notices go to the review queue; publish them from there.</p>
      <NoticeEditor opts={await referenceOptions()} />
    </>
  );
}
