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
    <div className="my-3 relative" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.10)) drop-shadow(0 1px 2px rgba(0,0,0,0.06))" }}>
      <div className="bg-white px-5 py-4">
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
      {/* Zig-zag tear-off bottom edge */}
      <svg className="block w-full" height="8" preserveAspectRatio="none" viewBox="0 0 240 8" fill="white">
        <polygon points="0,0 5,8 10,0 15,8 20,0 25,8 30,0 35,8 40,0 45,8 50,0 55,8 60,0 65,8 70,0 75,8 80,0 85,8 90,0 95,8 100,0 105,8 110,0 115,8 120,0 125,8 130,0 135,8 140,0 145,8 150,0 155,8 160,0 165,8 170,0 175,8 180,0 185,8 190,0 195,8 200,0 205,8 210,0 215,8 220,0 225,8 230,0 235,8 240,0" />
      </svg>
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
