import Sidebar from "@/components/Sidebar";
import LegalFooter from "@/components/legal/LegalFooter";
import { requirePage, toView } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { openReviewCount, pendingPaymentCount } from "@/lib/queries";
import { callbacksToHandle, ticketsNeedingReply } from "@/lib/support";

/** Everything behind sign-in. Each page also checks its own permission. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePage(undefined, { allowPasswordChange: true });
  const [payments, reviews, tickets, callbacks] = await Promise.all([
    can(admin, "payments.view") ? pendingPaymentCount().catch(() => 0) : 0,
    can(admin, "agents.verify") ? openReviewCount(can(admin, "agents.approve")).catch(() => 0) : 0,
    can(admin, "support.reply") ? ticketsNeedingReply().catch(() => 0) : 0,
    can(admin, "support.reply") ? callbacksToHandle().catch(() => 0) : 0,
  ]);
  return (
    <div className="min-h-screen">
      <Sidebar admin={toView(admin)} counts={{ payments, reviews, tickets, callbacks }} />
      <main className="flex min-h-screen flex-col lg:pl-64">
        <div className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        <LegalFooter />
      </main>
    </div>
  );
}
