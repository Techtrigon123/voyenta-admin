import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

const contact = LEGAL.contactEmail ? (
  <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
) : (
  "a master admin"
);

const sections: LegalSection[] = [
  {
    id: "who-this-covers",
    title: "Who this policy covers",
    summary: "This policy is about you, the staff member using Vouchlio Admin, and the data we keep about your account and your work.",
    body: (
      <>
        <p>
          {LEGAL.product} is the internal portal that {LEGAL.entityName} (&quot;we&quot;, &quot;us&quot;), {LEGAL.address}, uses to run
          Vouchlio. Master admins and sub-admins use it to review plan payments, check agent profiles, answer support chats and
          keep accounts healthy.
        </p>
        <p>This policy explains what personal data we collect about <strong>you as an admin</strong>, why, who can see it, how long we keep it and what your rights are.</p>
        <p>
          The data of travel agents and their customers that you see inside the portal is covered by the public Vouchlio Privacy
          Policy. How you must handle that data is set out in our <Link href="/terms">Terms of Use</Link>.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect about you",
    summary: "Your account details, your login security settings, and a record of every action you take in the portal.",
    body: (
      <>
        <ul>
          <li>
            <strong>Account details:</strong> your name, work email address, role (master admin or sub-admin), the permissions you
            have been given, who created your account and when.
          </li>
          <li>
            <strong>Password:</strong> stored only as a one-way bcrypt hash. Nobody, including master admins and our developers, can
            read your password.
          </li>
          <li>
            <strong>2-step verification:</strong> the secret that links your authenticator app to your account. It is stored
            encrypted (AES-256-GCM), and we also record the last code you used so it cannot be used twice.
          </li>
          <li>
            <strong>Sign-in information:</strong> the time of your last sign-in and failed sign-in attempts, counted against your
            email and IP address to stop password guessing.
          </li>
          <li>
            <strong>Audit log:</strong> a record of the actions you take. It includes what you did (for example &quot;payment
            approved&quot; or &quot;agent suspended&quot;), what it was done to, the time, your email, your IP address and relevant
            details such as before-and-after values or the note you wrote.
          </li>
          <li>
            <strong>Your work:</strong> internal notes you add to agent profiles and review notes on payments and profiles, saved
            with your name. Support replies are sent to agents as &quot;Support&quot;, and the audit log records which admin sent them.
          </li>
          <li>
            <strong>Display preference:</strong> whether you chose light or dark mode. This is stored only in your own browser.
          </li>
        </ul>
        <p>We do not collect your phone number, home address, ID documents or any data from your device beyond what is listed here.</p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    summary: "To sign you in safely, give you the right access, and keep a trustworthy record of who did what.",
    body: (
      <ul>
        <li><strong>To sign you in securely</strong> and keep other people out of your account.</li>
        <li><strong>To give you the right access:</strong> your role and permissions decide which pages and actions you can use.</li>
        <li>
          <strong>To keep everyone accountable:</strong> the audit log lets us answer questions such as &quot;who approved this payment?&quot;
          or &quot;who changed this agent&apos;s plan?&quot;. This protects agents, the business and you.
        </li>
        <li><strong>To investigate problems</strong> such as disputes, mistakes, suspicious sign-ins or security incidents.</li>
        <li><strong>To meet legal duties,</strong> for example tax records for payments or responding to lawful requests.</li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    summary: "One essential sign-in cookie and one display setting. No tracking, analytics or advertising.",
    body: (
      <>
        <ul>
          <li>
            <strong>vouchlio_admin</strong> (essential cookie): keeps you signed in. It cannot be read by page scripts, is only sent to
            this site and expires after 12 hours. While you are halfway through signing in, it lasts only 10 minutes.
          </li>
          <li>
            <strong>Theme setting</strong> (browser storage): remembers light or dark mode on this device only. It never leaves your
            browser.
          </li>
        </ul>
        <p>
          The portal does not use analytics, advertising or tracking cookies, and fonts are served from our own site. Because the
          sign-in cookie is needed for the portal to work, it cannot be switched off. The full list is in the{" "}
          <Link href="/cookies">Cookie Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "audit-log",
    title: "The audit log",
    summary: "Every admin action is recorded permanently. Nobody, not even a master admin, can edit or delete an entry.",
    body: (
      <>
        <p>
          The audit log is <strong>append-only</strong>: new entries can be added, but the database itself refuses any attempt to
          change or delete an existing one. This keeps the record honest for everyone.
        </p>
        <ul>
          <li>Only master admins can view the audit log. Sub-admins cannot see it.</li>
          <li>Sign-in events are recorded too, including failed attempts and account recovery.</li>
          <li>
            If your admin account is later deleted, your past entries stay in the log with your email address, so the history
            remains complete.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "who-can-see",
    title: "Who can see your data",
    summary: "Master admins, and the service providers that host the portal. We never sell it.",
    body: (
      <>
        <ul>
          <li>
            <strong>Master admins</strong> can see your account details, your permissions and your audit log entries, and can disable
            your account or sign you out.
          </li>
          <li>
            <strong>Other admins</strong> may see your name next to notes and reviews you have written.
          </li>
          <li>
            <strong>Agents</strong> never see your name, email, role or activity. Your support replies reach them as &quot;Support&quot;.
          </li>
          <li>
            <strong>Service providers</strong> that host the portal and its database (such as Supabase and our hosting provider)
            store the data for us under contract. They may not use it for their own purposes.
          </li>
          <li>
            <strong>Authorities</strong>, only when the law requires it.
          </li>
        </ul>
        <p>We do not sell, rent or share your data for marketing.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    summary: "Strong passwords, required 2-step codes, short sessions and strict limits on failed attempts.",
    body: (
      <ul>
        <li>2-step verification is required on every admin account. You cannot use the portal without it.</li>
        <li>New and reset passwords are temporary and must be changed at your first sign-in.</li>
        <li>Sign-in is limited to 10 attempts per IP address and 8 per email every 15 minutes, and 2-step codes to 5 tries every 5 minutes.</li>
        <li>Changing your password, or a master admin signing you out, ends every other session straight away.</li>
        <li>Disabling an account or changing permissions takes effect on your very next click, because every request is checked against the database.</li>
        <li>Requests from other websites are blocked, and the admin cookie is separate from the agent app&apos;s, so the two can never be mixed up.</li>
        <li>Admin data can only be reached through the portal&apos;s server, never directly from a browser.</li>
      </ul>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    summary: "Your account data is kept while you have access. The audit log is kept permanently.",
    body: (
      <ul>
        <li><strong>Account details, password hash and 2-step secret:</strong> until your account is deleted. A disabled account keeps them so it can be turned back on.</li>
        <li><strong>Audit log:</strong> kept permanently, as explained above.</li>
        <li><strong>Notes and reviews:</strong> kept as long as the agent record or payment they belong to.</li>
        <li><strong>Failed sign-in counters:</strong> cleared automatically after their time window (minutes to one day).</li>
      </ul>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    summary: "You can ask to see or correct your data, and ask questions or raise a complaint at any time.",
    body: (
      <>
        <p>Under India&apos;s Digital Personal Data Protection Act, 2023, you can:</p>
        <ul>
          <li><strong>See</strong> a summary of the personal data we hold about you.</li>
          <li><strong>Correct</strong> details that are wrong. You can change your own password on the Account page; a master admin can correct your other details.</li>
          <li><strong>Ask for erasure</strong> of your account once you no longer need access. Audit log entries are kept, because the business has a legitimate need for a complete record.</li>
          <li><strong>Raise a grievance</strong> and get a response, and if you are not satisfied, complain to the Data Protection Board of India.</li>
          <li><strong>Nominate</strong> someone to exercise these rights for you if you are unable to.</li>
        </ul>
        <p>To use any of these rights, contact {contact}.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    summary: "If we change this policy, we update the date at the top and tell admins about important changes.",
    body: <p>We may update this policy when the portal or the law changes. For important changes, we will tell admins before or when they take effect, for example by email or a notice in the portal.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    summary: "Questions about your data go to the address below.",
    body: (
      <p>
        {LEGAL.entityName}, {LEGAL.address}. For privacy questions or to report a concern, contact {contact}.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This page explains, in plain language, what {LEGAL.product} records about you while you work and why. The short
          &quot;In short&quot; box at the start of each section gives you the key point, and the text below gives the full detail.
        </p>
      }
      sections={sections}
    />
  );
}
