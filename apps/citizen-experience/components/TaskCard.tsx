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
  completion?: string;
  onComplete?: (taskId: string, message: string) => void;
  onReset?: (taskId: string) => void;
  disabled?: boolean;
}

type TaskFormType = "housing" | "bank" | null;

const HOUSING_FIELDS = new Set(["tenure_type", "housing_tenure", "housing_status", "monthly_rent", "rent", "address"]);
const BANK_FIELDS = new Set(["sort_code", "account_number", "bank_accounts", "bank_account", "bank_details"]);

const HOUSING_KEYWORDS = /housing|tenure|rent|own.*home|accommodation/i;
const BANK_KEYWORDS = /bank\s*account|payment\s*account|sort\s*code/i;

function detectFormType(dataNeeded?: string[], description?: string, detail?: string): TaskFormType {
  const text = `${description || ""} ${detail || ""}`;
  // Check dataNeeded fields first, then fall back to description keywords
  if (dataNeeded?.some((d) => HOUSING_FIELDS.has(d)) || HOUSING_KEYWORDS.test(text)) return "housing";
  if (dataNeeded?.some((d) => BANK_FIELDS.has(d)) || BANK_KEYWORDS.test(text)) return "bank";
  return null;
}

const TENURE_OPTIONS = [
  { value: "private_renter", label: "Private renter" },
  { value: "council_tenant", label: "Council tenant" },
  { value: "homeowner", label: "Homeowner" },
  { value: "living_with_family", label: "Living with family" },
];

