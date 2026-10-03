import Link from "next/link";
import { Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui";
import ContactList, { type ContactItem } from "./ContactList";

export const metadata = { title: "Contact messages" };

const TABS = [
  { key: "new", label: "New" },
  { key: "replied", label: "Replied" },
  { key: "closed", label: "Closed" },
] as const;

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePage("contact.manage");
  const requested = (await searchParams).status;
  const status = TABS.find((t) => t.key === requested)?.key ?? "new";
  const { data } = await db()
    .from("contact_messages")
    .select("id,name,email,phone,company,topic,message,status,created_at")
    .eq("status", status)
    .order("created_at", { ascending: status !== "new" ? false : true })
    .limit(200);
  const items = (data ?? []) as ContactItem[];

  return (
    <>
      <PageHeader title="Contact messages" description="Questions sent from the contact form on the Voyenta website." />
      <div className="mb-5 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/contact?status=${t.key}`}
            className={cn("rounded-lg px-4 py-1.5 text-sm font-medium transition", status === t.key ? "bg-ink text-white dark:bg-brand-neon dark:text-ink" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {items.length === 0 ? <EmptyState icon={Inbox} title={`No ${status} messages`} /> : <ContactList items={items} />}
    </>
  );
}
