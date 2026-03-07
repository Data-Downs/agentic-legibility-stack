import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppLayout } from "@/components/layout/AppLayout";
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
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
