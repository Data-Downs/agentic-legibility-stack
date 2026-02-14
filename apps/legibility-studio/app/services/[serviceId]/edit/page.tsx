"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import ServiceForm, { apiDataToFormData, formDataToApiPayload, type ServiceFormData } from "@/components/forms/ServiceForm";

export default function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = use(params);
  const router = useRouter();
  const [initialData, setInitialData] = useState<ServiceFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/services/${encodeURIComponent(serviceId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInitialData(apiDataToFormData(data));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load service");
        setLoading(false);
      });
  }, [serviceId]);

  async function handleSubmit(data: ServiceFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = formDataToApiPayload(data);
      const response = await fetch(`/api/services/${encodeURIComponent(serviceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update service");
      }

      router.push(`/services/${encodeURIComponent(serviceId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-govuk-dark-grey">Loading service...</div>;
  }

  if (!initialData) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600">Service not found</h1>
        <a href="/services" className="text-govuk-blue mt-4 inline-block">
          Back to services
        </a>
      </div>
    );
  }

  return (
    <div>
      <a href={`/services/${encodeURIComponent(serviceId)}`} className="text-govuk-blue text-sm mb-4 inline-block">
        &larr; Back to service
      </a>

      <h1 className="text-3xl font-bold mb-2">Edit service</h1>
      <p className="text-govuk-dark-grey mb-6">
        <span className="font-mono text-sm">{serviceId}</span>
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-sm text-red-800">
          {error}
        </div>
      )}

      <ServiceForm
        initialData={initialData}
        onSubmit={handleSubmit}
        submitLabel="Update service"
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
