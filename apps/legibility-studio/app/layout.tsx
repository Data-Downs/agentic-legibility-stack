import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic Legibility Stack — Legibility Studio",
  description:
    "Service designer authoring tool for defining how government services work for AI agents.",
};

function StudioHeader() {
  return (
    <header className="bg-govuk-dark-blue" role="banner">
      <div className="max-w-[1200px] mx-auto px-4 py-2 flex items-center justify-between">
        <a
          href="/"
          className="text-govuk-white font-bold text-lg no-underline hover:no-underline focus:text-govuk-black"
        >
          <span className="font-govuk">Legibility Studio</span>
        </a>
        <span className="text-govuk-white text-sm opacity-80">
          Service Designer Tool
        </span>
      </div>
    </header>
  );
}

function PhaseBanner() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-3">
      <div className="flex items-center gap-2 text-sm border-b border-govuk-mid-grey pb-3">
        <strong className="bg-govuk-blue text-govuk-white px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
          Prototype
        </strong>
        <span className="text-govuk-dark-grey">
          This is a reference implementation — not a live government tool.
        </span>
      </div>
    </div>
  );
}

function StudioFooter() {
  return (
    <footer className="bg-govuk-light-grey border-t border-govuk-mid-grey mt-12">
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <p className="text-govuk-dark-grey text-sm">
          Agentic Legibility Stack — Legibility Studio
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <StudioHeader />
        <PhaseBanner />
        <main className="flex-1 max-w-[1200px] mx-auto px-4 py-6 w-full">
          {children}
        </main>
        <StudioFooter />
      </body>
    </html>
  );
}
