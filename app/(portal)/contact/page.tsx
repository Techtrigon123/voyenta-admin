import { Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { EmptyState, PageHeader } from "@/components/ui";
import { NavBar } from "@/components/ui/tubelight-navbar";
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
      <PageHeader title="Contact messages" description="Questions sent from the contact form on the Vouchlio website." />
      <NavBar
        className="mb-5"
        layoutId="contact-tabs"
        items={TABS.map((t) => ({ name: t.label, url: `/contact?status=${t.key}` }))}
        active={TABS.find((t) => t.key === status)?.label}
      />
      {items.length === 0 ? <EmptyState icon={Inbox} title={`No ${status} messages`} /> : <ContactList items={items} />}
    </>
  );
}
