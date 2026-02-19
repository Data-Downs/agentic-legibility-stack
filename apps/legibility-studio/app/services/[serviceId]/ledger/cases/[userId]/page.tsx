"use client";

import { use } from "react";
import CaseDetail from "@/components/ledger/CaseDetail";

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string; userId: string }>;
}) {
  const { serviceId, userId } = use(params);

  return (
    <div>
      <a
        href={`/services/${encodeURIComponent(serviceId)}/ledger`}
        className="text-govuk-blue text-sm mb-4 inline-block"
      >
        &larr; Back to ledger
      </a>

      <CaseDetail serviceId={serviceId} userId={userId} />
    </div>
  );
}
