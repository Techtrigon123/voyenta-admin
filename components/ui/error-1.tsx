"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Compass } from "lucide-react";
import { primaryBtn, secondaryBtn } from "@/components/ui";

/**
 * Full-screen 404 block — the same "error-1" design as the Vouchlio app (checkin-app/components/ui/error-1.tsx),
 * using the portal's own button styles. "Go Home" opens the portal dashboard.
 */
export default function ErrorBlock() {
  const router = useRouter();

  // Go back when there's an earlier page in this tab; otherwise (opened from a link) go home.
  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <section className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-[var(--background)] px-6 py-12 text-center text-[var(--foreground)]">
      <p className="font-mono text-7xl font-bold tracking-tighter sm:text-8xl">404</p>

      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h1>
        <p className="max-w-md text-sm text-[var(--muted-foreground)]">
          The page you are looking for does not exist or has been moved. Check the URL, or head back to safety.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
        <Link href="/" className={`${primaryBtn} h-11 w-full px-6 sm:w-auto`}>
          <Compass className="h-4 w-4" aria-hidden="true" />
          Go Home
        </Link>
        <button type="button" onClick={back} className={`${secondaryBtn} h-11 w-full px-6 sm:w-auto`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Go Back
        </button>
      </div>
    </section>
  );
}
