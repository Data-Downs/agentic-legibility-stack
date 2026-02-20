"use client";

import { use } from "react";
import CaseDetail from "@/components/ledger/CaseDetail";
import Breadcrumbs from "@/components/layout/Breadcrumbs";

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string; userId: string }>;
}) {
  const { serviceId, userId } = use(params);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Services", href: "/services" },
          { label: serviceId, href: `/services/${encodeURIComponent(serviceId)}` },
          { label: "Ledger", href: `/services/${encodeURIComponent(serviceId)}/ledger` },
          { label: userId },
        ]}
      />

      <CaseDetail serviceId={serviceId} userId={userId} />
    </div>
  );
}
