import type { Metadata } from "next";
import "./globals.css";
import { MonsoonProvider } from "@/context/MonsoonContext";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "MonsoonPulse AI — Predict the Monsoon. Protect the Harvest.",
  description:
    "AI-Powered Hyperlocal Monsoon Intelligence & Agricultural Decision Support Platform for Block/Panchayat Onset, False Onset, Dry Spell, and Crop Advisories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <MonsoonProvider>
          <AppShell>{children}</AppShell>
        </MonsoonProvider>
      </body>
    </html>
  );
}
