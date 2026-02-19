"use client";

import { use } from "react";
import LedgerDashboard from "@/components/ledger/LedgerDashboard";

export default function ServiceLedgerPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = use(params);

  return (
    <div>
      <a
        href={`/services/${encodeURIComponent(serviceId)}`}
        className="text-govuk-blue text-sm mb-4 inline-block"
      >
        &larr; Back to service
      </a>

      <h1 className="text-3xl font-bold mb-2">Service Ledger</h1>
      <p className="text-govuk-dark-grey mb-6">
        Operational dashboard showing how citizens are progressing through this service.
      </p>

      <LedgerDashboard serviceId={serviceId} />
    </div>
  );
}
