"use client";

import { useState, useCallback } from "react";
import type { CardRequest, CardSubmission } from "@als/schemas";
import { useAppStore } from "@/lib/store";
import { GenericFormCard } from "./GenericFormCard";
import { BankSelectorCard } from "./BankSelectorCard";

interface CardHostProps {
  cardRequests: CardRequest[];
  onAllSubmitted: (summaryMessage: string) => void;
  disabled?: boolean;
}

/**
 * CardHost orchestrates rendering and submission of multiple cards.
 * Each card submits directly to Tier 2 via /api/personal-data/[personaId]/card-submit.
 * When all cards are submitted, sends a summary message to chat.
 */
export function CardHost({ cardRequests, onAllSubmitted, disabled }: CardHostProps) {
  const persona = useAppStore((s) => s.persona);
  const [submissions, setSubmissions] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const isCardSubmitted = (cardType: string) => submissions[cardType] === true;
  const isCardSubmitting = (cardType: string) => submitting[cardType] === true;

  const handleCardSubmit = useCallback(
    async (card: CardRequest, fields: Record<string, string | number | boolean>) => {
      if (!persona) return;

      setSubmitting((prev) => ({ ...prev, [card.cardType]: true }));

      try {
        const submission: CardSubmission = {
          cardType: card.cardType,
          serviceId: card.serviceId,
          stateId: card.stateId,
          fields,
        };

        const res = await fetch(`/api/personal-data/${persona}/card-submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submission),
        });

        if (!res.ok) {
          console.error("Card submit failed:", await res.text());
          return;
        }

        setSubmissions((prev) => {
          const next = { ...prev, [card.cardType]: true };

          // Check if all cards are now submitted
          const allDone = cardRequests.every((cr) => next[cr.cardType] === true);
          if (allDone) {
            // Build summary message for chat
            const categories = [...new Set(cardRequests.map((cr) => cr.definition.dataCategory))];
            const msg = `I've provided my ${categories.join(", ")} details.`;
            // Defer to avoid state update during render
            setTimeout(() => onAllSubmitted(msg), 0);
          }

          return next;
        });
      } catch (err) {
        console.error("Card submit error:", err);
      } finally {
        setSubmitting((prev) => ({ ...prev, [card.cardType]: false }));
      }
    },
    [persona, cardRequests, onAllSubmitted],
  );

  if (cardRequests.length === 0) return null;

  return (
    <div className="space-y-3">
      {cardRequests.map((card) => {
        const submitted = isCardSubmitted(card.cardType);
        const isSubmittingCard = isCardSubmitting(card.cardType);

        return (
          <div
            key={card.cardType}
            className={`rounded-2xl border bg-white transition-opacity ${
              submitted ? "border-green-200 opacity-80" : "border-gray-200"
            }`}
            style={{
              boxShadow: submitted
                ? "0 2px 8px rgba(0,112,60,0.08)"
                : "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div className="px-5 py-5">
              {/* Card header */}
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    submitted ? "bg-green-100" : "bg-green-100"
                  }`}
                >
                  {submitted ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#00703c"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#00703c"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </span>
                <span className={`text-sm font-bold ${submitted ? "text-green-700" : "text-green-700"}`}>
                  {submitted ? "Done" : "You"}
                </span>
              </div>

              {/* Card title */}
              <p className={`text-base font-medium ${submitted ? "text-govuk-dark-grey" : "text-govuk-black"}`}>
                {card.definition.title}
              </p>

              {/* Submitted confirmation */}
              {submitted && (
                <div className="mt-3 flex items-center border-t border-gray-200 pt-3">
                  <span className="text-sm font-medium text-green-700">
                    Details confirmed
                  </span>
                </div>
              )}

              {/* Card form */}
              {!submitted && (
                <div className="mt-3">
                  {card.definition.cardType === "bank-account-selector" ? (
                    <BankSelectorCard
                      definition={card.definition}
                      onSubmit={(fields) => handleCardSubmit(card, fields)}
                      disabled={disabled || isSubmittingCard}
                    />
                  ) : (
                    <GenericFormCard
                      definition={card.definition}
                      onSubmit={(fields) => handleCardSubmit(card, fields)}
                      disabled={disabled || isSubmittingCard}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
