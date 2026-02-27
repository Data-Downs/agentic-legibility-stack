"use client";

import { useState } from "react";
import { GenericFormCard } from "@/components/cards/GenericFormCard";
import { BankSelectorCard } from "@/components/cards/BankSelectorCard";
import type { CardDefinition } from "@als/schemas";

// All card definitions from the registry, rendered inline for preview
const ALL_CARDS: CardDefinition[] = [
  {
    cardType: "household-details",
    title: "Your housing situation",
    description: "We need to know about your housing to calculate your entitlement.",
    fields: [
      {
        key: "tenure_type",
        label: "What is your housing situation?",
        type: "radio",
        required: true,
        category: "housing",
        options: [
          { value: "private_renter", label: "Private renter" },
          { value: "council_tenant", label: "Council tenant" },
          { value: "homeowner", label: "Homeowner" },
          { value: "living_with_family", label: "Living with family" },
        ],
      },
      {
        key: "monthly_rent",
        label: "Monthly rent (£)",
        type: "currency",
        required: true,
        placeholder: "e.g. 650",
        category: "housing",
        validation: { min: 0, max: 10000 },
        showWhen: { field: "tenure_type", values: ["private_renter", "council_tenant"] },
      },
    ],
    submitLabel: "Confirm housing details",
    dataCategory: "housing",
  },
  {
    cardType: "financial-details",
    title: "Your income details",
    description: "Tell us about your income sources.",
    fields: [
      {
        key: "employment_status",
        label: "Employment status",
        type: "radio",
        required: true,
        category: "employment",
        options: [
          { value: "employed", label: "Employed" },
          { value: "self_employed", label: "Self-employed" },
          { value: "unemployed", label: "Unemployed" },
          { value: "unable_to_work", label: "Unable to work" },
        ],
      },
      {
        key: "monthly_income",
        label: "Monthly income (£)",
        type: "currency",
        required: false,
        placeholder: "e.g. 1200",
        category: "financial",
        validation: { min: 0 },
        showWhen: { field: "employment_status", values: ["employed", "self_employed"] },
      },
      {
        key: "savings_amount",
        label: "Total savings (£)",
        type: "currency",
        required: false,
        placeholder: "e.g. 500",
        category: "financial",
        validation: { min: 0 },
      },
    ],
    submitLabel: "Confirm income details",
    dataCategory: "financial",
  },
  {
    cardType: "bank-account-selector",
    title: "Payment account",
    description: "Choose which account you'd like payments sent to.",
    fields: [
      { key: "bank_name", label: "Bank name", type: "text", required: true, placeholder: "e.g. Barclays", category: "financial" },
      { key: "sort_code", label: "Sort code", type: "sort-code", required: true, placeholder: "e.g. 12-34-56", category: "financial" },
      { key: "account_number", label: "Account number", type: "account-number", required: true, placeholder: "e.g. 12345678", category: "financial" },
    ],
    submitLabel: "Confirm bank account",
    dataCategory: "financial",
  },
  {
    cardType: "license-details",
    title: "Licence details",
    description: "Confirm the details for your licence.",
    fields: [
      {
        key: "licence_type",
        label: "Licence type",
        type: "select",
        required: true,
        category: "licence",
        options: [
          { value: "standard", label: "Standard" },
          { value: "premium", label: "Premium" },
        ],
      },
      {
        key: "licence_duration",
        label: "Duration",
        type: "select",
        required: true,
        category: "licence",
        options: [
          { value: "1_day", label: "1 day" },
          { value: "1_year", label: "1 year" },
          { value: "3_year", label: "3 years" },
          { value: "lifetime", label: "Lifetime" },
        ],
      },
      { key: "start_date", label: "Start date", type: "date", required: true, category: "licence" },
    ],
    submitLabel: "Confirm licence details",
    dataCategory: "licence",
  },
  {
    cardType: "payment-card",
    title: "Make payment",
    description: "Confirm your payment details.",
    fields: [
      {
        key: "payment_method",
        label: "Payment method",
        type: "radio",
        required: true,
        category: "payment",
        options: [
          { value: "debit_card", label: "Debit card" },
          { value: "credit_card", label: "Credit card" },
          { value: "direct_debit", label: "Direct debit" },
        ],
      },
    ],
    submitLabel: "Confirm payment",
    dataCategory: "payment",
  },
  {
    cardType: "registration-details",
    title: "Registration details",
    description: "Provide the details needed for your registration.",
    fields: [
      { key: "registration_reference", label: "Reference number (if you have one)", type: "text", required: false, placeholder: "e.g. REF-12345", category: "registration" },
    ],
    submitLabel: "Submit registration details",
    dataCategory: "registration",
  },
  {
    cardType: "portal-action",
    title: "What would you like to do?",
    description: "Choose an action to perform on your account.",
    fields: [
      {
        key: "action_type",
        label: "Action",
        type: "radio",
        required: true,
        category: "portal",
        options: [
          { value: "report_change", label: "Report a change of circumstances" },
          { value: "upload_document", label: "Upload a document" },
          { value: "send_message", label: "Send a message to your work coach" },
          { value: "view_statement", label: "View your payment statement" },
        ],
      },
      { key: "action_details", label: "Details", type: "text", required: false, placeholder: "Any additional details...", category: "portal" },
    ],
    submitLabel: "Continue",
    dataCategory: "portal",
  },
  {
    cardType: "change-of-circumstances",
    title: "Report a change",
    description: "Tell us what has changed.",
    fields: [
      {
        key: "change_type",
        label: "What has changed?",
        type: "radio",
        required: true,
        category: "portal",
        options: [
          { value: "address", label: "Address" },
          { value: "income", label: "Income" },
          { value: "household", label: "Household members" },
          { value: "health", label: "Health condition" },
          { value: "other", label: "Something else" },
        ],
      },
      { key: "change_details", label: "Tell us more", type: "text", required: true, placeholder: "Describe the change...", category: "portal" },
    ],
    submitLabel: "Report change",
    dataCategory: "portal",
  },
  {
    cardType: "slot-picker",
    title: "Choose an appointment",
    description: "Select a date and time for your appointment.",
    fields: [
      { key: "appointment_date", label: "Preferred date", type: "date", required: true, category: "appointment" },
      {
        key: "appointment_time",
        label: "Preferred time",
        type: "select",
        required: true,
        category: "appointment",
        options: [
          { value: "09:00", label: "9:00 AM" },
          { value: "10:00", label: "10:00 AM" },
          { value: "11:00", label: "11:00 AM" },
          { value: "13:00", label: "1:00 PM" },
          { value: "14:00", label: "2:00 PM" },
          { value: "15:00", label: "3:00 PM" },
        ],
      },
      {
        key: "appointment_location",
        label: "Location",
        type: "select",
        required: true,
        category: "appointment",
        options: [
          { value: "nearest", label: "Nearest available" },
          { value: "specific", label: "Specific location" },
        ],
      },
    ],
    submitLabel: "Book appointment",
    dataCategory: "appointment",
  },
  {
    cardType: "payment-amount",
    title: "Amount due",
    description: "Review the amount you need to pay.",
    fields: [
      { key: "amount_due", label: "Amount", type: "readonly", required: false, category: "payment" },
    ],
    submitLabel: "Proceed to payment",
    dataCategory: "payment",
  },
  {
    cardType: "checklist-progress",
    title: "Your progress",
    description: "Check off each step as you complete it.",
    fields: [
      {
        key: "steps_completed",
        label: "Steps",
        type: "checklist",
        required: false,
        category: "task_list",
        options: [
          { value: "step_1", label: "Step 1 — Apply for provisional licence" },
          { value: "step_2", label: "Step 2 — Book theory test" },
          { value: "step_3", label: "Step 3 — Take practical test" },
        ],
      },
    ],
    submitLabel: "Update progress",
    dataCategory: "task_list",
  },
  {
    cardType: "decision-helper",
    title: "Your options",
    description: "Review the available options and choose one.",
    fields: [
      {
        key: "selected_option",
        label: "Choose an option",
        type: "radio",
        required: true,
        category: "informational",
        options: [
          { value: "option_a", label: "Option A — Apply directly online" },
          { value: "option_b", label: "Option B — Get help from an adviser" },
          { value: "need_more_info", label: "I need more information" },
        ],
      },
    ],
    submitLabel: "Continue",
    dataCategory: "informational",
  },
];

