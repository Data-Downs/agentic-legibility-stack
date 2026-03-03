"use client";

interface VerifiedData {
  fullName?: string;
  dateOfBirth?: string;
  nationalInsuranceNumber?: string;
  address?: { line1: string; city: string; postcode: string };
  drivingLicenceNumber?: string;
  verificationLevel: string;
}

interface DataProfileProps {
  verified: VerifiedData;
  incidentalCount: number;
}

const verificationBadge: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-red-100 text-red-800",
  none: "bg-gray-100 text-gray-500",
};

export default function DataProfile({ verified, incidentalCount }: DataProfileProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wide">
          Your Data Profile
        </h3>
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${verificationBadge[verified.verificationLevel] || verificationBadge.none}`}
        >
          {verified.verificationLevel} verification
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {verified.fullName && (
          <div className="p-3 flex justify-between">
            <span className="text-sm text-gray-500">Full name</span>
            <span className="text-sm font-medium">{verified.fullName}</span>
          </div>
        )}
        {verified.dateOfBirth && (
          <div className="p-3 flex justify-between">
            <span className="text-sm text-gray-500">Date of birth</span>
            <span className="text-sm font-medium">
              {new Date(verified.dateOfBirth).toLocaleDateString("en-GB")}
            </span>
          </div>
        )}
        {verified.nationalInsuranceNumber && (
          <div className="p-3 flex justify-between">
            <span className="text-sm text-gray-500">NI number</span>
            <span className="text-sm font-medium font-mono">
              {verified.nationalInsuranceNumber}
            </span>
          </div>
        )}
        {verified.address && (
          <div className="p-3 flex justify-between">
            <span className="text-sm text-gray-500">Address</span>
            <span className="text-sm font-medium text-right">
              {verified.address.line1}
              <br />
              {verified.address.city}, {verified.address.postcode}
            </span>
          </div>
        )}
        {verified.drivingLicenceNumber && (
          <div className="p-3 flex justify-between">
            <span className="text-sm text-gray-500">Driving licence</span>
            <span className="text-sm font-medium font-mono">
              {verified.drivingLicenceNumber}
            </span>
          </div>
        )}
      </div>

      {incidentalCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-sm text-blue-800">
            <strong>{incidentalCount}</strong> additional data point(s) collected
            from conversations (stored on-device only).
          </div>
        </div>
      )}
    </div>
  );
}
