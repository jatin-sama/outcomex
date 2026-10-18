import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OutcomeX — Autonomous CO-PO Attainment Automation",
  description:
    "Production-grade outcome-based education (OBE) platform automating Course Outcome, Program Outcome, and PSO attainment with exact Excel template reproduction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
