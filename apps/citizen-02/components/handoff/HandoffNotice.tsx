"use client";

interface HandoffNoticeProps {
  urgency: "routine" | "priority" | "urgent" | "safeguarding";
  reason: string;
  department: string;
  phone?: string;
  hours?: string;
  onDismiss?: () => void;
}

const urgencyStyles: Record<string, { bg: string; border: string; label: string }> = {
  routine: { bg: "bg-blue-50", border: "border-blue-400", label: "Handoff to human agent" },
  priority: { bg: "bg-yellow-50", border: "border-yellow-400", label: "Priority handoff" },
  urgent: { bg: "bg-orange-50", border: "border-orange-400", label: "Urgent handoff" },
  safeguarding: { bg: "bg-red-50", border: "border-red-400", label: "Immediate support needed" },
};

export default function HandoffNotice({
  urgency,
  reason,
  department,
  phone,
  hours,
  onDismiss,
}: HandoffNoticeProps) {
  const style = urgencyStyles[urgency] || urgencyStyles.routine;

  return (
    <div className={`${style.bg} border-l-4 ${style.border} rounded p-4`}>
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-sm">{style.label}</h4>
        {onDismiss && (
          <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
            &#10005;
          </button>
        )}
      </div>

      <p className="text-sm mt-2">{reason}</p>

      <div className="mt-3 bg-white rounded p-3 border border-gray-200">
        <div className="text-sm">
          <strong>{department}</strong>
        </div>
        {phone && (
          <div className="text-sm mt-1">
            Phone: <strong>{phone}</strong>
          </div>
        )}
        {hours && (
          <div className="text-xs text-gray-500 mt-1">{hours}</div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        A summary of your conversation and any information you have shared will
        be available to the human agent to avoid you having to repeat yourself.
      </p>
    </div>
  );
}
