"use client";

import { use } from "react";
import LedgerDashboard from "@/components/ledger/LedgerDashboard";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/ui/PageHeader";

export default function ServiceLedgerPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = use(params);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Services", href: "/services" },
          { label: serviceId, href: `/services/${encodeURIComponent(serviceId)}` },
          { label: "Ledger" },
        ]}
      />
      <PageHeader
        title="Service Ledger"
        subtitle="Operational dashboard showing how citizens are progressing through this service."
      />

      <LedgerDashboard serviceId={serviceId} />
    </div>
  );
}
