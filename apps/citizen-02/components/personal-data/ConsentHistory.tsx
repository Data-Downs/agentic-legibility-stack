"use client";

interface ConsentRecord {
  id: string;
  grantId: string;
  serviceId: string;
  granted: boolean;
  dataFields: string[];
  purpose: string;
  timestamp: string;
  revokedAt?: string;
}

interface ConsentHistoryProps {
  records: ConsentRecord[];
  onRevoke?: (consentId: string) => void;
}

export default function ConsentHistory({ records, onRevoke }: ConsentHistoryProps) {
  if (records.length === 0) {
    return (
      <div className="text-center text-gray-400 py-6">
        No consent decisions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wide">
        Consent History
      </h3>
      {records.map((record) => (
        <div
          key={record.id}
          className={`border rounded p-3 ${
            record.revokedAt
              ? "border-gray-200 bg-gray-50 opacity-60"
              : record.granted
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="font-medium text-sm">{record.serviceId}</span>
              <span className="text-xs text-gray-500 ml-2">
                {record.granted ? "Allowed" : "Denied"}
                {record.revokedAt && " (Revoked)"}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(record.timestamp).toLocaleDateString("en-GB")}
            </span>
          </div>
          <div className="text-xs text-gray-600 mt-1">{record.purpose}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {record.dataFields.map((field) => (
              <span
                key={field}
                className="text-xs bg-white border border-gray-300 px-1.5 py-0.5 rounded"
              >
                {field.replace(/_/g, " ")}
              </span>
            ))}
          </div>
          {record.granted && !record.revokedAt && onRevoke && (
            <button
              onClick={() => onRevoke(record.id)}
              className="text-xs text-red-600 underline mt-2"
            >
              Revoke consent
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
