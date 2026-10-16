import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LEGAL } from "@/lib/legal";
import LegalFooter from "@/components/legal/LegalFooter";

export interface LegalSection {
  id: string;
  title: string;
  /** One or two plain sentences: the section in a nutshell. */
  summary: string;
  body: React.ReactNode;
}

/** Shared layout for the admin Privacy Policy and Terms of Use. Public: works signed in or out. */
export default function LegalPage({ title, intro, sections }: { title: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-[var(--sidebar)]">
        <div className="h-[3px] bg-gradient-to-r from-ink via-brand-500 to-brand-neon" />
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="rounded-lg bg-[#ffffff] px-1.5 py-1">
              <Image src="/brand/vouchlio-mark.png" alt="Vouchlio" width={1024} height={1024} className="h-6 w-auto" />
            </span>
            <span className="font-bold text-white">
              Vouchlio <span className="text-brand-neon">Admin</span>
            </span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to the portal
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-neon">For Vouchlio staff</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Last updated: {LEGAL.lastUpdated}</p>
        <div className="mt-6 max-w-3xl space-y-3 text-[15px] leading-relaxed text-[var(--foreground)]/90">{intro}</div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">On this page</p>
            <ol className="space-y-1.5 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-[var(--muted-foreground)] hover:text-brand-600 dark:hover:text-brand-neon">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <h2 className="text-xl font-bold tracking-tight">
                  {i + 1}. {s.title}
                </h2>
                <p className="mt-3 rounded-xl border-l-4 border-brand-500 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-neon dark:bg-brand-950/60 dark:text-brand-100">
                  <strong>In short:</strong> {s.summary}
                </p>
                <div className="legal-body mt-4 space-y-3 text-[15px] leading-relaxed text-[var(--foreground)]/90">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
