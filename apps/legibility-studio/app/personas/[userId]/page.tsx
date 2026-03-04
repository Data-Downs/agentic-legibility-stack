"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/ui/PageHeader";
import PersonaForm from "@/components/personas/PersonaForm";

export default function PersonaDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const router = useRouter();

  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/personas/${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setUserData(data.user);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load persona data");
        setLoading(false);
      });
  }, [userId]);

  async function handleSave() {
    setIsSubmitting(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/personas/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userData }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Breadcrumbs
          items={[{ label: "Personas", href: "/personas" }, { label: "Loading..." }]}
        />
        <p className="text-sm text-gray-400 mt-8">Loading persona data...</p>
      </>
    );
  }

  if (!userData) {
    return (
      <>
        <Breadcrumbs
          items={[{ label: "Personas", href: "/personas" }, { label: "Not Found" }]}
        />
        <PageHeader title="Not Found" subtitle={error || `No user found with id "${userId}"`} />
      </>
    );
  }

  const name = (userData.personaName as string) || (userData.name as string) || userId;
  const address = userData.address as Record<string, unknown> | undefined;
  const city = address?.city as string || "";
  const empStatus = userData.employment_status as string || "";

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Personas", href: "/personas" },
          { label: name },
        ]}
      />
      <PageHeader
        title={name}
        subtitle={`${empStatus}${city ? ` \u00b7 ${city}` : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/personas")}
              className="px-4 py-2 text-sm border border-studio-border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-studio-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        }
      />

      {/* Status messages */}
      {error && (
        <div className="border border-red-200 rounded-lg bg-red-50 px-4 py-3 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {saved && (
        <div className="border border-green-200 rounded-lg bg-green-50 px-4 py-3 mb-4">
          <p className="text-sm text-green-800">Changes saved successfully.</p>
        </div>
      )}

      {/* Restart note */}
      <div className="border border-blue-200 rounded-lg bg-blue-50 px-4 py-3 mb-6">
        <p className="text-xs text-blue-800">
          Changes to persona data require restarting the citizen-experience dev server to take
          effect in the chat UI.
        </p>
      </div>

      {/* Unified form */}
      <PersonaForm data={userData} onChange={setUserData} />
    </>
  );
}
