import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Cookie Policy" };

const contact = LEGAL.contactEmail ? <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> : "a master admin";

/** Everything this portal stores in the browser. Keep in step with the code when adding storage. */
const STORAGE: { name: string; type: string; purpose: string; lasts: string }[] = [
  { name: "vouchlio_admin", type: "Cookie (essential)", purpose: "Keeps you signed in, including the 2-step verification step. Can't be read by page scripts and is only sent to this site.", lasts: "12 hours (10 minutes while finishing sign-in)" },
  { name: "vouchlio-admin-theme", type: "Browser storage", purpose: "Remembers light or dark mode.", lasts: "Until you clear site data" },
  { name: "vouchlio-admin-notifications-seen:…", type: "Browser storage", purpose: "Remembers which notifications you've already seen, so the bell only counts new ones.", lasts: "Until you clear site data" },
  { name: "vouchlio-admin-notifications-muted", type: "Browser storage", purpose: "Remembers whether you muted the notification sound.", lasts: "Until you clear site data" },
  { name: "vouchlio-admin-cookie-notice", type: "Browser storage", purpose: "Remembers that you've seen the cookie notice.", lasts: "Until you clear site data" },
];

const sections: LegalSection[] = [
  {
    id: "summary",
    title: "What we use",
    summary: "Only what the portal needs to work: one sign-in cookie and a few settings saved in your browser. No tracking, analytics or ads.",
    body: (
      <>
        <p>
          {LEGAL.product} is an internal tool for {LEGAL.entityName} staff. It uses one <strong>essential cookie</strong> to keep you signed in,
          and your browser&apos;s own storage to remember a few display settings.
        </p>
        <p>We don&apos;t use analytics, advertising, social-media or any other third-party cookies, and nothing here follows you to other websites.</p>
      </>
    ),
  },
  {
    id: "list",
    title: "Everything we store",
    summary: "The full list, with what each item does and how long it lasts.",
    body: (
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--muted)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Purpose</th>
              <th className="px-3 py-2 font-semibold">How long</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {STORAGE.map((s) => (
              <tr key={s.name} className="align-top">
                <td className="px-3 py-2.5 font-mono text-xs">{s.name}</td>
                <td className="px-3 py-2.5">{s.type}</td>
                <td className="px-3 py-2.5">{s.purpose}</td>
                <td className="px-3 py-2.5">{s.lasts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "consent",
    title: "Why there's no consent switch",
    summary: "Everything listed is strictly necessary for the portal or is a setting you chose, so there's nothing optional to turn off.",
    body: (
      <>
        <p>
          The sign-in cookie is required for the portal to work at all — without it you can&apos;t stay signed in. The browser-storage items
          only remember choices you made (theme, sound, what you&apos;ve read) and never leave your device.
        </p>
        <p>If we ever add anything optional, such as analytics, we&apos;ll ask for your consent first and update this page.</p>
      </>
    ),
  },
  {
    id: "control",
    title: "How to clear them",
    summary: "Log out to remove the sign-in cookie, or clear this site's data in your browser to remove everything.",
    body: (
      <ul>
        <li><strong>Log out</strong> removes the sign-in cookie straight away.</li>
        <li>Your browser&apos;s settings (Privacy → Cookies and site data) can clear everything this site stored. You&apos;ll need to sign in again and your display settings reset.</li>
        <li>Blocking cookies for this site will stop you from signing in.</li>
      </ul>
    ),
  },
  {
    id: "contact",
    title: "Questions",
    summary: "Ask us about anything stored on your device.",
    body: (
      <p>
        See the <Link href="/privacy">Privacy Policy</Link> for how we handle your account data. For questions about cookies, contact {contact}.
      </p>
    ),
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      intro={<p>This page lists every cookie and browser-storage item {LEGAL.product} uses, in plain language. The short version: only what&apos;s needed to sign you in and remember your settings.</p>}
      sections={sections}
    />
  );
}
