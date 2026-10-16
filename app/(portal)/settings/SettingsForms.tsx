"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Card, CardTitle, Field, Spinner, inputCls, primaryBtn } from "@/components/ui";
import type { Settings } from "@/lib/settings";

export default function SettingsForms({ initial, razorpayReady }: { initial: Settings; razorpayReady: boolean }) {
  const router = useRouter();
  const [payments, setPayments] = useState(initial.payments);
  const [pricing, setPricing] = useState(initial.pricing);
  const [ai, setAi] = useState(initial.ai);
  const [support, setSupport] = useState(initial.support);
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (key: keyof Settings, value: unknown) => {
    setBusy(key);
    const r = await api("/api/settings", { json: { key, value } });
    setBusy(null);
    if (!r.success) return toast.error(r.error?.message ?? "Could not save.");
    toast.success(r.message ?? "Saved.");
    router.refresh();
  };

  const num = (s: string) => (s === "" ? 0 : Number(s));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>Payments</CardTitle>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">Choose how agents can pay for Gold and Platinum. Online payments activate the plan instantly; UPI proofs wait for your team to check them.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("payments", payments);
          }}
          className="space-y-3"
        >
          <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3 text-sm">
            <input type="checkbox" checked={payments.onlineEnabled} onChange={(e) => setPayments({ ...payments, onlineEnabled: e.target.checked })} className="mt-0.5" />
            <span>
              <span className="font-medium">Online payments (Razorpay)</span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                UPI, cards, net banking and wallets.{" "}
                {razorpayReady ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Razorpay keys are set on this portal.</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Razorpay keys aren&apos;t set on this portal yet, so refunds and lookups won&apos;t work. Agents see online checkout only once the keys are set in the Vouchlio app too.</span>
                )}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3 text-sm">
            <input type="checkbox" checked={payments.manualUpi} onChange={(e) => setPayments({ ...payments, manualUpi: e.target.checked })} className="mt-0.5" />
            <span>
              <span className="font-medium">UPI with payment proof</span>
              <span className="block text-xs text-[var(--muted-foreground)]">Agents scan your UPI QR and upload a screenshot for review. Uses the UPI ID below.</span>
            </span>
          </label>
          <Field label="UPI ID" htmlFor="upi">
            <input id="upi" value={payments.upiId} onChange={(e) => setPayments({ ...payments, upiId: e.target.value })} placeholder="yourbusiness@bank" className={inputCls} />
          </Field>
          <Field label="Payee name" htmlFor="payee">
            <input id="payee" value={payments.payeeName} onChange={(e) => setPayments({ ...payments, payeeName: e.target.value })} placeholder="Vouchlio" maxLength={80} className={inputCls} />
          </Field>
          <button type="submit" disabled={busy === "payments"} className={primaryBtn}>{busy === "payments" ? <Spinner /> : null} Save payment details</button>
        </form>
      </Card>

      <Card>
        <CardTitle>Plan prices (₹, GST inclusive)</CardTitle>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">Used at checkout and on the pricing pages. Agents who already paid keep their price until they renew.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("pricing", pricing);
          }}
          className="space-y-3"
        >
          {(["gold", "platinum"] as const).map((plan) => (
            <div key={plan} className="grid grid-cols-2 gap-3">
              {(["monthly", "yearly"] as const).map((cycle) => (
                <Field key={cycle} label={`${plan === "gold" ? "Gold" : "Platinum"} · ${cycle}`} htmlFor={`${plan}-${cycle}`}>
                  <input
                    id={`${plan}-${cycle}`}
                    type="number"
                    min={1}
                    step={1}
                    value={pricing[plan][cycle]}
                    onChange={(e) => setPricing({ ...pricing, [plan]: { ...pricing[plan], [cycle]: num(e.target.value) } })}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>
          ))}
          <button type="submit" disabled={busy === "pricing"} className={primaryBtn}>{busy === "pricing" ? <Spinner /> : null} Save prices</button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle>AI upload auto-fill</CardTitle>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">Caps on what upload auto-fill may spend. When a cap is reached, auto-fill pauses until the next day or month; agents can still fill forms by hand.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("ai", ai);
          }}
          className="space-y-4"
        >
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-sm">
            <input type="checkbox" checked={ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} />
            <span>
              <strong>Upload auto-fill is {ai.enabled ? "on" : "off"}</strong>
              <span className="block text-xs text-[var(--muted-foreground)]">Untick to switch it off for every agent immediately.</span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Daily budget (USD)" htmlFor="ai-day">
              <input id="ai-day" type="number" min={0} step="0.5" value={ai.dailyBudgetUsd} onChange={(e) => setAi({ ...ai, dailyBudgetUsd: num(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Monthly budget (USD)" htmlFor="ai-month">
              <input id="ai-month" type="number" min={0} step="1" value={ai.monthlyBudgetUsd} onChange={(e) => setAi({ ...ai, monthlyBudgetUsd: num(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Per agent, per day" htmlFor="ai-user">
              <input id="ai-user" type="number" min={0} step="1" value={ai.userDailyCalls} onChange={(e) => setAi({ ...ai, userDailyCalls: num(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="All Silver agents, per day" htmlFor="ai-free">
              <input id="ai-free" type="number" min={0} step="1" value={ai.freePoolDailyCalls} onChange={(e) => setAi({ ...ai, freePoolDailyCalls: num(e.target.value) })} className={inputCls} />
            </Field>
          </div>
          <button type="submit" disabled={busy === "ai"} className={primaryBtn}>{busy === "ai" ? <Spinner /> : null} Save AI limits</button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle>Support options</CardTitle>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">What agents see in the Support menu. Switching an option off hides it and stops new requests at once; existing tickets and callbacks stay in your queues.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("support", support);
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["tickets", "Support tickets", "Written requests with a reply thread"],
                ["bugReports", "Bug reports", "Screenshot + marked issue, opened as a ticket"],
                ["callbacks", "Callback requests", "Agents book a call at a preferred time"],
              ] as const
            ).map(([k, label, hint]) => (
              <label key={k} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-sm">
                <input type="checkbox" checked={support[k]} onChange={(e) => setSupport({ ...support, [k]: e.target.checked })} />
                <span>
                  <strong>{label} — {support[k] ? "on" : "off"}</strong>
                  <span className="block text-xs text-[var(--muted-foreground)]">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          <Field label="Callback hours (shown to agents)" htmlFor="cb-hours">
            <input id="cb-hours" value={support.callbackHours} onChange={(e) => setSupport({ ...support, callbackHours: e.target.value })} maxLength={80} placeholder="Mon–Sat, 10 am – 7 pm IST" className={inputCls} />
          </Field>
          <button type="submit" disabled={busy === "support"} className={primaryBtn}>{busy === "support" ? <Spinner /> : null} Save support options</button>
        </form>
      </Card>
    </div>
  );
}
