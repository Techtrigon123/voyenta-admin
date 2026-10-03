import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { primaryBtn } from "@/components/ui";

export const metadata = { title: "No access" };

export default function DeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
        <ShieldOff className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">You don&apos;t have access to this</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--muted-foreground)]">This area is for master admins, or needs a permission your account doesn&apos;t have. Ask the account owner if you need it.</p>
      <Link href="/" className={`${primaryBtn} mt-6`}>
        Back to overview
      </Link>
    </div>
  );
}
