import { ShieldCheck } from "lucide-react";
import { requirePage } from "@/lib/auth/guard";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import PasswordForm from "./PasswordForm";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const admin = await requirePage(undefined, { allowPasswordChange: true });
  const first = admin.must_change_password || (await searchParams).first === "1";
  const perms = admin.role === "master" ? null : admin.permissions.filter((p): p is Permission => p in PERMISSIONS);

  return (
    <>
      <PageHeader title="My account" description={`${admin.name} · ${admin.email}`} />
      {admin.must_change_password ? (
        <p role="status" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          You&apos;re using a temporary password. Choose your own password to continue.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{first ? "Set your password" : "Change password"}</CardTitle>
          <PasswordForm forced={admin.must_change_password} />
        </Card>
        <Card>
          <CardTitle>Access</CardTitle>
          <p className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-brand-500" /> {admin.role === "master" ? "Master admin — full access" : "Sub admin"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">2-step verification: {admin.totp_enabled ? "on" : "off"} · last sign-in {formatDate(admin.last_login_at, true)}</p>
          {perms ? (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {perms.map((p) => (
                <li key={p}><Badge tone="brand">{PERMISSIONS[p]}</Badge></li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-xs text-[var(--muted-foreground)]">Lost your phone? Ask a master admin to reset your 2-step verification.</p>
        </Card>
      </div>
    </>
  );
}
