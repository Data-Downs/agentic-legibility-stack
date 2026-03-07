"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { CardDefinition } from "@als/schemas";

interface PaymentCardProps {
  definition: CardDefinition;
  onSubmit: (fields: Record<string, string | number | boolean>) => void;
  disabled?: boolean;
  prefillData?: Record<string, string | number | boolean>;
}

type PaymentMethod = "apple_pay" | "debit_card" | "credit_card" | "direct_debit";

/**
 * Specialized payment card with Apple Pay simulation + card fallback.
 * Displays amount from prefillData, payment method selection, and
 * method-specific forms.
 */
export function PaymentCard({ definition, onSubmit, disabled, prefillData }: PaymentCardProps) {
  const openBottomSheet = useAppStore((s) => s.openBottomSheet);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState(false);

  const amount = prefillData?.amount_due ?? "0.00";
  const formattedAmount = typeof amount === "number"
    ? `£${amount.toFixed(2)}`
    : `£${amount}`;

  const methods: Array<{ value: PaymentMethod; label: string; icon?: string }> = [
    { value: "apple_pay", label: "Apple Pay" },
    { value: "debit_card", label: "Debit card" },
    { value: "credit_card", label: "Credit card" },
    { value: "direct_debit", label: "Direct debit" },
  ];

  const generateRef = () =>
    `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const submitPayment = (paymentMethod: PaymentMethod) => {
    onSubmit({
      payment_method: paymentMethod,
      amount_paid: String(amount),
      payment_reference: generateRef(),
      payment_timestamp: new Date().toISOString(),
    });
  };

  const handleApplePaySuccess = () => {
    submitPayment("apple_pay");
  };

  const handleApplePay = () => {
    openBottomSheet("payment", {
      amount: formattedAmount,
      onSuccess: handleApplePaySuccess,
    });
  };

  const handleCardPay = () => {
    if (!method || (!cardNumber || !expiry || !cvv)) return;
    setProcessing(true);
    // Simulate processing delay
    setTimeout(() => {
      setProcessing(false);
      submitPayment(method);
    }, 1200);
  };

  const handleDirectDebit = () => {
    submitPayment("direct_debit");
  };

  const canPayCard =
    (method === "debit_card" || method === "credit_card") &&
    cardNumber.length >= 16 &&
    expiry.length >= 5 &&
    cvv.length >= 3;

  const inputClass =
    "w-full text-sm border border-gray-200 rounded-xl px-4 py-3 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow disabled:opacity-50";

  return (
    <div className="space-y-4 border border-gray-200 rounded-xl p-4 bg-gray-50">
      {definition.description && (
        <p className="text-xs text-govuk-dark-grey">{definition.description}</p>
      )}

      {/* Amount display */}
      <div className="text-center py-3 bg-white rounded-xl border border-gray-200">
        <span className="text-xs text-govuk-dark-grey block">Amount due</span>
        <span className="text-2xl font-bold text-govuk-black">{formattedAmount}</span>
      </div>

      {/* Payment method selection */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-govuk-black">Payment method</label>
        {methods.map((m) => {
          const isSelected = method === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              disabled={disabled}
              className={`w-full text-left text-sm rounded-xl border px-4 py-3 transition-colors disabled:opacity-50 ${
                isSelected
                  ? "border-green-600 bg-green-50 ring-2 ring-green-200 font-medium"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {m.value === "apple_pay" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.53-3.74 4.25z"/>
                  </svg>
                )}
                {m.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Apple Pay button */}
      {method === "apple_pay" && (
        <button
          type="button"
          onClick={handleApplePay}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white py-3.5 rounded-xl transition-opacity disabled:opacity-40 bg-gray-950 hover:bg-black"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.53-3.74 4.25z"/>
          </svg>
          Pay with Apple Pay
        </button>
      )}

      {/* Card form */}
      {(method === "debit_card" || method === "credit_card") && (
        <div className="space-y-2">
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
            placeholder="Card number"
            disabled={disabled || processing}
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={expiry}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                setExpiry(raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw);
              }}
              placeholder="MM/YY"
              disabled={disabled || processing}
              className={inputClass}
            />
            <input
              type="text"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="CVV"
              disabled={disabled || processing}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={handleCardPay}
            disabled={!canPayCard || disabled || processing}
            className="w-full text-sm font-bold text-white py-3 rounded-xl transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#00703c" }}
          >
            {processing ? "Processing..." : `Pay ${formattedAmount}`}
          </button>
        </div>
      )}

      {/* Direct debit confirmation */}
      {method === "direct_debit" && (
        <div className="space-y-3">
          <p className="text-sm text-govuk-dark-grey">
            A direct debit will be set up with your bank. You&apos;ll receive a confirmation letter within 3 working days.
          </p>
          <button
            type="button"
            onClick={handleDirectDebit}
            disabled={disabled}
            className="w-full text-sm font-bold text-white py-3 rounded-xl transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#00703c" }}
          >
            Set up direct debit
          </button>
        </div>
      )}
    </div>
  );
}
