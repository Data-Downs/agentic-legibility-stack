import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agentic Legibility Stack — Legibility Studio",
  description:
    "Service designer authoring tool for defining how government services work for AI agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-studio-body`}>
        <Sidebar />
        <main className="ml-[var(--sidebar-width)] p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
