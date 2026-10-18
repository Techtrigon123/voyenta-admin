/**
 * Details shown on the admin Privacy Policy and Terms of Use (app/privacy, app/terms).
 *
 * ⚠️ Replace every value marked TODO before the portal is used by staff. Keep these in step with
 * checkin-app/lib/site.ts, which holds the same details for the public site.
 */
export const LEGAL = {
  product: "Vouchlio Admin",
  /** Business name shown in the legal pages. */
  entityName: "Vouchlio",
  /** Registered office address. */
  address: "Bengaluru, Karnataka – 560100",
  /** City whose courts have jurisdiction over disputes. */
  jurisdictionCity: "Bengaluru, Karnataka",
  /** Monitored inbox for privacy questions and security reports. */
  contactEmail: "support@vouchlio.com",
  /** Grievance and Data Protection Officer (IT Rules 2011 / DPDP Act 2023). */
  grievanceOfficer: "Shiny Johnson",
  /** The public Vouchlio site. */
  siteUrl: "https://vouchlio.com",
  /** Date shown as "Last updated" on both pages. */
  lastUpdated: "18 October 2026",
} as const;
