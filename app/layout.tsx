import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme-script";
import ThemedToaster from "@/components/ThemedToaster";
import CookieNotice from "@/components/legal/CookieNotice";
import { NavigationTracker } from "@/components/BackButton";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Vouchlio Admin", template: "%s · Vouchlio Admin" },
  robots: { index: false, follow: false },
  icons: { icon: "/brand/vouchlio-mark.png" },
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
