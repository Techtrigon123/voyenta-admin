import "server-only";
import { db, hasColumn } from "@/lib/db";

/** Agent columns the portal shows. Never selects password hashes, reset tokens or document contents. */
export const AGENT_LIST_COLUMNS =
  "id,name,email,company_name,brand_name,mobile,city,state,status,is_verified,partner_type,subscription_plan,subscription_expires_at,created_at";

export const AGENT_DETAIL_COLUMNS =
  AGENT_LIST_COLUMNS +
  ",organization,partner_type_other,address,country,pincode,gst_number,iata_number,landline_number,agent_level,air_ticketing_enabled,travel_service_voucher_enabled,welcome_placard_enabled,updated_at";

/** Adds subscription_cycle (migration 0005) and verification_status (0007) once they exist. */
export async function withCycle(columns: string): Promise<string> {
  const [cycle, review] = await Promise.all([hasColumn("users", "subscription_cycle"), hasColumn("users", "verification_status")]);
  return [columns, cycle ? "subscription_cycle" : "", review ? "verification_status" : ""].filter(Boolean).join(",");
}

export interface AgentRow {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  brand_name: string | null;
  mobile: string | null;
  city: string | null;
  state: string | null;
  status: "INACTIVE" | "ACTIVE" | "SUSPENDED";
  is_verified: boolean;
  partner_type: string | null;
  subscription_plan: string;
  subscription_expires_at: string | null;
  subscription_cycle?: string | null;
  created_at: string;
}

export interface AgentDetail extends AgentRow {
  organization: string | null;
  partner_type_other: string | null;
  address: string | null;
  country: string | null;
  pincode: string | null;
  gst_number: string | null;
  iata_number: string | null;
  landline_number: string | null;
  agent_level: string | null;
  air_ticketing_enabled: boolean;
  travel_service_voucher_enabled: boolean;
  welcome_placard_enabled: boolean;
  updated_at: string;
}

export async function getAgent(id: string): Promise<AgentDetail | null> {
  const { data } = await db().from("users").select(await withCycle(AGENT_DETAIL_COLUMNS)).eq("id", id).maybeSingle();
  return (data as unknown as AgentDetail | null) ?? null;
}

export async function agentNames(ids: string[]): Promise<Map<string, { name: string; email: string; company: string | null }>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map();
  const { data } = await db().from("users").select("id,name,email,company_name").in("id", unique);
  return new Map(((data ?? []) as { id: string; name: string; email: string; company_name: string | null }[]).map((u) => [u.id, { name: u.name, email: u.email, company: u.company_name }]));
}

export const PARTNER_LABELS: Record<string, string> = {
  travel_agent: "Travel agent",
  tour_operator: "Tour operator",
  dmc: "DMC",
  hotel: "Hotel",
  other: "Other",
};
