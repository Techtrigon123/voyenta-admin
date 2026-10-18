/**
 * Who may do what. Masters have every permission. Sub-admins have only the permissions on their
 * account, and only from SUB_GRANTABLE — a master can never hand a sub-admin anything that moves
 * money, changes prices, deletes agents, changes an agent's email, manages admins, shows the audit
 * log or changes settings. The server checks these on every request (lib/auth/guard.ts).
 */

export type Role = "master" | "sub";

export const PERMISSIONS = {
  // Plan payments
  "payments.view": "View plan payments and proofs",
  "payments.check": "Mark payment proofs as checked",
  "payments.decide": "Approve or reject plan payments",
  "payments.refund": "Issue refunds (online payments through Razorpay) and record UPI refunds",
  // Agents
  "agents.view": "Search and view agent profiles",
  "agents.verify": "Review agent profiles and mark them checked",
  "agents.approve": "Verify or deny agent profiles",
  "agents.notes": "Add internal notes on agents",
  "agents.reset_link": "Create password-reset links for agents",
  "agents.unlock": "Unlock rate-limited agent accounts",
  "agents.suspend": "Suspend or reactivate agents",
  "agents.features": "Turn services on or off per agent",
  "agents.plan": "Give, extend or change an agent's plan",
  "agents.email": "Change an agent's email",
  "agents.delete": "Delete agent accounts",
  "agents.export": "Export an agent's data",
  // Support
  "support.reply": "Handle support tickets, bug reports and callbacks",
  "contact.manage": "Read and handle contact-form messages",
  // Reports
  "reports.activity": "See activity and usage reports",
  "reports.revenue": "See revenue and plan reports",
  // Owner-only areas
  "admins.manage": "Create and manage sub-admins",
  "audit.view": "See the audit log",
  "settings.manage": "Change site, payment and AI settings",
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** What a new sub-admin gets: day-to-day support and operations work. */
export const SUB_DEFAULT: Permission[] = [
  "payments.view",
  "payments.check",
  "agents.view",
  "agents.verify",
  "agents.approve",
  "agents.notes",
  "agents.reset_link",
  "support.reply",
  "contact.manage",
  "reports.activity",
];

/** Everything a master is allowed to give a sub-admin: the defaults plus unlocking accounts. */
export const SUB_GRANTABLE: Permission[] = [...SUB_DEFAULT, "agents.unlock"];

export interface AdminIdentity {
  role: Role;
  permissions: readonly string[];
}

export function can(admin: AdminIdentity | null | undefined, permission: Permission): boolean {
  if (!admin) return false;
  if (admin.role === "master") return true;
  return SUB_GRANTABLE.includes(permission) && admin.permissions.includes(permission);
}

/** Keep only permissions a sub-admin may hold (drops anything master-only or unknown). */
export function cleanSubPermissions(list: unknown): Permission[] {
  if (!Array.isArray(list)) return [];
  return SUB_GRANTABLE.filter((p) => list.includes(p));
}
