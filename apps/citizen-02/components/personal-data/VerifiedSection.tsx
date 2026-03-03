"use client";

import { useState } from "react";

interface VerifiedData {
  fullName?: string;
  dateOfBirth?: string;
  nationalInsuranceNumber?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
  };
  drivingLicenceNumber?: string;
  verificationLevel: string;
  source: string;
  verifiedAt?: string;
}

export function VerifiedSection({ data }: { data: VerifiedData }) {
  const [showNi, setShowNi] = useState(false);
  const [showLicence, setShowLicence] = useState(false);

  const maskValue = (value: string | undefined, showChars = 4) => {
    if (!value) return "---";
    if (value.length <= showChars) return value;
    return "****" + value.slice(-showChars);
  };

  const fields: Array<{ label: string; value: string; sensitive?: boolean; shown?: boolean; toggle?: () => void }> = [];

  if (data.fullName) {
    fields.push({ label: "Full name", value: data.fullName });
  }
  if (data.dateOfBirth) {
    fields.push({ label: "Date of birth", value: data.dateOfBirth });
  }
  if (data.nationalInsuranceNumber) {
    fields.push({
      label: "NI number",
      value: showNi ? data.nationalInsuranceNumber : maskValue(data.nationalInsuranceNumber),
      sensitive: true,
      shown: showNi,
      toggle: () => setShowNi(!showNi),
    });
  }
  if (data.address) {
    const parts = [data.address.line1, data.address.line2, data.address.city, data.address.postcode].filter(Boolean);
    fields.push({ label: "Address", value: parts.join(", ") });
  }
  if (data.drivingLicenceNumber) {
    fields.push({
      label: "Driving licence",
      value: showLicence ? data.drivingLicenceNumber : maskValue(data.drivingLicenceNumber, 6),
      sensitive: true,
      shown: showLicence,
      toggle: () => setShowLicence(!showLicence),
    });
  }

  const levelColors: Record<string, string> = {
    high: "bg-govuk-green text-white",
    medium: "bg-yellow-500 text-white",
    low: "bg-orange-500 text-white",
    none: "bg-govuk-mid-grey text-white",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00703c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h3 className="font-bold text-sm">Verified credentials</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${levelColors[data.verificationLevel] || levelColors.none}`}>
          {data.verificationLevel}
        </span>
      </div>

      {data.source !== "none" && (
        <p className="text-xs text-govuk-dark-grey mb-3">
          Source: {data.source} {data.verifiedAt && `(verified ${new Date(data.verifiedAt).toLocaleDateString()})`}
        </p>
      )}

      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-govuk-dark-grey">{f.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">{f.value}</span>
              {f.sensitive && (
                <button
                  onClick={f.toggle}
                  className="text-xs text-govuk-blue underline"
                >
                  {f.shown ? "Hide" : "Show"}
                </button>
              )}
            </div>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-sm text-govuk-dark-grey italic">No verified credentials found.</p>
        )}
      </div>
    </div>
  );
}
