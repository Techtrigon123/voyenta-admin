import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme-script";
import ThemedToaster from "@/components/ThemedToaster";
import CookieNotice from "@/components/legal/CookieNotice";
import { NavigationTracker } from "@/components/BackButton";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const description = "The Vouchlio team portal: profile reviews, plan payments, renewals, agents and support. Staff sign-in only.";

export const metadata: Metadata = {
  // Absolute URLs for the link-preview image (set ADMIN_APP_URL on Vercel if the domain changes).
  metadataBase: new URL(process.env.ADMIN_APP_URL || "https://admin.vouchlio.com"),
  title: { default: "Vouchlio Admin", template: "%s · Vouchlio Admin" },
  description,
  robots: { index: false, follow: false },
  icons: { icon: "/brand/vouchlio-mark.png" },
  openGraph: { type: "website", locale: "en_IN", siteName: "Vouchlio Admin", title: "Vouchlio Admin", description },
  twitter: { card: "summary_large_image", title: "Vouchlio Admin", description },
};

export const viewport: Viewport = { themeColor: "#0a0a0a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable} suppressHydrationWarning>
      <head>
        <Script id="theme" strategy="beforeInteractive">{THEME_SCRIPT}</Script>
      </head>
      <body className="min-h-screen">
        <NavigationTracker />
        {children}
        <ThemedToaster />
        <CookieNotice />
      </body>
    </html>
  );
}
