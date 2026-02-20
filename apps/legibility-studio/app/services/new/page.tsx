"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ServiceForm, { formDataToApiPayload, type ServiceFormData } from "@/components/forms/ServiceForm";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/ui/PageHeader";

export default function CreateServicePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: ServiceFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = formDataToApiPayload(data);
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create service");
      }

      const result = await response.json();
      router.push(`/services/${encodeURIComponent(result.serviceId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Services", href: "/services" },
          { label: "Create new service" },
        ]}
      />
      <PageHeader
        title="Create new service"
        subtitle="Define a new government service with its manifest, policy, state model, and consent artefacts."
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-800">
          {error}
        </div>
      )}

      <ServiceForm
        onSubmit={handleSubmit}
        submitLabel="Create service"
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
