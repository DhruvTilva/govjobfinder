import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../actions";
import { LogoMark } from "@/components/icons";

const NAV: [string, string][] = [
  ["/admin", "Overview"],
  ["/admin/notices?status=needs_review", "Review queue"],
  ["/admin/notices", "All notices"],
  ["/admin/sources", "Sources"],
  ["/admin/pipeline", "Pipeline"],
  ["/admin/reference", "Reference data"],
  ["/admin/audit", "Audit log"],
  ["/admin/users", "Users"],
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-line bg-navy-950 text-white lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <LogoMark className="h-8 w-8" />
          <span className="font-serif font-bold">Admin</span>
          <Link href="/" className="ml-auto text-xs text-white/70 hover:text-white" target="_blank">
            View site ↗
          </Link>
        </div>
        <nav aria-label="Admin">
          <ul className="flex gap-1 overflow-x-auto px-2 pb-2 text-sm lg:flex-col lg:overflow-visible">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="block whitespace-nowrap rounded-md px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
            <li className="lg:hidden">
              <form action={logoutAction}>
                <button type="submit" className="block whitespace-nowrap rounded-md px-3 py-2 text-white/85 hover:bg-white/10">
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </nav>
        <div className="hidden border-t border-white/10 px-4 py-3 text-xs text-white/70 lg:block">
          <p className="truncate">{user.email}</p>
          <p className="capitalize">{user.role}</p>
          <form action={logoutAction}>
            <button type="submit" className="mt-2 text-white underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6">{children}</main>
    </div>
  );
}
