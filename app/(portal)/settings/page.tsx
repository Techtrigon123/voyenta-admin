import { requirePage } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { FREE_MONTHLY_DOCUMENTS, GRACE_DAYS } from "@/lib/plans";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { isRazorpayConfigured } from "@/lib/razorpay";
import SettingsForms from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePage("settings.manage");
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Changes apply to the Vouchlio app within a minute and are recorded in the audit log." />
      <SettingsForms initial={settings} razorpayReady={isRazorpayConfigured()} />
      <Card className="mt-6">
        <CardTitle hint="Set in code — ask your developer to change">Fixed plan rules</CardTitle>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="rounded-xl bg-[var(--muted)] p-3">Grace period: <strong>{GRACE_DAYS.monthly} days</strong> (monthly) · <strong>{GRACE_DAYS.yearly} days</strong> (yearly)</li>
          <li className="rounded-xl bg-[var(--muted)] p-3">Silver allowance: <strong>{FREE_MONTHLY_DOCUMENTS} new documents</strong> per month</li>
          <li className="rounded-xl bg-[var(--muted)] p-3">Services per plan: Silver 3 · Gold 4 · Platinum 7 (receipts are Platinum-only)</li>
          <li className="rounded-xl bg-[var(--muted)] p-3">Legal contact (grievance officer) and live-chat keys: <code>lib/site.ts</code> and environment variables in the Vouchlio app</li>
        </ul>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">These are built into the Vouchlio app and the plan-approval database function, so they change together with a code update.</p>
      </Card>
    </>
  );
}
