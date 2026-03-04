"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/ui/PageHeader";
import { Sparkles, FileText, Loader2 } from "lucide-react";

export default function NewPersonaPage() {
  const router = useRouter();

  // AI generation state
  const [scenario, setScenario] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [servicesOfInterest, setServicesOfInterest] = useState("");
  const [generating, setGenerating] = useState(false);

  // Blank creation state
  const [blankName, setBlankName] = useState("");
  const [creating, setCreating] = useState(false);

  // Shared
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!scenario.trim() || scenario.trim().length < 10) {
      setError("Please describe the persona scenario (at least 10 characters).");
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const body: Record<string, unknown> = {
        scenarioDescription: scenario.trim(),
      };
      if (suggestedName.trim()) {
        body.suggestedName = suggestedName.trim();
      }
      if (servicesOfInterest.trim()) {
        body.servicesOfInterest = servicesOfInterest
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const response = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate persona");
      }

      router.push(`/personas/${encodeURIComponent(data.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  }

  async function handleCreateBlank() {
    if (!blankName.trim() || blankName.trim().length < 2) {
      setError("Please enter a name (at least 2 characters).");
      return;
    }

    setError(null);
    setCreating(true);

    try {
      const response = await fetch("/api/personas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: blankName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create persona");
      }

      router.push(`/personas/${encodeURIComponent(data.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  const inputClass =
    "w-full border border-studio-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-studio-accent";

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Personas", href: "/personas" },
          { label: "New Persona" },
        ]}
      />
      <PageHeader
        title="Create New Persona"
        subtitle="Generate a persona with AI or create a blank one for manual editing."
        actions={
          <button
            onClick={() => router.push("/personas")}
            className="px-4 py-2 text-sm border border-studio-border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="border border-red-200 rounded-lg bg-red-50 px-4 py-3 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Generate with AI */}
        <div className="border border-studio-border rounded-lg p-6 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={20} className="text-studio-accent" />
            <h2 className="text-lg font-bold">Generate with AI</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Describe a scenario and the AI will generate a full persona with
            realistic UK citizen data, credentials, financials, and more.
          </p>

          <div className="space-y-4">
            {/* Scenario description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Scenario Description <span className="text-red-500">*</span>
              </label>
              <textarea
                className={inputClass}
                rows={5}
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Describe the persona's situation, e.g.:&#10;&#10;'A couple in their 60s, recently retired, managing power of attorney for elderly parent with dementia. Multiple properties, complex pension arrangements. The wife handles all the admin and is quite tech-savvy.'"
                disabled={generating}
              />
            </div>

            {/* Suggested name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Suggested Name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                className={inputClass}
                value={suggestedName}
                onChange={(e) => setSuggestedName(e.target.value)}
                placeholder="e.g. Richard & Susan Clarke"
                disabled={generating}
              />
            </div>

            {/* Services of interest */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Services of Interest{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                className={inputClass}
                value={servicesOfInterest}
                onChange={(e) => setServicesOfInterest(e.target.value)}
                placeholder="e.g. power-of-attorney, council-tax, attendance-allowance"
                disabled={generating}
              />
              <p className="text-xs text-gray-400 mt-1">
                Comma-separated list of government services
              </p>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !scenario.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-studio-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating persona...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Persona
                </>
              )}
            </button>

            {generating && (
              <p className="text-xs text-gray-500 text-center">
                This typically takes 15-30 seconds. The AI is creating a
                detailed persona with realistic data.
              </p>
            )}
          </div>
        </div>

        {/* Card 2: Create Blank */}
        <div className="border border-studio-border rounded-lg p-6 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-gray-600" />
            <h2 className="text-lg font-bold">Create Blank</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Create an empty persona with all standard sections ready for manual
            editing. Perfect when you want full control over every field.
          </p>

          <div className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={blankName}
                onChange={(e) => setBlankName(e.target.value)}
                placeholder="e.g. John Smith"
                disabled={creating}
              />
            </div>

            {/* Create button */}
            <button
              onClick={handleCreateBlank}
              disabled={creating || !blankName.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-studio-border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText size={16} />
                  Create Blank Persona
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
