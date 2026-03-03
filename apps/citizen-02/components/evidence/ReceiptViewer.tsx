"use client";

interface Receipt {
  id: string;
  capabilityId: string;
  timestamp: string;
  action: string;
  outcome: string;
  details: Record<string, unknown>;
  dataShared?: string[];
}

interface ReceiptViewerProps {
  receipts: Receipt[];
}

const outcomeBadge: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  failure: "bg-red-100 text-red-800",
  partial: "bg-yellow-100 text-yellow-800",
  handoff: "bg-blue-100 text-blue-800",
};

export default function ReceiptViewer({ receipts }: ReceiptViewerProps) {
  if (receipts.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-6 text-center">
        <p className="text-gray-400">No receipts yet.</p>
        <p className="text-xs text-gray-400 mt-1">
          Receipts are generated when services are used on your behalf.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wide">
        Your Receipts
      </h3>
      {receipts.map((receipt) => (
        <div key={receipt.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-sm">{receipt.action}</div>
              <div className="text-xs text-gray-500 mt-1 font-mono">
                {receipt.capabilityId}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${outcomeBadge[receipt.outcome] || "bg-gray-100"}`}>
              {receipt.outcome}
            </span>
          </div>

          <div className="text-xs text-gray-400 mt-2">
            {new Date(receipt.timestamp).toLocaleString("en-GB")}
          </div>

          {receipt.dataShared && receipt.dataShared.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-gray-500">Data shared: </span>
              {receipt.dataShared.map((field) => (
                <span key={field} className="text-xs bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded mr-1">
                  {field.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-400 mt-2 font-mono">
            Receipt: {receipt.id}
          </div>
        </div>
      ))}
    </div>
  );
}
