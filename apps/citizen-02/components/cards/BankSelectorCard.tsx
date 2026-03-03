"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { CardDefinition } from "@als/schemas";

interface BankAccount {
  bank: string;
  sortCode: string;
  accountNumber: string;
  label: string;
}

interface BankSelectorCardProps {
  definition: CardDefinition;
  onSubmit: (fields: Record<string, string | number | boolean>) => void;
  disabled?: boolean;
}

/**
 * Specialized bank account selector — uses persona's saved accounts
 * when available, with fallback to manual entry. Submits directly
 * to Tier 2 via CardHost.
 */
export function BankSelectorCard({ definition, onSubmit, disabled }: BankSelectorCardProps) {
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
  const canSubmitOther =
    showOther && otherBank && otherSortCode.length >= 6 && otherAccountNumber.length >= 6;
  const canSubmit = canSubmitSaved || canSubmitOther;

  const handleSubmit = () => {
    if (showOther) {
      if (!canSubmitOther) return;
      onSubmit({
        bank_name: otherBank,
        sort_code: otherSortCode,
        account_number: otherAccountNumber,
      });
    } else {
      if (selected === null) return;
      const acct = accounts[selected];
      onSubmit({
        bank_name: acct.bank,
        sort_code: acct.sortCode,
        account_number: acct.accountNumber,
      });
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

  const inputClass =
    "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow disabled:opacity-50";

  return (
    <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
      {definition.description && (
        <p className="text-xs text-govuk-dark-grey">{definition.description}</p>
      )}

      <label className="block text-sm font-semibold text-govuk-black">
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
                type="button"
                onClick={() => selectSaved(idx)}
                disabled={disabled}
                className={`w-full text-left text-sm rounded-lg border-2 px-3 py-2.5 transition-all disabled:opacity-50 ${
                  isSelected
                    ? "border-green-600 bg-green-50 ring-1 ring-green-200"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-green-600" : "border-gray-300"
                    }`}
                  >
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

      {/* Toggle to manual entry */}
      {!showOther && accounts.length > 0 && (
        <button
          type="button"
          onClick={switchToOther}
          disabled={disabled}
          className="text-xs text-govuk-blue underline hover:no-underline disabled:opacity-50"
        >
          Use a different account
        </button>
      )}

      {/* Manual entry form */}
      {showOther && (
        <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-govuk-black">Enter account details</span>
            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setUseOther(false)}
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
            className={inputClass}
          />
          <input
            type="text"
            value={otherSortCode}
            onChange={(e) => setOtherSortCode(e.target.value)}
            placeholder="Sort code (e.g. 12-34-56)"
            disabled={disabled}
            className={inputClass}
          />
          <input
            type="text"
            value={otherAccountNumber}
            onChange={(e) => setOtherAccountNumber(e.target.value)}
            placeholder="Account number (e.g. 12345678)"
            disabled={disabled}
            className={inputClass}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || disabled}
        className="w-full text-sm font-bold text-white py-3 rounded-xl transition-opacity disabled:opacity-40"
        style={{ backgroundColor: "#00703c" }}
      >
        {definition.submitLabel ?? "Confirm bank account"}
      </button>
    </div>
  );
}
