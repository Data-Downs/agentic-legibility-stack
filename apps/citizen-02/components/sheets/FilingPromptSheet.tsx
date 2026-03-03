"use client";

import { useAppStore } from "@/lib/store";

const SERVICES = [
  { id: "driving", label: "Driving", icon: "🚗" },
  { id: "benefits", label: "Benefits", icon: "💷" },
  { id: "family", label: "Family", icon: "👨‍👩‍👧" },
];

export function FilingPromptSheet() {
  const closeBottomSheet = useAppStore((s) => s.closeBottomSheet);
  const showToast = useAppStore((s) => s.showToast);

  const handleSave = (serviceId: string, label: string) => {
    // In a real implementation, this would update the conversation's service field
    closeBottomSheet();
    showToast(`Saved to ${label}`);
  };

  const handleDontSave = () => {
    closeBottomSheet();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-govuk-dark-grey mb-2">
        Where would you like to save this conversation?
      </p>

      <div className="flex flex-col gap-2">
        {SERVICES.map((svc) => (
          <button
            key={svc.id}
            onClick={() => handleSave(svc.id, svc.label)}
            className="flex items-center gap-3 w-full p-3.5 bg-white rounded-card border border-gray-200 text-left hover:border-govuk-blue hover:bg-blue-50/30 transition-all touch-feedback"
          >
            <span className="text-xl">{svc.icon}</span>
            <span className="flex-1 text-sm font-medium text-govuk-black">{svc.label}</span>
            <svg className="shrink-0 text-govuk-mid-grey" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      <button
        onClick={handleDontSave}
        className="w-full py-2.5 text-sm text-govuk-dark-grey hover:text-govuk-black transition-colors"
      >
        Don&apos;t save
      </button>
    </div>
  );
}
