import Link from "next/link";
import { listExamsAdmin, referenceOptions } from "@/lib/admin-queries";
import { ActionForm } from "@/components/admin/ActionForm";
import { Notice, PageTitle } from "@/components/admin/ui";
import { deleteExamAction, saveExamAction } from "../../../content-actions";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Exam directory" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ExamsAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [list, opts] = await Promise.all([listExamsAdmin(), referenceOptions()]);
  const editId = Number(sp.edit) || null;
  const editing = editId ? list.find((r) => r.e.id === editId)?.e : undefined;
  const v = (k: keyof NonNullable<typeof editing>) => (editing?.[k] == null ? "" : String(editing[k]));
  const groups = [...new Set(list.map((r) => r.e.group))];
  return (
    <>
      <PageTitle title="Exam directory">
        <Link href="/exams" className="btn-secondary" target="_blank">
          Public page ↗
        </Link>
        <Link href="/bigboss/content" className="btn-secondary">
          Back to content
        </Link>
      </PageTitle>
      {editId && !editing && <Notice tone="bad">Exam not found.</Notice>}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-bold">{editing ? `Edit: ${editing.name}` : "Add an exam"}</h2>
        <ActionForm key={editing?.id ?? "new"} action={saveExamAction} className="card grid gap-3 p-5 sm:grid-cols-2" submitLabel={editing ? "Save exam" : "Add exam"}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <label className="block sm:col-span-2">
            <span className="label">Exam name</span>
            <input name="name" required defaultValue={v("name")} className="input" />
          </label>
          <label className="block">
            <span className="label">Group</span>
            <input name="group" required list="exam-groups" defaultValue={v("group")} className="input" />
            <datalist id="exam-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="label">Rank (order within group)</span>
            <input name="rank" inputMode="numeric" defaultValue={v("rank")} className="input" />
          </label>
          <label className="block">
            <span className="label">Organisation</span>
            <select name="organizationId" defaultValue={v("organizationId")} className="input">
              <option value="">—</option>
              {opts.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.short ? `${o.short} — ${o.name}` : o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Recruiting body (as shown)</span>
            <input name="recruitingBody" defaultValue={v("recruitingBody")} className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Official URL</span>
            <input name="officialUrl" defaultValue={v("officialUrl")} className="input" />
          </label>
          <label className="block">
            <span className="label">Typical notification window</span>
            <input name="typicalWindow" defaultValue={v("typicalWindow")} className="input" />
          </label>
          <label className="block">
            <span className="label">Difficulty</span>
            <input name="difficulty" defaultValue={v("difficulty")} className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Focus areas</span>
            <input name="focusAreas" defaultValue={v("focusAreas")} className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Notes</span>
            <textarea name="notes" rows={2} defaultValue={v("notes")} className="input" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} className="h-4 w-4" /> Show on the public exam directory
          </label>
        </ActionForm>
        {editing && (
          <form action={deleteExamAction} className="mt-2 flex items-center gap-2 text-sm">
            <input type="hidden" name="id" value={editing.id} />
            <label className="flex items-center gap-1">
              <input type="checkbox" name="confirm" className="h-4 w-4" /> Yes, delete this exam
            </label>
            <SubmitButton className="btn-secondary text-danger" pendingLabel="Deleting…" label="Delete" />
            <Link href="/bigboss/content/exams" className="text-navy-700 underline">
              Cancel editing
            </Link>
          </form>
        )}
      </section>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Exam</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Organisation</th>
              <th className="px-3 py-2">Shown</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map(({ e, orgShort, orgName }) => (
              <tr key={e.id}>
                <td className="px-3 py-2">
                  <Link href={`/bigboss/content/exams?edit=${e.id}`} className="text-navy-700 hover:underline">
                    {e.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">{e.group}</td>
                <td className="px-3 py-2 text-xs">{orgShort ?? orgName ?? e.recruitingBody ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{e.active ? "yes" : "hidden"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
