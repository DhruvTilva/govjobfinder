import { referenceOptions } from "@/lib/admin-queries";
import { SourceEditor } from "@/components/admin/SourceEditor";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Add source" };

export default async function NewSourcePage() {
  const { organizations } = await referenceOptions();
  return (
    <>
      <PageTitle title="Add source" />
      <p className="mb-4 text-sm text-muted">
        Only add official websites. The URL is checked for safety (public http/https address on a standard port). New sources start in “review every notice” mode.
      </p>
      <SourceEditor orgs={organizations} />
    </>
  );
}
