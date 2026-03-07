"use client";

import { useState, useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import type { CardDefinition } from "@als/schemas";

interface DocumentUploadCardProps {
  definition: CardDefinition;
  serviceId: string;
  stateId: string;
  onSubmit: (fields: Record<string, string | number | boolean>) => void;
  disabled?: boolean;
}

type Phase = "select" | "extracting" | "confirm" | "error";

/**
 * Three-phase document upload card:
 * 1. Select — file picker with drag-drop
 * 2. Extracting — spinner while calling Claude vision
 * 3. Confirm — show extracted fields for editing, then submit
 */
export function DocumentUploadCard({
  definition,
  serviceId,
  stateId,
  onSubmit,
  disabled,
}: DocumentUploadCardProps) {
  const persona = useAppStore((s) => s.persona);
  const [phase, setPhase] = useState<Phase>("select");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    if (selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleUpload = async () => {
    if (!file || !persona) return;
    setPhase("extracting");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("serviceId", serviceId);
      formData.append("stateId", stateId);

      const res = await fetch(`/api/personal-data/${persona}/document-upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }

      const data: { extracted: Record<string, string>; summary: string } = await res.json();
      setExtracted(data.extracted);
      setSummary(data.summary);
      setPhase("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  };

  const handleFieldEdit = (key: string, value: string) => {
    setExtracted((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    onSubmit(extracted);
  };

  const handleRetry = () => {
    setPhase("select");
    setFile(null);
    setPreview(null);
    setErrorMsg("");
  };

  const formatLabel = (key: string) =>
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // ── Select phase ──
  if (phase === "select") {
    return (
      <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
        {definition.description && (
          <p className="text-xs text-govuk-dark-grey">{definition.description}</p>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            dragOver
              ? "border-govuk-blue bg-blue-50"
              : file
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-white hover:border-gray-400"
          }`}
        >
          {file ? (
            <>
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-32 rounded-lg object-contain" />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4c6272" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
              <span className="text-sm font-medium text-govuk-black">{file.name}</span>
              <span className="text-xs text-govuk-dark-grey">{(file.size / 1024).toFixed(0)} KB</span>
            </>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4c6272" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm text-govuk-dark-grey">Tap to choose a file or drag and drop</span>
              <span className="text-xs text-govuk-mid-grey">PDF, JPG, PNG up to 10MB</span>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          onChange={handleInputChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || disabled}
          className="w-full text-sm font-bold text-white py-3 rounded-xl transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "#00703c" }}
        >
          Upload &amp; extract
        </button>
      </div>
    );
  }

  // ── Extracting phase ──
  if (phase === "extracting") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 border border-gray-200 rounded-xl bg-gray-50">
        <div className="w-8 h-8 border-3 border-govuk-blue border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-govuk-dark-grey">Reading document...</span>
        <span className="text-xs text-govuk-mid-grey">Extracting key details with AI</span>
      </div>
    );
  }

  // ── Error phase ──
  if (phase === "error") {
    return (
      <div className="space-y-3 border border-red-200 rounded-xl p-4 bg-red-50">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4351c" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span className="text-sm font-medium text-red-700">Something went wrong</span>
        </div>
        <p className="text-xs text-red-600">{errorMsg}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="w-full text-sm font-bold text-white py-3 rounded-xl"
          style={{ backgroundColor: "#d4351c" }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Confirm phase ──
  return (
    <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
      {summary && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d70b8" strokeWidth="2" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span className="text-xs text-blue-800">{summary}</span>
        </div>
      )}

      <label className="block text-sm font-semibold text-govuk-black">
        Confirm the extracted details
      </label>

      <div className="space-y-2">
        {Object.entries(extracted).map(([key, value]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-govuk-dark-grey mb-1">
              {formatLabel(key)}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleFieldEdit(key, e.target.value)}
              disabled={disabled}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={disabled}
        className="w-full text-sm font-bold text-white py-3 rounded-xl transition-opacity disabled:opacity-40"
        style={{ backgroundColor: "#00703c" }}
      >
        {definition.submitLabel ?? "Confirm extracted details"}
      </button>
    </div>
  );
}
