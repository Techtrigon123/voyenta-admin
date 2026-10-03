"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Field, Spinner, inputCls, primaryBtn } from "@/components/ui";

export default function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (next !== again) return setError("The new passwords don't match.");
    setBusy(true);
    const r = await api("/api/account/password", { json: { current, next } });
    setBusy(false);
    if (!r.success) return setError(r.error?.message ?? "Could not update the password.");
    toast.success("Password updated.");
    setCurrent("");
    setNext("");
    setAgain("");
    if (forced) router.replace("/");
    else router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label={forced ? "Temporary password" : "Current password"} htmlFor="pw-current">
        <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
      </Field>
      <Field label="New password" htmlFor="pw-new" hint="At least 12 characters, with letters and a number.">
        <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
      </Field>
      <Field label="New password again" htmlFor="pw-again">
        <input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputCls} />
      </Field>
      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p> : null}
      <button type="submit" disabled={busy || !current || !next || !again} className={primaryBtn}>
        {busy ? <Spinner /> : null} Save password
      </button>
    </form>
  );
}
