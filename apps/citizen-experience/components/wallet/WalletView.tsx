"use client";

interface Credential {
  type: string;
  issuer: string;
  number?: string;
  status: string;
  expires?: string;
}

interface WalletViewProps {
  credentials: Credential[];
  userName: string;
}

const statusColors: Record<string, string> = {
  valid: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  revoked: "bg-gray-100 text-gray-800",
};

const credentialLabels: Record<string, string> = {
  "driving-licence": "Driving Licence",
  "national-insurance": "National Insurance",
  "proof-of-address": "Proof of Address",
  "age-verification": "Age Verification",
};

export default function WalletView({ credentials, userName }: WalletViewProps) {
  if (credentials.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-6 text-center">
        <div className="text-gray-400 text-2xl mb-2">No credentials</div>
        <p className="text-sm text-gray-500">
          {userName} has no digital credentials in their wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wide">
        Digital Wallet — {userName}
      </h3>
      {credentials.map((cred, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold">
                {credentialLabels[cred.type] || cred.type}
              </div>
              <div className="text-sm text-gray-500">Issued by {cred.issuer}</div>
              {cred.number && (
                <div className="text-xs text-gray-400 mt-1 font-mono">
                  {cred.number}
                </div>
              )}
            </div>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${statusColors[cred.status] || "bg-gray-100"}`}
            >
              {cred.status}
            </span>
          </div>
          {cred.expires && (
            <div className="text-xs text-gray-400 mt-2">
              Expires: {new Date(cred.expires).toLocaleDateString("en-GB")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
