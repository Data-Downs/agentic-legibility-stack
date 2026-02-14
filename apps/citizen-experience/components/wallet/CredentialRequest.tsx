"use client";

interface CredentialRequestProps {
  credentialType: string;
  purpose: string;
  dataRequested: string[];
  onGrant: () => void;
  onDeny: () => void;
}

const credentialLabels: Record<string, string> = {
  "driving-licence": "Driving Licence",
  "national-insurance": "National Insurance Number",
  "proof-of-address": "Proof of Address",
  "age-verification": "Age Verification",
};

export default function CredentialRequest({
  credentialType,
  purpose,
  dataRequested,
  onGrant,
  onDeny,
}: CredentialRequestProps) {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
      <h4 className="font-bold text-sm mb-2">Credential Request</h4>
      <p className="text-sm text-gray-700 mb-3">
        A service is requesting your{" "}
        <strong>{credentialLabels[credentialType] || credentialType}</strong>.
      </p>

      <div className="bg-white p-3 rounded border border-gray-200 mb-3">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Purpose
        </div>
        <div className="text-sm">{purpose}</div>
      </div>

      <div className="bg-white p-3 rounded border border-gray-200 mb-4">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Data that will be shared
        </div>
        <ul className="text-sm space-y-1">
          {dataRequested.map((field) => (
            <li key={field} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
              {field.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onGrant}
          className="bg-govuk-green text-white px-4 py-2 rounded font-bold text-sm hover:opacity-90"
        >
          Share credential
        </button>
        <button
          onClick={onDeny}
          className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
