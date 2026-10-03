import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { PageHeader } from "@/components/ui";
import AdminManager, { type AdminItem } from "./AdminManager";

export const metadata = { title: "Admins" };

export default async function AdminsPage() {
  const me = await requirePage("admins.manage");
  const { data } = await db()
    .from("admins")
    .select("id,name,email,role,permissions,totp_enabled,must_change_password,disabled,last_login_at,created_at")
    .order("role")
    .order("created_at");
  return (
    <>
      <PageHeader title="Admins" description="Master admins have full access. Sub-admins only have the permissions you give them — never money, prices, deletions, other admins, the audit log or settings." />
      <AdminManager admins={(data ?? []) as AdminItem[]} myId={me.id} />
    </>
  );
}
