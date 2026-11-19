import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/layout/ThemeToggle";

export const metadata: Metadata = {
  title: {
    default: "LOOKBAN - Local finds, Lucban pride.",
    template: "%s | LOOKBAN",
  },
  description:
    "Shop pasalubong from many local Lucban, Quezon stores in one place. Compare longganisa, miki, biscuits and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
