"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TestUserPicker from "@/components/auth/TestUserPicker";
import WalletView from "@/components/wallet/WalletView";

export default function AuthPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"picking" | "authenticating" | "authenticated">("picking");
  const [sessionData, setSessionData] = useState<{
    sessionToken: string;
    user: {
      id: string;
      name: string;
      credentials: Array<{ type: string; issuer: string; number?: string; status: string; expires?: string }>;
    };
  } | null>(null);

  async function handleUserSelect(userId: string) {
    setAuthState("authenticating");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();

      if (data.sessionToken) {
        setSessionData(data);
        setAuthState("authenticated");

        // Store in sessionStorage for the app
        sessionStorage.setItem("als_session_token", data.sessionToken);
        sessionStorage.setItem("als_identity_user", JSON.stringify(data.user));
      }
    } catch {
      setAuthState("picking");
    }
  }

  function handleContinue() {
    router.push("/");
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <div className="bg-govuk-blue text-white p-6 -mx-6 -mt-6 mb-6">
        <div className="text-sm font-bold mb-1">GOV.UK One Login</div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm opacity-80 mt-1">Simulated authentication for the Agentic Legibility Stack</p>
      </div>

      {authState === "picking" && (
        <TestUserPicker onSelect={handleUserSelect} />
      )}

      {authState === "authenticating" && (
        <div className="text-center py-12">
          <div className="text-lg font-bold mb-2">Verifying identity...</div>
          <div className="text-sm text-gray-500">Simulating GOV.UK One Login authentication</div>
        </div>
      )}

      {authState === "authenticated" && sessionData && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-600 text-lg">&#10003;</span>
              <span className="font-bold">Identity verified</span>
            </div>
            <p className="text-sm text-gray-600">
              Signed in as <strong>{sessionData.user.name}</strong>
            </p>
          </div>

          <WalletView
            credentials={sessionData.user.credentials}
            userName={sessionData.user.name}
          />

          <button
            onClick={handleContinue}
            className="w-full bg-govuk-green text-white py-3 rounded font-bold text-lg hover:opacity-90"
          >
            Continue to services
          </button>
        </div>
      )}
    </div>
  );
}
