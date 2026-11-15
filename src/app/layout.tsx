import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
