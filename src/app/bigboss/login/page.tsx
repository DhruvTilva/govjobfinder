import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { LogoMark } from "@/components/icons";
import { SITE_NAME } from "@/lib/site";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/bigboss");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <LogoMark />
          <div>
            <p className="font-serif text-lg font-bold text-navy-950">{SITE_NAME}</p>
            <p className="text-xs text-muted">Admin sign in</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
