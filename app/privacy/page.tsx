import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

const EFFECTIVE_DATE = "18 October 2026";
const email = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;

/**
 * The Vouchlio Privacy Policy (same text as the public site, checkin-app/app/privacy), followed by the
 * part that applies only to staff using Vouchlio Admin.
 */
const sections: LegalSection[] = [
  {
    id: "information-we-collect",
    title: "Information we collect",
    summary: "Account, business profile, customer directory, document and security data — only what the service needs.",
    body: (
      <>
        <ul>
          <li>
            <strong>Account data:</strong> full name, business email, mobile/WhatsApp number, business name, login credentials
            (passwords stored only as a salted bcrypt hash), and plan and payment records &mdash; to sign subscribers in, secure
            accounts, manage subscriptions and give support.
          </li>
          <li>
            <strong>Business profile data:</strong> trade and legal business name, business type, logo and stamp, registered
            address, GSTIN, IATA number, landline, document-numbering settings and, only if added, bank and UPI details &mdash; to
            set up the workspace, brand generated PDFs and issue GST invoices for subscriptions under SAC code 998314.
          </li>
          <li>
            <strong>Customer directory:</strong> clients&apos; and travellers&apos; names, phone numbers, emails, billing addresses
            and tax identifiers (GSTIN, PAN or VAT) saved by subscribers &mdash; to fill documents quickly and keep private client
            records.
          </li>
          <li>
            <strong>Document data:</strong> guest and passenger names, flights, hotel stays, rooms, meal plans, pickups, drivers,
            amounts, payment status and references &mdash; to create, preview, store and deliver hotel vouchers, air tickets,
            pickup vouchers, welcome placards, itineraries, proforma invoices, tax invoices and receipts.
          </li>
          <li>
            <strong>Technical, log and security data:</strong> IP address, browser and device type, session tokens, sign-in
            times and security logs &mdash; to prevent unauthorised access, stop brute-force attacks and keep the service running.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use information",
    summary: "Only to provide the service, communicate about it and keep it secure and lawful. Client data is never used for marketing.",
    body: (
      <>
        <ul>
          <li>
            <strong>To provide the service:</strong> sign-in, generating PDFs and images, storing drafts and documents, and the
            customer directory.
          </li>
          <li>
            <strong>Service communications:</strong> password-reset links, profile and renewal reminders, in-app notifications,
            security alerts and service updates.
          </li>
          <li>
            <strong>Security and compliance:</strong> preventing fraud and misuse, tax and accounting obligations and legal
            requirements.
          </li>
        </ul>
        <p>
          For subscribers&apos; own data we are the Data Fiduciary under the Digital Personal Data Protection Act, 2023; for the
          travellers&apos; data subscribers enter, the subscriber is the Data Fiduciary and we act as their Data Processor.
        </p>
        <p>
          <strong>Non-solicitation and anti-poaching guarantee.</strong> Vouchlio and its parent entity, Frozen Highway, commit
          that subscriber client data is never used for travel marketing, and is never solicited, cross-sold, leased, shared for
          marketing or contacted by us under any circumstances. Admins must follow this too (see our{" "}
          <Link href="/terms">Terms of Use</Link>).
        </p>
      </>
    ),
  },
  {
    id: "storage-security",
    title: "Storage, retention and security",
    summary: "Encrypted at rest and in transit, each account limited to its own data, deleted within 30 days of closure.",
    body: (
      <ul>
        <li>Data is encrypted at rest (AES-256) by our cloud database provider and in transit with TLS (HTTPS).</li>
        <li>Every record belongs to one subscriber account, and every request is limited on the server to that account&apos;s data.</li>
        <li>
          Records are kept while the account is open; Silver-plan documents lock (not delete) 30 days after creation. On account
          closure or an erasure request, workspace records are deleted or anonymised within 30 days, except records the law
          requires us to keep (such as subscription invoices).
        </li>
        <li>Subscribers are responsible for the accuracy of the details they enter into documents.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Data processors and sharing",
    summary: "We never sell data. Only contracted service providers receive what they need to run the platform.",
    body: (
      <>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>What for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Cloud database and backups</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Hosting the website and this portal</td>
            </tr>
            <tr>
              <td>Razorpay (RBI-authorised payment aggregator)</td>
              <td>Subscription payments and refunds; card and bank details never reach our servers</td>
            </tr>
            <tr>
              <td>Anthropic (Claude)</td>
              <td>Reading a booking file a subscriber chooses to upload for auto-fill; no copy kept</td>
            </tr>
            <tr>
              <td>Hostinger</td>
              <td>Sending service emails such as password-reset links</td>
            </tr>
          </tbody>
        </table>
        <p>We may disclose data when required by law, a court order or a government authority.</p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your choices and rights (DPDP Act and GDPR)",
    summary: "Access, correct, erase, withdraw consent, nominate, and complain — email us and we reply within 30 days.",
    body: (
      <>
        <ul>
          <li><strong>Access and review</strong> your data and get a summary of how we use it.</li>
          <li><strong>Correct</strong> anything that is wrong.</li>
          <li><strong>Erase</strong> records or close the account, subject to what the law requires us to keep.</li>
          <li><strong>Withdraw consent</strong> at any time.</li>
          <li><strong>Nominate</strong> someone to act for you in case of death or incapacity.</li>
          <li>
            <strong>Complain</strong> to our Grievance Officer and then the Data Protection Board of India; people in the EU or UK
            also have their GDPR rights, including portability and objection.
          </li>
        </ul>
        <p>To use any of these rights, email {email}. We respond within 30 days.</p>
      </>
    ),
  },
  {
    id: "staff-data",
    title: "For admin staff: what we record about you",
    summary: "Your account, your sign-in security, and a record of every action you take in the portal.",
    body: (
      <>
        <ul>
          <li>
            <strong>Account details:</strong> your name, work email, role (master admin or sub-admin), your permissions, and who
            created your account and when.
          </li>
          <li>
            <strong>Password:</strong> stored only as a one-way bcrypt hash; nobody, including master admins and developers, can
            read it.
          </li>
          <li>
            <strong>2-step verification:</strong> the secret linking your authenticator app, stored encrypted (AES-256-GCM), and
            the last code used so it cannot be reused.
          </li>
          <li>
            <strong>Sign-in information:</strong> your last sign-in time and failed attempts, counted against your email and IP
            address to stop password guessing.
          </li>
          <li>
            <strong>Audit log:</strong> what you did, what it was done to, when, your email and IP address, and details such as
            before-and-after values or notes.
          </li>
          <li>
            <strong>Your work:</strong> notes on agent profiles and review notes on payments and profiles, saved with your name.
            Agents see support replies as &quot;Support&quot;, never your name.
          </li>
          <li>
            <strong>Display preference:</strong> light or dark mode, stored only in your browser.
          </li>
        </ul>
        <p>We use this to sign you in securely, give you the right access, keep everyone accountable and investigate problems.</p>
      </>
    ),
  },
  {
    id: "staff-audit-access",
    title: "For admin staff: audit log, access and retention",
    summary: "The audit log is permanent and visible only to master admins; your account data is kept while you have access.",
    body: (
      <ul>
        <li>
          The audit log is <strong>append-only</strong>: the database refuses any change or deletion of an entry. Only master
          admins can view it, and your entries stay with your email even if your account is later deleted.
        </li>
        <li>
          Master admins can see your account, permissions and audit entries, and can disable your account or sign you out. Other
          admins may see your name next to notes you wrote.
        </li>
        <li>
          Account details, password hash and 2-step secret are kept until your account is deleted; notes stay with the agent or
          payment they belong to; failed sign-in counters clear automatically within minutes to one day.
        </li>
        <li>
          You may ask to see or correct your data, or to erase your account once you no longer need access (audit entries are
          kept), by emailing {email}.
        </li>
      </ul>
    ),
  },
  {
    id: "staff-cookies-security",
    title: "For admin staff: cookies and security",
    summary: "One essential sign-in cookie, required 2-step codes, short sessions and strict limits on failed attempts.",
    body: (
      <ul>
        <li>
          <strong>vouchlio_admin</strong> (essential cookie) keeps you signed in for 12 hours (10 minutes while finishing sign-in);
          page scripts cannot read it. No analytics, advertising or tracking cookies are used. See the{" "}
          <Link href="/cookies">Cookie Policy</Link>.
        </li>
        <li>2-step verification is required on every admin account; new and reset passwords must be changed at first sign-in.</li>
        <li>Sign-in is limited to 10 attempts per IP address and 8 per email every 15 minutes, and 2-step codes to 5 tries every 5 minutes.</li>
        <li>Changing your password or being signed out by a master ends every other session at once; permission changes apply on your next click.</li>
      </ul>
    ),
  },
  {
    id: "changes",
    title: "Policy updates",
    summary: "We update the date at the top when this policy changes and announce important changes.",
    body: (
      <p>
        We may update this policy to reflect changes to the service or the law. We will change the &quot;Last updated&quot; date
        above and announce significant changes before they take effect. Continued use after the new effective date means you
        accept the updated policy.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact and Grievance Officer",
    summary: "Email support@vouchlio.com for any privacy question or request.",
    body: (
      <>
        <p>
          <strong>{LEGAL.grievanceOfficer}</strong>, Grievance &amp; Data Protection Officer
          <br />
          Email: {email}
          <br />
          {LEGAL.entityName} (parent entity: Frozen Highway), {LEGAL.address}
          <br />
          Website: <a href={LEGAL.siteUrl}>vouchlio.com</a>
        </p>
        <p>We acknowledge complaints within 48 hours and aim to resolve them within 30 days.</p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          <p>
            <strong>Effective date:</strong> {EFFECTIVE_DATE}
          </p>
          <p>
            Vouchlio (&quot;we&quot;, &quot;us&quot;, &quot;our&quot; or the &quot;Platform&quot;) is a cloud software-as-a-service (SaaS) travel
            documentation platform for travel agencies, tour operators, independent travel consultants and Destination Management
            Companies (DMCs). It is owned, designed and operated by the registered legal entity Frozen Highway. We do not sell
            personal or business data to third parties.
          </p>
          <p>
            This page covers the Vouchlio platform; the sections marked &quot;For admin staff&quot; also explain what {LEGAL.product}{" "}
            records about you while you work. Each section starts with a short summary.
          </p>
        </>
      }
      sections={sections}
    />
  );
}
