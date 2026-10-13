import Link from "next/link";
import { cn } from "@/lib/utils";
import { LEGAL } from "@/lib/legal";

/** Small footer with the legal links, used on the login page, inside the portal and on the legal pages. */
export default function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-[var(--border)]", className)}>
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-[var(--muted-foreground)] sm:flex-row sm:px-6">
        <p>
          © {new Date().getFullYear()} {LEGAL.entityName}. For authorised staff only.
        </p>
        <nav aria-label="Legal" className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-brand-600 hover:underline dark:hover:text-brand-neon">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-brand-600 hover:underline dark:hover:text-brand-neon">
            Terms of Use
          </Link>
          <Link href="/cookies" className="hover:text-brand-600 hover:underline dark:hover:text-brand-neon">
            Cookie Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
