import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Use" };

const contact = LEGAL.contactEmail ? (
  <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
) : (
  "a master admin"
);

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreeing to these terms",
    summary: "By signing in, you agree to follow these rules every time you use the portal.",
    body: (
      <>
        <p>
          These Terms of Use are an agreement between you and {LEGAL.entityName} (&quot;we&quot;, &quot;us&quot;) about how you may use{" "}
          {LEGAL.product} (&quot;the portal&quot;). By signing in, you confirm that you have read and accept them.
        </p>
        <p>
          They work alongside your employment or service contract, any confidentiality agreement you have signed, and our{" "}
          <Link href="/privacy">Privacy Policy</Link>. If anything here conflicts with your contract, your contract wins.
        </p>
      </>
    ),
  },
  {
    id: "who-may-use",
    title: "Who may use the portal",
    summary: "Only people a master admin has given an account to, and only for Vouchlio work.",
    body: (
      <ul>
        <li>The portal is for authorised {LEGAL.entityName} staff and contractors only. Accounts are created by a master admin; there is no public sign-up.</li>
        <li>Your account is personal to you. It must never be shared, lent or used by anyone else, even a colleague.</li>
        <li>You may use the portal only for work you have been asked to do for Vouchlio, never for personal reasons or for another business.</li>
        <li>If you are not an authorised user, you must leave now. Unauthorised access may be a criminal offence under the Information Technology Act, 2000.</li>
      </ul>
    ),
  },
  {
    id: "account-security",
    title: "Keeping your account safe",
    summary: "Keep your password and 2-step codes to yourself, and tell a master admin straight away if anything seems wrong.",
    body: (
      <>
        <p>You are responsible for everything done with your account, so please:</p>
        <ul>
          <li>Use a strong password that you do not use anywhere else, and change your temporary password at your first sign-in.</li>
          <li>Set up 2-step verification on a phone or app that only you control. Never share or read out a 6-digit code to anyone; no genuine colleague will ever ask for it.</li>
          <li>Do not save your password in a browser on a shared or public computer, and always <strong>Log out</strong> when you finish on one.</li>
          <li>Lock your screen when you step away while signed in.</li>
          <li>
            Tell a master admin <strong>immediately</strong> if you lose the phone with your authenticator, think someone knows your
            password, or see activity you did not do. They can sign you out everywhere and reset your access.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "roles",
    title: "Roles and permissions",
    summary: "Use only the access you have been given, for the tasks it was given for. Never try to get around the limits.",
    body: (
      <>
        <ul>
          <li>
            <strong>Master admins</strong> can do everything, including approving payments, managing admins, viewing the audit log and
            changing settings.
          </li>
          <li>
            <strong>Sub-admins</strong> only have the permissions a master admin has turned on for them. By design they can never move
            money, change prices, delete agents, change an agent&apos;s email, manage admins, view the audit log or change settings.
          </li>
        </ul>
        <p>
          Having a permission does not mean you should use it for everything. Use it only when your task needs it. Never try to get
          more access than you have been given, use someone else&apos;s account, or find ways around the portal&apos;s checks.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "What you must and must not do",
    summary: "Be accurate, look only at what you need, and never misuse, copy or share what you see.",
    body: (
      <>
        <p><strong>You must:</strong></p>
        <ul>
          <li>Act honestly and carefully, and check the facts before you approve, reject, suspend or change anything.</li>
          <li>Write clear, truthful notes so others understand why you made a decision.</li>
          <li>Follow the two-step review: a sub-admin checks, and a master admin makes the final decision.</li>
          <li>Treat agents politely and professionally in support tickets and callbacks.</li>
        </ul>
        <p><strong>You must not:</strong></p>
        <ul>
          <li>Open agent profiles, documents, payments or support tickets that you do not need for your current task, out of curiosity or for anyone else.</li>
          <li>Copy, screenshot, download, print, forward or photograph agent or customer data, except where your task requires it and through the portal&apos;s own tools.</li>
          <li>Contact agents or their customers outside official Vouchlio channels, or use their details for any other purpose.</li>
          <li>Ask an agent for their password or a one-time code. Use the portal&apos;s reset link instead.</li>
          <li>Approve or decide anything where you have a personal interest, such as a payment from a friend, relative or your own business. Hand it to another admin.</li>
          <li>Change prices, plans, features or account status as a favour, or in return for money or gifts.</li>
          <li>Use scripts, bots or automated tools on the portal, test its security, or try to reach its database or server directly.</li>
          <li>Upload or paste harmful files, links or code.</li>
        </ul>
      </>
    ),
  },
  {
    id: "agent-data",
    title: "Handling agent and customer data",
    summary: "Everything you see in the portal is confidential. Use the minimum, keep it inside the portal, and protect it.",
    body: (
      <>
        <p>
          The portal shows sensitive information: agents&apos; contact and business details, GSTIN and PAN, bank and UPI details,
          payment proofs and transaction IDs, support conversations, and the names and travel details of agents&apos; customers. All of
          it is <strong>confidential</strong>.
        </p>
        <ul>
          <li>Use only the minimum data you need, and only for the reason it is in the portal.</li>
          <li>Keep it inside the portal. Do not move it to personal email, chat apps, notes or personal devices.</li>
          <li>Export an agent&apos;s data only when the agent asks for it or a master admin instructs you to, and delete your copy once it has been delivered.</li>
          <li>When you match a payment proof against the bank or UPI statement, do it on approved work devices only.</li>
          <li>Your duty of confidentiality continues after your access ends.</li>
        </ul>
        <p>
          Misusing this data can harm real people and may break India&apos;s Digital Personal Data Protection Act, 2023, which carries
          heavy penalties for the business.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments, refunds and plan changes",
    summary: "Money decisions need care: check every proof properly and record exactly what happened.",
    body: (
      <ul>
        <li>Mark a payment as checked only after you have matched the amount, date and transaction ID against the real UPI or bank statement.</li>
        <li>Never approve a payment you have not been able to confirm. When in doubt, add a note and leave it for a master admin.</li>
        <li>Record refunds only after the money has actually been sent back.</li>
        <li>Give, extend or change an agent&apos;s plan only for a recorded business reason, and say why in the notes.</li>
      </ul>
    ),
  },
  {
    id: "monitoring",
    title: "Monitoring and the audit log",
    summary: "Everything you do in the portal is recorded and may be reviewed.",
    body: (
      <>
        <p>
          Every sign-in and every action you take is saved in a permanent audit log with your email address, the time and your IP
          address. Master admins can review it at any time, for example to check a decision, investigate a complaint or look into a
          security issue. Entries cannot be edited or deleted by anyone.
        </p>
        <p>
          By using the portal, you understand and agree to this monitoring. The <Link href="/privacy#audit-log">Privacy Policy</Link>{" "}
          explains it in more detail.
        </p>
      </>
    ),
  },
  {
    id: "incidents",
    title: "Reporting problems and data breaches",
    summary: "If something goes wrong, tell a master admin at once. Don't try to hide or fix it on your own.",
    body: (
      <>
        <p>Report straight away to {contact} if you:</p>
        <ul>
          <li>made a mistake, such as approving the wrong payment or changing the wrong account;</li>
          <li>think data may have been seen by, or sent to, someone who should not have it;</li>
          <li>notice a bug that shows you data or actions you should not have access to;</li>
          <li>receive a suspicious message asking for portal access, codes or agent data.</li>
        </ul>
        <p>
          Quick reporting matters: the law may require us to inform affected people and the Data Protection Board quickly. You will
          not be penalised for honestly reporting a genuine mistake.
        </p>
      </>
    ),
  },
  {
    id: "ending-access",
    title: "Suspending and ending access",
    summary: "A master admin can turn off your access at any time. When you leave, your access ends and your duties of confidentiality continue.",
    body: (
      <ul>
        <li>A master admin may disable your account, change your permissions or sign you out at any time, for example when your role changes or to protect security. Changes apply immediately.</li>
        <li>When you stop working with us, your access is removed. You must delete any Vouchlio data you hold and return any devices or materials that contain it.</li>
        <li>Your past actions remain in the audit log.</li>
      </ul>
    ),
  },
  {
    id: "breaking-terms",
    title: "If these terms are broken",
    summary: "Breaking these rules can lead to losing access, disciplinary action and, in serious cases, legal action.",
    body: (
      <p>
        If you break these terms, we may suspend or remove your access straight away. Depending on how serious it is, we may also take
        action under your employment or service contract, and where the law has been broken (for example unauthorised access or
        data theft under the Information Technology Act, 2000), report it to the authorities or seek damages.
      </p>
    ),
  },
  {
    id: "ownership",
    title: "Ownership",
    summary: "The portal and all the data in it belong to the business, not to the admin who used it.",
    body: (
      <p>
        The portal&apos;s software, design, content and data belong to {LEGAL.entityName} or the agents who entrusted their data to us.
        Using the portal does not give you any right to copy, sell or reuse any of it. Notes and decisions you make in the portal are
        part of the business&apos;s records.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes to the portal",
    summary: "The portal may change or be briefly unavailable. If something looks wrong, stop and report it.",
    body: (
      <p>
        We work to keep the portal running and accurate, but it may sometimes be unavailable for maintenance, change without notice, or
        contain errors. If information looks wrong, do not act on it until it has been checked. To the extent the law allows, we are
        not responsible for losses caused by downtime or errors, and you are not personally responsible for genuine system errors you
        report promptly.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    summary: "We may update these terms. Continuing to use the portal means you accept the new version.",
    body: <p>When we change these terms, we update the date at the top and tell admins about important changes. If you keep using the portal after a change, you accept the updated terms.</p>,
  },
  {
    id: "law",
    title: "Governing law",
    summary: "Indian law applies, and the courts of our registered city decide any dispute.",
    body: (
      <p>
        These terms are governed by the laws of India. Any dispute will be handled by the courts at {LEGAL.jurisdictionCity}, unless
        your contract says otherwise.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    summary: "Ask a master admin if anything here is unclear.",
    body: (
      <p>
        {LEGAL.entityName}, {LEGAL.address}. If you are unsure whether something is allowed, ask before you act. Contact {contact}.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={
        <p>
          These are the rules for using {LEGAL.product}. They are written in plain language so they are easy to follow. The
          &quot;In short&quot; box at the start of each section gives the key point. If you are ever unsure whether something is allowed,
          ask a master admin before you do it.
        </p>
      }
      sections={sections}
    />
  );
}
