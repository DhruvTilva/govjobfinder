import { currentAdmin } from "@/lib/auth";
import { listAdminUsers } from "@/lib/admin-queries";
import { formatDateTime } from "@/lib/status";
import { ActionForm } from "@/components/admin/ActionForm";
import { Field, PageTitle, Table } from "@/components/admin/ui";
import { createUser, toggleUser } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const [me, users] = await Promise.all([currentAdmin(), listAdminUsers()]);
  const isAdmin = me?.role === "admin";
  return (
    <>
      <PageTitle title="Users" />
      <p className="mb-4 text-sm text-muted">Editors can review and edit notices and sources. Admins can also manage users.</p>
      <Table head={["Email", "Name", "Role", "Status", "Last sign-in", ""]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="px-3 py-2">{u.email}</td>
            <td className="px-3 py-2">{u.name}</td>
            <td className="px-3 py-2 capitalize">{u.role}</td>
            <td className={`px-3 py-2 ${u.active ? "text-ok" : "text-danger"}`}>{u.active ? "active" : "deactivated"}</td>
            <td className="px-3 py-2 text-muted">{formatDateTime(u.lastLoginAt)}</td>
            <td className="px-3 py-2">
              {isAdmin && u.id !== me?.id && (
                <form action={toggleUser}>
                  <input type="hidden" name="id" value={u.id} />
                  <SubmitButton className="text-xs font-semibold text-navy-700 underline" pendingLabel="Saving changes…">{u.active ? "Deactivate" : "Activate"}</SubmitButton>
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {isAdmin && (
        <section className="mt-6 max-w-xl">
          <h2 className="mb-2 text-lg font-bold">Add user</h2>
          <ActionForm action={createUser} className="card p-4" submitLabel="Create account">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" htmlFor="u-email">
                <input id="u-email" name="email" type="email" required className="input" />
              </Field>
              <Field label="Name" htmlFor="u-name">
                <input id="u-name" name="name" required className="input" />
              </Field>
              <Field label="Role" htmlFor="u-role">
                <select id="u-role" name="role" className="input" defaultValue="editor">
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field label="Temporary password (12+ chars)" htmlFor="u-pass">
                <input id="u-pass" name="password" type="password" minLength={12} required autoComplete="new-password" className="input" />
              </Field>
            </div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
