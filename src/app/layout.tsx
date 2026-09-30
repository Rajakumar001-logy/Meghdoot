import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MonsoonProvider } from "@/context/MonsoonContext";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "MEGHDOOT AI — Predict the Monsoon. Protect the Harvest.",
  description:
    "MEGHDOOT AI — AI-Powered Hyperlocal Monsoon Intelligence & Agricultural Decision Support Platform for Block/Panchayat Onset, False Onset, Dry Spell, and Crop Advisories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen antialiased bg-[#F8FAFC] text-slate-800`}>
        <MonsoonProvider>
          <AppShell>{children}</AppShell>
        </MonsoonProvider>
      </body>
    </html>
  );
}
