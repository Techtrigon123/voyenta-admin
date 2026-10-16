import "server-only";
import { db } from "@/lib/db";

/** Pending plan payments (awaiting a decision). */
export async function pendingPaymentCount(): Promise<number> {
  const { count } = await db().from("plan_payments").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}

/** Profiles waiting for this admin: masters see every open review, sub-admins only those to check. */
export async function openReviewCount(includeChecked: boolean): Promise<number> {
  const statuses = includeChecked ? ["pending", "checked", "changes_pending", "changes_checked"] : ["pending", "changes_pending"];
  const { count, error } = await db().from("users").select("id", { count: "exact", head: true }).in("verification_status", statuses);
  return error ? 0 : count ?? 0; // 0 until migration 0007 is run
}

