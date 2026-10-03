import Sidebar from "@/components/Sidebar";
import { requirePage, toView } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { openReviewCount, pendingPaymentCount, unansweredSupport } from "@/lib/queries";

/** Everything behind sign-in. Each page also checks its own permission. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePage(undefined, { allowPasswordChange: true });
  const [payments, support, reviews] = await Promise.all([
    can(admin, "payments.view") ? pendingPaymentCount().catch(() => 0) : 0,
    can(admin, "support.reply") ? unansweredSupport().then((w) => w.length).catch(() => 0) : 0,
    can(admin, "agents.verify") ? openReviewCount(can(admin, "agents.approve")).catch(() => 0) : 0,
  ]);
  return (
    <div className="min-h-screen">
      <Sidebar admin={toView(admin)} counts={{ payments, support, reviews }} />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
