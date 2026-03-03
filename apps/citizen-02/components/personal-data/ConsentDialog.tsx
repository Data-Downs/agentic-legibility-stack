"use client";

interface ConsentGrant {
  id: string;
  description: string;
  data_shared: string[];
  purpose: string;
  required: boolean;
}

interface ConsentDialogProps {
  serviceName: string;
  grants: ConsentGrant[];
  onDecision: (grantId: string, granted: boolean) => void;
  onComplete: () => void;
}

export default function ConsentDialog({
  serviceName,
  grants,
  onDecision,
  onComplete,
}: ConsentDialogProps) {
  return (
    <div className="bg-white border-2 border-govuk-blue rounded-lg p-5 space-y-4">
      <div className="border-b border-gray-200 pb-3">
        <h3 className="font-bold text-lg">Data sharing consent</h3>
        <p className="text-sm text-gray-600 mt-1">
          <strong>{serviceName}</strong> needs your permission to access the following data.
        </p>
      </div>

      {grants.map((grant) => (
        <div key={grant.id} className="border border-gray-200 rounded p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium">{grant.description}</div>
            {grant.required && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                Required
              </span>
            )}
          </div>

          <div className="text-sm text-gray-600 mb-3">{grant.purpose}</div>

          <div className="bg-gray-50 rounded p-2 mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Data that will be shared
            </div>
            <div className="flex flex-wrap gap-1">
              {grant.data_shared.map((field) => (
                <span
                  key={field}
                  className="text-xs bg-white border border-gray-300 px-2 py-0.5 rounded"
                >
                  {field.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onDecision(grant.id, true)}
              className="bg-govuk-green text-white px-3 py-1.5 rounded text-sm font-bold hover:opacity-90"
            >
              Allow
            </button>
            {!grant.required && (
              <button
                onClick={() => onDecision(grant.id, false)}
                className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
              >
                Deny
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={onComplete}
        className="w-full bg-govuk-blue text-white py-2 rounded font-bold hover:opacity-90"
      >
        Continue
      </button>
    </div>
  );
}