function HousingForm({ onSubmit, disabled }: { onSubmit: (message: string) => void; disabled?: boolean }) {
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
    <div className="mt-3 space-y-3 border border-govuk-mid-grey rounded-lg p-3 bg-gray-50">
      <div>
        <label className="block text-xs font-semibold text-govuk-black mb-1">
          What is your housing situation?
        </label>
        <div className="space-y-1.5">
          {TENURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTenure(opt.value)}
              disabled={disabled}
              className={`w-full text-left text-sm rounded border px-3 py-2 transition-colors disabled:opacity-50 ${
                tenure === opt.value
                  ? "border-green-600 bg-green-50 ring-2 ring-green-200 font-medium"
                  : "border-govuk-mid-grey bg-white hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showRent && (
        <div>
          <label className="block text-xs font-semibold text-govuk-black mb-1">
            Monthly rent (£)
          </label>
          <input
            type="number"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            placeholder="e.g. 650"
            min="0"
            disabled={disabled}
            className="w-full text-sm border border-govuk-mid-grey rounded px-3 py-2 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow disabled:opacity-50"
          />
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || disabled}
        className="w-full text-sm font-bold text-white py-2 rounded transition-opacity disabled:opacity-40"
        style={{ backgroundColor: "#00703c" }}
      >
        Confirm housing details
      </button>
    </div>
  );
}

function BankForm({ onSubmit, disabled }: { onSubmit: (message: string) => void; disabled?: boolean }) {
  const personaData = useAppStore((s) => s.personaData);
  const [selected, setSelected] = useState<number | null>(null);
  const [useOther, setUseOther] = useState(false);
  const [otherBank, setOtherBank] = useState("");
  const [otherSortCode, setOtherSortCode] = useState("");
  const [otherAccountNumber, setOtherAccountNumber] = useState("");

  const accounts: BankAccount[] =
    (personaData?.financials as { bankAccounts?: BankAccount[] })?.bankAccounts ?? [];
  const showOther = useOther || accounts.length === 0;

  const canSubmitSaved = !showOther && selected !== null;
  const canSubmitOther = showOther && otherBank && otherSortCode.length >= 6 && otherAccountNumber.length >= 6;
  const canSubmit = canSubmitSaved || canSubmitOther;

  const handleSubmit = () => {
    if (showOther) {
      if (!canSubmitOther) return;
      onSubmit(
        `Please use my ${otherBank} account (sort code: ${otherSortCode}, account: ${otherAccountNumber})`
      );
    } else {
      if (selected === null) return;
      const acct = accounts[selected];
      onSubmit(
        `Please use my ${acct.bank} account (sort code: ${acct.sortCode}, account: ${acct.accountNumber})`
      );
    }
  };

  const selectSaved = (idx: number) => {
    setSelected(idx);
    setUseOther(false);
  };

  const switchToOther = () => {
    setUseOther(true);
    setSelected(null);
  };

  return (
    <div className="mt-3 space-y-3 border border-govuk-mid-grey rounded-lg p-3 bg-gray-50">
      <label className="block text-xs font-semibold text-govuk-black">
        Which account should payments go to?
      </label>

      {/* Saved accounts */}
      {accounts.length > 0 && !showOther && (
        <div className="space-y-1.5">
          {accounts.map((acct, idx) => {
            const last4 = acct.accountNumber.slice(-4);
            const isSelected = selected === idx;
            return (
              <button
                key={idx}
                onClick={() => selectSaved(idx)}
                disabled={disabled}
                className={`w-full text-left text-sm rounded-lg border-2 px-3 py-2.5 transition-all disabled:opacity-50 ${
                  isSelected
                    ? "border-green-600 bg-green-50 ring-1 ring-green-200"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-green-600" : "border-gray-300"
                  }`}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-green-600" />}
                  </span>
                  <div>
                    <span className="font-medium text-govuk-black">{acct.bank}</span>
                    <span className="text-govuk-dark-grey ml-1">— {acct.label}</span>
                    <span className="text-govuk-dark-grey text-xs ml-1">(····{last4})</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Other account toggle/form */}
      {!showOther && accounts.length > 0 && (
        <button
          onClick={switchToOther}
          disabled={disabled}
          className="text-xs text-govuk-blue underline hover:no-underline disabled:opacity-50"
        >
          Use a different account
        </button>
      )}

      {showOther && (
        <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-govuk-black">Enter account details</span>
            {accounts.length > 0 && (
              <button
                onClick={() => { setUseOther(false); }}
                disabled={disabled}
                className="text-xs text-govuk-blue underline hover:no-underline"
              >
                Back to saved accounts
              </button>
            )}
          </div>
          <input
            type="text"
            value={otherBank}
            onChange={(e) => setOtherBank(e.target.value)}
            placeholder="Bank name (e.g. Barclays)"
            disabled={disabled}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow disabled:opacity-50"
          />
          <input
            type="text"
            value={otherSortCode}
            onChange={(e) => setOtherSortCode(e.target.value)}
            placeholder="Sort code (e.g. 12-34-56)"
            disabled={disabled}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow disabled:opacity-50"
          />
          <input
            type="text"
            value={otherAccountNumber}
            onChange={(e) => setOtherAccountNumber(e.target.value)}
            placeholder="Account number (e.g. 12345678)"
            disabled={disabled}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow disabled:opacity-50"
          />
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || disabled}
        className="w-full text-sm font-bold text-white py-2 rounded-lg transition-opacity disabled:opacity-40"
        style={{ backgroundColor: "#00703c" }}
      >
        Confirm bank account
      </button>
    </div>
  );
}

export function TaskCard({ task, completion, onComplete, onReset, disabled }: TaskCardProps) {
  const isAgent = task.type === "agent";
  const isCompleted = !!completion;

  const borderColor = isCompleted
    ? "#00703c"
    : isAgent ? "#1d70b8" : "#00703c";
  const badgeBg = isCompleted
    ? "bg-green-100 text-green-800"
    : isAgent ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
  const badgeLabel = isCompleted
    ? "Done"
    : isAgent ? "Agent" : "You";

  const formType = detectFormType(task.dataNeeded, task.description, task.detail);

  const handleFormComplete = (message: string) => {
    onComplete?.(task.id, message);
  };

  const handleAccept = () => {
    const msg = isAgent
      ? `Yes, please go ahead — ${task.description.toLowerCase()}`
      : `I've done it — ${task.description.toLowerCase()}`;
    onComplete?.(task.id, msg);
  };

  return (
    <div
      className={`my-2 rounded-lg border bg-white transition-opacity ${isCompleted ? "opacity-80" : ""}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeBg}`}>
            {badgeLabel}
          </span>
          {isCompleted && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00703c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {!isCompleted && task.dueDate && (
            <span className="text-[10px] font-medium text-orange-600">
              Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Content */}
        <p className={`text-sm font-medium ${isCompleted ? "text-govuk-dark-grey" : "text-govuk-black"}`}>
          {task.description}
        </p>
        <p className="text-xs text-govuk-dark-grey mt-0.5">{task.detail}</p>

        {/* Data needed tags — hide when showing a form or completed */}
        {!isCompleted && !formType && task.dataNeeded && task.dataNeeded.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {task.dataNeeded.map((d) => (
              <span key={d} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Completed state — show what was captured + Change link */}
        {isCompleted && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-green-700 truncate mr-2">
              {completion}
            </span>
            {!disabled && (
              <button
                onClick={() => onReset?.(task.id)}
                className="text-xs text-govuk-blue underline hover:no-underline shrink-0"
              >
                Change
              </button>
            )}
          </div>
        )}

        {/* Interactive forms or default actions — only when not completed */}
        {!isCompleted && (
          <>
            {formType === "housing" && (
              <HousingForm onSubmit={handleFormComplete} disabled={disabled} />
            )}

            {formType === "bank" && (
              <BankForm onSubmit={handleFormComplete} disabled={disabled} />
            )}

            {!formType && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAccept}
                  disabled={disabled}
                  className="text-xs font-bold text-white px-3 py-1 rounded disabled:opacity-50"
                  style={{ backgroundColor: isAgent ? "#1d70b8" : "#00703c" }}
                >
                  {isAgent ? "Do this" : "Got it"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
