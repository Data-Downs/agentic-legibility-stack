"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function DisclaimerBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="bg-govuk-yellow text-govuk-black text-sm relative z-40">
      <div className="max-w-[1200px] mx-auto px-4 py-3 pr-12">
        <p className="font-bold">This is not a government service.</p>
        <p className="mt-0.5">
          This is a private research project and simulator built by Chris Downs. It is
          not affiliated with, endorsed by, or connected to the UK Government, GOV.UK,
          or any government department. All data shown is simulated. For enquiries,
          contact{" "}
          <a
            href="mailto:chris@datadowns.com"
            className="underline font-medium"
          >
            chris@datadowns.com
          </a>.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="absolute top-3 right-3 p-1 text-govuk-black hover:opacity-70 transition-opacity"
        aria-label="Dismiss disclaimer"
      >
        <X size={18} />
      </button>
    </div>
  );
}
