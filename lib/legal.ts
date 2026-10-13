/**
 * Details shown on the admin Privacy Policy and Terms of Use (app/privacy, app/terms).
 *
 * ⚠️ Replace every value marked TODO before the portal is used by staff. Keep these in step with
 * checkin-app/lib/site.ts, which holds the same details for the public site.
 */
export const LEGAL = {
  product: "Vouchlio Admin",
  /** TODO: registered legal name of the business (e.g. "Techtrigon Solutions Pvt Ltd"). */
  entityName: "Vouchlio",
  /** TODO: registered office address. */
  address: "Registered office address to be updated",
  /** TODO: city whose courts have jurisdiction over disputes. */
  jurisdictionCity: "Mumbai, Maharashtra",
  /** TODO: a monitored email address for privacy questions and security reports. */
  contactEmail: "",
  /** Date shown as "Last updated" on both pages. */
  lastUpdated: "5 October 2026",
} as const;
