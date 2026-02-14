"use client";

interface ConsentRecord {
  id: string;
  grantId: string;
  action: "granted" | "denied" | "revoked";
  timestamp: string;
  dataShared?: string[];
  purpose?: string;
  source?: string;
}

interface ConsentTimelineProps {
  records: ConsentRecord[];
}

const actionStyles: Record<string, { bg: string; icon: string; label: string }> = {
  granted: { bg: "bg-green-100 border-green-300", icon: "\u2713", label: "Consent given" },
  denied: { bg: "bg-red-100 border-red-300", icon: "\u2717", label: "Consent denied" },
  revoked: { bg: "bg-yellow-100 border-yellow-300", icon: "\u21A9", label: "Consent revoked" },
};

export default function ConsentTimeline({ records }: ConsentTimelineProps) {
  if (records.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-6 text-center">
        <p className="text-gray-400">No consent decisions recorded.</p>
        <p className="text-xs text-gray-400 mt-1">
          Consent records appear when services request access to your data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-3">
        Consent History
      </h3>
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
        {records.map((record) => {
          const style = actionStyles[record.action] || actionStyles.granted;
          return (
            <div key={record.id} className="relative pl-8 py-2">
              <div className={`absolute left-1 top-3 w-5 h-5 rounded-full border ${style.bg} flex items-center justify-center text-xs`}>
                {style.icon}
              </div>
              <div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium">{style.label}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(record.timestamp).toLocaleString("en-GB")}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {record.purpose || record.grantId}
                </div>
                {record.dataShared && record.dataShared.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {record.dataShared.map((field) => (
                      <span key={field} className="text-xs bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                        {field.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
