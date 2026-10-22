import Link from "next/link";
import { authEnabled, currentUser } from "@/lib/user-auth";
import { getI18n } from "@/lib/i18n-server";

/** Header link: "Log in" for visitors, the visitor's first name (linking to the account page) once logged in. Hidden when login is not configured. */
export async function AccountLink() {
  if (!authEnabled()) return null;
  const [{ t }, user] = await Promise.all([getI18n(), currentUser()]);
  const label = user ? user.name.split(/\s+/)[0] || t("auth.account") : t("auth.login");
  return (
    <Link href={user ? "/account" : "/login"} className={`${user ? "btn-secondary" : "btn-primary"} max-w-32 shrink-0 px-3 py-1.5 sm:px-4 sm:py-2.5`} aria-label={user ? `${t("auth.account")}: ${user.name}` : label}>
      <span className="truncate">{label}</span>
    </Link>
  );
}
