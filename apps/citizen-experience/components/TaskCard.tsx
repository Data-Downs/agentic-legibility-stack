"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

interface BankAccount {
  bank: string;
  sortCode: string;
  accountNumber: string;
  label: string;
}

interface TaskCardProps {
  task: {
    id: string;
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string | null;
    dataNeeded?: string[];
  };
  onAccept?: (taskId: string) => void;
  onDismiss?: (taskId: string) => void;
}

type TaskFormType = "housing" | "bank" | null;

function detectFormType(dataNeeded?: string[]): TaskFormType {
  if (!dataNeeded) return null;
  if (dataNeeded.includes("tenure_type")) return "housing";
  if (dataNeeded.includes("sort_code") || dataNeeded.includes("account_number")) return "bank";
  return null;
}

const TENURE_OPTIONS = [
  { value: "private_renter", label: "Private renter" },
  { value: "council_tenant", label: "Council tenant" },
  { value: "homeowner", label: "Homeowner" },
  { value: "living_with_family", label: "Living with family" },
];

function HousingForm({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [tenure, setTenure] = useState("");
  const [rent, setRent] = useState("");

  const showRent = tenure === "private_renter" || tenure === "council_tenant";
  const canSubmit = tenure && (!showRent || rent);

  const handleSubmit = () => {
    const tenureLabel = TENURE_OPTIONS.find((o) => o.value === tenure)?.label ?? tenure;
    let msg = `My housing details: I am a ${tenureLabel.toLowerCase()}`;
    if (showRent && rent) {
      msg += ` and pay £${rent} per month in rent`;
    }
    onSubmit(msg);
  };

  return (
    <div className="mt-2 space-y-2">
      <label className="block text-xs font-medium text-govuk-black">
        Housing status
      </label>
      <select
        value={tenure}
        onChange={(e) => setTenure(e.target.value)}
        className="w-full text-sm border border-govuk-mid-grey rounded px-2 py-1.5 bg-white text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow"
      >
        <option value="">Select your housing type</option>
        {TENURE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {showRent && (
        <>
          <label className="block text-xs font-medium text-govuk-black">
            Monthly rent (£)
          </label>
          <input
            type="number"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            placeholder="e.g. 650"
            min="0"
            className="w-full text-sm border border-govuk-mid-grey rounded px-2 py-1.5 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow"
          />
        </>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="text-xs font-bold text-white px-3 py-1 rounded disabled:opacity-40"
        style={{ backgroundColor: "#00703c" }}
      >
        Submit
      </button>
    </div>
  );
}

function BankForm({ onSubmit }: { onSubmit: (message: string) => void }) {
  const personaData = useAppStore((s) => s.personaData);
  const [selected, setSelected] = useState<number | null>(null);

  const accounts: BankAccount[] =
    (personaData?.financials as { bankAccounts?: BankAccount[] })?.bankAccounts ?? [];

  if (accounts.length === 0) {
    return (
      <p className="mt-2 text-xs text-govuk-dark-grey">
        No saved bank accounts found.
      </p>
    );
  }

  const handleSubmit = () => {
    if (selected === null) return;
    const acct = accounts[selected];
    onSubmit(
      `Please use my ${acct.bank} account (sort code: ${acct.sortCode}, account: ${acct.accountNumber})`
    );
  };

  return (
    <div className="mt-2 space-y-2">
      <label className="block text-xs font-medium text-govuk-black">
        Select a bank account
      </label>
      <div className="space-y-1.5">
        {accounts.map((acct, idx) => {
          const last4 = acct.accountNumber.slice(-4);
          const isSelected = selected === idx;
          return (
            <button
              key={idx}
              onClick={() => setSelected(idx)}
              className={`w-full text-left text-sm rounded border px-3 py-2 transition-colors ${
                isSelected
                  ? "border-green-600 bg-green-50 ring-2 ring-green-200"
                  : "border-govuk-mid-grey bg-white hover:bg-gray-50"
              }`}
            >
              <span className="font-medium text-govuk-black">{acct.bank}</span>
              <span className="text-govuk-dark-grey ml-1">
                — {acct.label} (····{last4})
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={selected === null}
        className="text-xs font-bold text-white px-3 py-1 rounded disabled:opacity-40"
        style={{ backgroundColor: "#00703c" }}
      >
        Submit
      </button>
    </div>
  );
}

export function TaskCard({ task, onAccept, onDismiss }: TaskCardProps) {
  const [status, setStatus] = useState<"suggested" | "accepted" | "dismissed">("suggested");

  const isAgent = task.type === "agent";
  const borderColor = isAgent ? "#1d70b8" : "#00703c";
  const badgeBg = isAgent ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
  const badgeLabel = isAgent ? "Agent" : "You";

  const formType = detectFormType(task.dataNeeded);

  if (status === "dismissed") return null;

  const handleFormSubmit = (message: string) => {
    setStatus("accepted");
    useAppStore.getState().sendMessage(message);
  };

  return (
    <div
      className={`my-2 rounded-lg border bg-white transition-opacity ${status === "accepted" ? "opacity-70" : ""}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeBg}`}>
            {badgeLabel}
          </span>
          {task.dueDate && (
            <span className="text-[10px] font-medium text-orange-600">
              Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Content */}
        <p className="text-sm font-medium text-govuk-black">{task.description}</p>
        <p className="text-xs text-govuk-dark-grey mt-0.5">{task.detail}</p>

        {/* Data needed tags — hide when showing a form */}
        {!formType && task.dataNeeded && task.dataNeeded.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {task.dataNeeded.map((d) => (
              <span key={d} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Interactive forms or default actions */}
        {status === "suggested" && (
          <>
            {formType === "housing" && (
              <HousingForm onSubmit={handleFormSubmit} />
            )}

            {formType === "bank" && (
              <BankForm onSubmit={handleFormSubmit} />
            )}

            {!formType && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setStatus("accepted");
                    onAccept?.(task.id);
                  }}
                  className="text-xs font-bold text-white px-3 py-1 rounded"
                  style={{ backgroundColor: borderColor }}
                >
                  {isAgent ? "Do this" : "Got it"}
                </button>
                <button
                  onClick={() => {
                    setStatus("dismissed");
                    onDismiss?.(task.id);
                  }}
                  className="text-xs font-medium text-govuk-dark-grey px-3 py-1 rounded border border-govuk-mid-grey hover:bg-gray-50"
                >
                  Dismiss
                </button>
              </div>
            )}
          </>
        )}

        {status === "accepted" && (
          <div className="mt-2">
            <span className="text-xs font-medium text-green-700">Accepted</span>
          </div>
        )}
      </div>
    </div>
  );
}
