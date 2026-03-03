"use client";

interface DataDownloadProps {
  traceId: string;
}

export default function DataDownload({ traceId }: DataDownloadProps) {
  const handleDownload = async () => {
    try {
      const resp = await fetch(`/api/traces/${traceId}`);
      const data = await resp.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace-${traceId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not download trace data. Please try again.");
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-4">
      <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-2">
        Your Data
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Download a complete record of everything that happened during this session,
        including all data shared and decisions made on your behalf.
      </p>
      <button
        onClick={handleDownload}
        className="bg-govuk-blue text-white text-sm px-4 py-2 rounded hover:bg-blue-800 transition-colors"
      >
        Download session record (JSON)
      </button>
    </div>
  );
}
