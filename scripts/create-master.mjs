// Create a master admin, or recover one. Run from the voyenta-admin folder:
//
//   npm run create-master -- you@example.com "Your Name"     create a master admin
//   npm run create-master -- --reset you@example.com         new temporary password + 2-step reset
//
// Prints a temporary password ONCE. Sign in at /login, set up 2-step verification, then choose
// your own password. Master admins can only be created here — never from the portal.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    console.error("No .env.local found. Copy .env.example to .env.local and fill it in first.");
    process.exit(1);
  }
  return env;
}

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const out = [...randomBytes(16)].map((b) => alphabet[b % alphabet.length]).join("");
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`;
}

const args = process.argv.slice(2);
const reset = args[0] === "--reset";
const email = String(reset ? args[1] : args[0] ?? "").trim().toLowerCase();
const name = String(args[1] ?? "").trim();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!reset && !name)) {
  console.error('Usage:\n  npm run create-master -- you@example.com "Your Name"\n  npm run create-master -- --reset you@example.com');
  process.exit(1);
}

const env = loadEnv();
const url = (env.SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const password = temporaryPassword();
const hash = await bcrypt.hash(password, 12);

const { data: existing, error: findError } = await db.from("admins").select("id,role,session_version").eq("email", email).maybeSingle();
if (findError) {
  console.error(`Could not read the admins table: ${findError.message}\nHas migration 0006_admin_portal.sql been run in Supabase?`);
  process.exit(1);
}

if (reset) {
  if (!existing || existing.role !== "master") {
    console.error(`No master admin with the email ${email}.`);
    process.exit(1);
  }
  const { error } = await db
    .from("admins")
    .update({ password_hash: hash, must_change_password: true, totp_secret: null, totp_enabled: false, totp_last_step: 0, disabled: false, session_version: existing.session_version + 1 })
    .eq("id", existing.id);
  if (error) throw error;
  await db.from("admin_audit_log").insert({ admin_id: existing.id, admin_email: email, action: "admin.recovery", target_type: "admin", target_id: existing.id, details: { via: "create-master script" } });
  console.log(`\nMaster admin ${email} reset. Password and 2-step verification have been cleared.`);
} else {
  if (existing) {
    console.error(`An admin with the email ${email} already exists. Use --reset to recover it.`);
    process.exit(1);
  }
  const { data, error } = await db
    .from("admins")
    .insert({ email, name, role: "master", permissions: [], password_hash: hash, must_change_password: true })
    .select("id")
    .single();
  if (error) throw error;
  await db.from("admin_audit_log").insert({ admin_id: data.id, admin_email: email, action: "admin.create", target_type: "admin", target_id: data.id, details: { role: "master", via: "create-master script" } });
  console.log(`\nMaster admin created for ${email}.`);
}

console.log(`\n  Temporary password:  ${password}\n`);
console.log("Sign in at the admin portal's /login page. You'll set up 2-step verification and choose your own password.");
console.log("This password is shown only once — it isn't stored anywhere in readable form.\n");
