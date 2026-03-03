"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

interface TaskReceiptCardProps {
  content: string;
  timestamp?: string;
}

export function TaskReceiptCard({ content, timestamp }: TaskReceiptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const personaData = useAppStore((s) => s.personaData);

  const displayTime = timestamp ?? new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const pc = personaData?.primaryContact;
  const addr = personaData?.address;

  return (
    <div
      className="my-3 rounded-2xl bg-white shadow-sm"
      style={{ borderLeft: "4px solid #00703c" }}
    >
      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00703c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-sm font-bold text-green-800">
            Choices submitted
          </span>
          <span className="text-xs text-govuk-dark-grey ml-auto">
            {displayTime}
          </span>
        </div>

        {/* Submission content */}
        <div className="text-sm text-govuk-black whitespace-pre-line leading-relaxed">
          {content}
        </div>

        {/* Expandable personal data section */}
        {personaData && (
          <div className="mt-3 border-t border-gray-200 pt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-govuk-dark-grey hover:text-govuk-black transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${expanded ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              What personal data was shared?
            </button>

            {expanded && (
              <div className="mt-2 bg-white rounded-lg border border-gray-200 p-3 space-y-1.5">
                {pc && (
                  <>
                    <DataRow label="Name" value={`${pc.firstName} ${pc.lastName}`} />
                    <DataRow label="Date of birth" value={pc.dateOfBirth} />
                    {pc.nationalInsuranceNumber && (
                      <DataRow label="NI number" value={pc.nationalInsuranceNumber} />
                    )}
                  </>
                )}
                {addr && (
                  <DataRow
                    label="Address"
                    value={[addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(", ")}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-govuk-dark-grey w-24 shrink-0">{label}</span>
      <span className="text-govuk-black font-medium">{value}</span>
    </div>
  );
}