const INTERACTION_LABELS: Record<string, { label: string; cards: string[] }> = {
  application: { label: "Application (e.g. Universal Credit, PIP, Child Benefit)", cards: ["household-details", "financial-details", "bank-account-selector"] },
  license: { label: "License (e.g. Fishing licence, Driving licence)", cards: ["license-details", "payment-card"] },
  register: { label: "Register (e.g. Voter registration, Birth registration)", cards: ["registration-details"] },
  portal: { label: "Portal (e.g. UC journal, HMRC tax account)", cards: ["portal-action", "change-of-circumstances"] },
  appointment_booker: { label: "Appointment Booker (e.g. Driving test, Prison visit)", cards: ["slot-picker"] },
  payment_service: { label: "Payment Service (e.g. Vehicle tax, Self assessment)", cards: ["payment-amount", "payment-card"] },
  task_list: { label: "Task List (e.g. Learn to drive, Set up limited company)", cards: ["checklist-progress"] },
  informational_hub: { label: "Informational Hub (e.g. Travel advice, Get into teaching)", cards: ["decision-helper"] },
};

export default function CardsTestPage() {
  const [submissions, setSubmissions] = useState<Record<string, Record<string, unknown>>>({});

  const handleSubmit = (cardType: string, fields: Record<string, string | number | boolean>) => {
    setSubmissions((prev) => ({ ...prev, [cardType]: fields }));
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-govuk-black">Card Gallery — All Card Types</h1>
          <p className="text-sm text-govuk-dark-grey mt-1">
            {ALL_CARDS.length} card definitions across {Object.keys(INTERACTION_LABELS).length} interaction types. Submit any card to see the captured data below it.
          </p>
        </div>

        {Object.entries(INTERACTION_LABELS).map(([type, { label, cards: cardTypes }]) => (
          <div key={type} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-white bg-govuk-blue px-2 py-1 rounded">
                {type}
              </span>
              <span className="text-sm font-medium text-govuk-black">{label}</span>
            </div>

            {cardTypes.map((ct) => {
              const def = ALL_CARDS.find((c) => c.cardType === ct);
              if (!def) return null;
              const submitted = submissions[ct];

              return (
                <div key={ct} className="mb-6">
                  {/* Card type label */}
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">
                      {ct}
                    </code>
                    {submitted && (
                      <span className="text-xs text-green-700 font-medium">Submitted</span>
                    )}
                  </div>

                  {/* Card wrapper — mimics ChatView card shell */}
                  <div
                    className={`rounded-2xl border bg-white ${submitted ? "border-green-200 opacity-80" : "border-gray-200"}`}
                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                  >
                    <div className="px-5 py-5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          {submitted ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00703c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00703c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm font-bold text-green-700">
                          {submitted ? "Done" : "You"}
                        </span>
                      </div>

                      <p className={`text-base font-medium ${submitted ? "text-govuk-dark-grey" : "text-govuk-black"}`}>
                        {def.title}
                      </p>

                      {submitted ? (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                          <p className="text-sm font-medium text-green-700 mb-2">Details confirmed</p>
                          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto text-govuk-black">
                            {JSON.stringify(submitted, null, 2)}
                          </pre>
                          <button
                            onClick={() => setSubmissions((prev) => { const next = { ...prev }; delete next[ct]; return next; })}
                            className="mt-2 text-xs text-govuk-blue underline hover:no-underline"
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3">
                          {ct === "bank-account-selector" ? (
                            <BankSelectorCard
                              definition={def}
                              onSubmit={(fields) => handleSubmit(ct, fields)}
                            />
                          ) : (
                            <GenericFormCard
                              definition={def}
                              onSubmit={(fields) => handleSubmit(ct, fields)}
                              prefillData={ct === "payment-amount" ? { amount_due: "£127.50" } : undefined}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
