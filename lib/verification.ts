import { createHash } from "crypto";

/**
 * Agent profile review. Field keys and hashing MUST match the Voyenta app
 * (checkin-app/lib/agent/verification.ts + verification-shared.ts) so both sides agree on what changed.
 */

export type VerificationStatus = "not_submitted" | "pending" | "checked" | "approved" | "changes_pending" | "changes_checked" | "denied";

/** camelCase key (as hashed by the app) → database column and label. */
export const REVIEW_FIELDS = {
  name: { column: "name", label: "Contact name" },
  companyName: { column: "company_name", label: "Company name" },
  brandName: { column: "brand_name", label: "Brand name" },
  brandLogo: { column: "brand_logo", label: "Brand logo" },
  companyStamp: { column: "company_stamp", label: "Company stamp" },
  gstNumber: { column: "gst_number", label: "GSTIN" },
  iataNumber: { column: "iata_number", label: "IATA number" },
  address: { column: "address", label: "Address" },
  city: { column: "city", label: "City" },
  state: { column: "state", label: "State" },
  pincode: { column: "pincode", label: "PIN code" },
  mobile: { column: "mobile", label: "Mobile number" },
  landlineNumber: { column: "landline_number", label: "Landline" },
  bankAccountHolder: { column: "bank_account_holder", label: "Bank account holder" },
  bankName: { column: "bank_name", label: "Bank name" },
  bankAccountNumber: { column: "bank_account_number", label: "Bank account number" },
  bankIfscCode: { column: "bank_ifsc_code", label: "IFSC code" },
  bankBranchAddress: { column: "bank_branch_address", label: "Bank branch" },
  paymentUpi: { column: "payment_upi", label: "UPI ID" },
  partnerType: { column: "partner_type", label: "Business type" },
  partnerTypeOther: { column: "partner_type_other", label: "Business type (other)" },
} as const;

export type ReviewField = keyof typeof REVIEW_FIELDS;
export const REVIEW_KEYS = Object.keys(REVIEW_FIELDS) as ReviewField[];
export const REVIEW_COLUMNS = REVIEW_KEYS.map((k) => REVIEW_FIELDS[k].column).join(",");

export function fingerprint(row: Record<string, unknown>): Record<ReviewField, string> {
  const out = {} as Record<ReviewField, string>;
  for (const k of REVIEW_KEYS) {
    const v = String(row[REVIEW_FIELDS[k].column] ?? "").trim();
    out[k] = createHash("sha256").update(v).digest("hex").slice(0, 16);
  }
  return out;
}

/** One token for "these exact details", so an approval can't apply to details the reviewer never saw. */
export function fingerprintToken(fp: Record<string, string>): string {
  return createHash("sha256").update(REVIEW_KEYS.map((k) => fp[k] ?? "").join("|")).digest("hex").slice(0, 24);
}

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  not_submitted: "Not submitted",
  pending: "To check",
  checked: "Checked — awaiting approval",
  approved: "Approved",
  changes_pending: "Changes to check",
  changes_checked: "Changes checked — awaiting approval",
  denied: "Denied",
};

export const OPEN_STATUSES: VerificationStatus[] = ["pending", "checked", "changes_pending", "changes_checked"];
