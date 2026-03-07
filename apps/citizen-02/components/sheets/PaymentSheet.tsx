"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";

type PaymentPhase = "confirm" | "biometric" | "success";

/**
 * Simulated Apple Pay bottom sheet with three phases:
 * 1. Confirm — dark UI, amount display, "Pay with Face ID" button
 * 2. Biometric — pulsing animation, auto-advances after 1.2s
 * 3. Success — green checkmark, auto-closes after 1.5s
 */
export function PaymentSheet() {
  const bottomSheet = useAppStore((s) => s.bottomSheet);
  const closeBottomSheet = useAppStore((s) => s.closeBottomSheet);
  const [phase, setPhase] = useState<PaymentPhase>("confirm");

  const data = bottomSheet.data as { amount?: string; onSuccess?: () => void } | undefined;
  const amount = data?.amount ?? "£0.00";

  const handleSuccess = useCallback(() => {
    data?.onSuccess?.();
    closeBottomSheet();
  }, [data, closeBottomSheet]);

  // Auto-advance from biometric to success
  useEffect(() => {
    if (phase === "biometric") {
      const timer = setTimeout(() => setPhase("success"), 1200);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Auto-close after success
  useEffect(() => {
    if (phase === "success") {
      const timer = setTimeout(handleSuccess, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, handleSuccess]);

  // ── Confirm phase ──
  if (phase === "confirm") {
    return (
      <div className="bg-gray-950 -mx-6 -mb-6 -mt-2 px-6 py-8 rounded-b-2xl">
        <div className="text-center space-y-4">
          {/* Apple Pay logo */}
          <div className="flex justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.53-3.74 4.25z"/>
            </svg>
          </div>

          <div>
            <p className="text-sm text-gray-400">Total</p>
            <p className="text-3xl font-bold text-white">{amount}</p>
          </div>

          <button
            type="button"
            onClick={() => setPhase("biometric")}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-950 font-semibold text-sm py-4 rounded-2xl hover:bg-gray-100 transition-colors"
          >
            {/* Face ID icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="9" cy="10" r="1" fill="currentColor" />
              <circle cx="15" cy="10" r="1" fill="currentColor" />
              <path d="M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
            </svg>
            Pay with Face ID
          </button>

          <p className="text-xs text-gray-500">Simulated payment for demonstration</p>
        </div>
      </div>
    );
  }

  // ── Biometric phase ──
  if (phase === "biometric") {
    return (
      <div className="bg-gray-950 -mx-6 -mb-6 -mt-2 px-6 py-12 rounded-b-2xl">
        <div className="flex flex-col items-center gap-6">
          {/* Pulsing circle with Face ID */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-white/20 animate-pulse" />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="9" cy="10" r="1" fill="white" />
              <circle cx="15" cy="10" r="1" fill="white" />
              <path d="M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">Confirming with Face ID...</p>
        </div>
      </div>
    );
  }

  // ── Success phase ──
  return (
    <div className="bg-gray-950 -mx-6 -mb-6 -mt-2 px-6 py-12 rounded-b-2xl">
      <div className="flex flex-col items-center gap-4">
        {/* Green checkmark */}
        <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">Payment successful</p>
        <p className="text-sm text-gray-400">{amount}</p>
      </div>
    </div>
  );
}
