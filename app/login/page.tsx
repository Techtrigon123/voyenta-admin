"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { api } from "@/lib/client";
import { Field, Spinner, inputCls, primaryBtn } from "@/components/ui";

type Step = "password" | "2fa" | "setup";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // First sign-in: fetch a fresh 2-step secret and its QR code.
  useEffect(() => {
    if (step !== "setup") return;
    let live = true;
    void api<{ qr: string; secret: string }>("/api/auth/setup").then((r) => {
      if (!live) return;
      if (r.success && r.data) setSetup(r.data);
      else setError(r.error?.message ?? "Could not start 2-step setup.");
    });
    return () => {
      live = false;
    };
  }, [step]);

  const finish = (next: string) => router.replace(next === "password" ? "/account?first=1" : "/");

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await api<{ next: Step }>("/api/auth/login", { json: { email, password } });
    setBusy(false);
    if (!r.success || !r.data) return setError(r.error?.message ?? "Sign-in failed.");
    setPassword("");
    setStep(r.data.next);
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await api<{ next: string }>(step === "setup" ? "/api/auth/setup" : "/api/auth/verify", { json: { code } });
    setBusy(false);
    if (!r.success || !r.data) {
      if (r.error?.code === "UNAUTHENTICATED") {
        setStep("password");
        setCode("");
      }
      return setError(r.error?.message ?? "That code didn't work.");
    }
    finish(r.data.next);
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand-neon/10 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="rounded-xl bg-[#ffffff] px-2 py-1.5">
            <Image src="/voyenta-logo-mark.png" alt="" width={234} height={160} className="h-7 w-auto" priority />
          </span>
          <span className="text-lg font-bold">
            Voyenta <span className="text-brand-neon">Admin</span>
          </span>
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-neon">Control centre</p>
          <h1 className="mt-3 max-w-md text-4xl font-bold leading-tight">Run Voyenta with confidence.</h1>
          <p className="mt-4 max-w-md text-neutral-400">Review payments, support agents and keep every account healthy — with every action recorded.</p>
        </div>
        <ul className="relative space-y-3 text-sm text-neutral-300">
          {[
            { icon: ShieldCheck, text: "2-step verification on every admin account" },
            { icon: Lock, text: "Separate master and sub-admin access" },
            { icon: KeyRound, text: "Every admin action recorded in the audit log" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-brand-neon" /> {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="anim-rise w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="rounded-xl bg-[#ffffff] px-2 py-1.5 ring-1 ring-[var(--border)]">
              <Image src="/voyenta-logo-mark.png" alt="" width={234} height={160} className="h-6 w-auto" />
            </span>
            <span className="font-bold">
              Voyenta <span className="text-brand-600 dark:text-brand-neon">Admin</span>
            </span>
          </div>

          {step === "password" ? (
            <form onSubmit={submitPassword} className="space-y-4" noValidate>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Admin sign in</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">For Voyenta staff only. Agents sign in on the Voyenta app.</p>
              </div>
              <Field label="Email" htmlFor="email">
                <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Password" htmlFor="password">
                <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              </Field>
              {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p> : null}
              <button type="submit" disabled={busy || !email || !password} className={`${primaryBtn} w-full`}>
                {busy ? <Spinner /> : null} Continue
              </button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="space-y-4" noValidate>
              <div>
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <Smartphone className="h-5 w-5" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight">{step === "setup" ? "Set up 2-step verification" : "Enter your code"}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {step === "setup"
                    ? "Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then enter the 6-digit code it shows."
                    : "Open your authenticator app and enter the 6-digit code for Voyenta Admin."}
                </p>
              </div>
              {step === "setup" ? (
                setup ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={setup.qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-lg bg-white p-2" />
                    <p className="text-center text-xs text-[var(--muted-foreground)]">
                      Can&apos;t scan? Enter this key in the app:
                      <br />
                      <span className="font-mono text-sm font-semibold tracking-wider text-[var(--foreground)]">{setup.secret}</span>
                    </p>
                  </div>
                ) : (
                  <div className="skeleton mx-auto h-60 w-full rounded-2xl" />
                )
              ) : null}
              <Field label="6-digit code" htmlFor="code">
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                  className={`${inputCls} text-center font-mono text-lg tracking-[0.4em]`}
                  autoFocus
                />
              </Field>
              {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p> : null}
              <button type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6} className={`${primaryBtn} w-full`}>
                {busy ? <Spinner /> : null} {step === "setup" ? "Turn on and sign in" : "Verify"}
              </button>
              <button type="button" onClick={() => { setStep("password"); setCode(""); setError(""); }} className="w-full text-center text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                Use a different account
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
