import { listAudit } from "@/lib/admin-queries";
import { formatDateTime } from "@/lib/status";
import { PageTitle, Table } from "@/components/admin/ui";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const rows = await listAudit();
  return (
    <>
      <PageTitle title="Audit log" />
      <p className="mb-4 text-sm text-muted">Latest 100 administrative actions, including sign-ins and failed sign-in attempts.</p>
      <Table head={["When", "Who", "Action", "Entity", "Details", "IP"]}>
        {rows.map(({ a, email }) => (
          <tr key={a.id} className="align-top">
            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDateTime(a.createdAt)}</td>
            <td className="px-3 py-2 text-xs">{email ?? "—"}</td>
            <td className="px-3 py-2 font-medium">{a.action.replace(/_/g, " ")}</td>
            <td className="px-3 py-2 text-xs">
              {a.entity} {a.entityId && `#${a.entityId.slice(0, 40)}`}
            </td>
            <td className="max-w-xs break-words px-3 py-2 text-xs text-muted">{a.details ? JSON.stringify(a.details).slice(0, 200) : ""}</td>
            <td className="px-3 py-2 text-xs text-muted">{a.ip}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
