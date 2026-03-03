"use client";

import type { EnrichedData } from "@/lib/types";
import { LiveBadge } from "../ui/LiveBadge";
import { UrgencyDot } from "../ui/UrgencyDot";

interface NearYouSectionProps {
  enrichedData: EnrichedData | null;
  postcode?: string;
}

export function NearYouSection({ enrichedData, postcode }: NearYouSectionProps) {
  if (!postcode) return null;

  return (
    <div className="mb-5">
      <h3 className="text-base font-extrabold text-govuk-black mb-3">Near you</h3>
      <div className="bg-white rounded-card shadow-sm divide-y divide-gray-100">
        {/* Local authority */}
        {enrichedData?.postcode && (
          <div className="p-3.5 flex items-center gap-3">
            <span className="text-lg">🏛️</span>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-govuk-black">
                {enrichedData.postcode.admin_district}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-govuk-dark-grey">
                Local authority <LiveBadge />
              </span>
            </div>
          </div>
        )}

        {/* MP */}
        {enrichedData?.mp && (
          <div className="p-3.5 flex items-center gap-3">
            <span className="text-lg">🗳️</span>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-govuk-black">
                {enrichedData.mp.name}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-govuk-dark-grey">
                {enrichedData.mp.party} — {enrichedData.mp.constituency} <LiveBadge />
              </span>
            </div>
          </div>
        )}

        {/* Flood warnings */}
        {enrichedData?.floods && enrichedData.floods.count > 0 && (
          <div className="p-3.5 flex items-center gap-3">
            <UrgencyDot urgency="warning" size="md" />
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-govuk-black">
                {enrichedData.floods.count} flood warning{enrichedData.floods.count !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-govuk-dark-grey">
                Environment Agency <LiveBadge />
              </span>
            </div>
          </div>
        )}

        {/* Bank holidays */}
        {enrichedData?.bankHolidays && enrichedData.bankHolidays.length > 0 && (
          <div className="p-3.5 flex items-center gap-3">
            <span className="text-lg">📅</span>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-govuk-black">
                {enrichedData.bankHolidays[0].title}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-govuk-dark-grey">
                In {enrichedData.bankHolidays[0].daysUntil} days <LiveBadge />
              </span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {!enrichedData && (
          <div className="p-3.5 text-center text-sm text-govuk-dark-grey">
            Loading local information for {postcode}...
          </div>
        )}

        {/* No enrichment results */}
        {enrichedData && !enrichedData.postcode && !enrichedData.mp && (
          <div className="p-3.5 text-sm text-govuk-dark-grey">
            {postcode}
          </div>
        )}
      </div>
    </div>
  );
}
