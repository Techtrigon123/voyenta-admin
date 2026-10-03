import { randomBytes } from "crypto";

/** Admin password rules: long enough to resist guessing, and not just the email. */
export function passwordProblem(pw: string, email: string): string | null {
  if (pw !== pw.trim()) return "Don’t start or end the password with a space.";
  if (pw.length < 12) return "Use at least 12 characters.";
  if (pw.length > 72) return "Use 72 characters or fewer.";
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number.";
  if (pw.toLowerCase().includes(email.split("@")[0].toLowerCase())) return "Don't include your email name in the password.";
  return null;
}

/** A readable temporary password, shown once to the master; the admin must change it at first sign-in. */
export function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`;
}
