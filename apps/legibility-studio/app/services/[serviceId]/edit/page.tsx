"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import ServiceForm, { apiDataToFormData, formDataToApiPayload, type ServiceFormData } from "@/components/forms/ServiceForm";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/ui/PageHeader";

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
    return <div className="text-center py-12 text-gray-500">Loading service...</div>;
  }

  if (!initialData) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600">Service not found</h1>
        <a href="/services" className="text-studio-accent mt-4 inline-block hover:underline">
          Back to services
        </a>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Services", href: "/services" },
          { label: serviceId, href: `/services/${encodeURIComponent(serviceId)}` },
          { label: "Edit" },
        ]}
      />
      <PageHeader
        title="Edit service"
        subtitle={serviceId}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-800">
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
