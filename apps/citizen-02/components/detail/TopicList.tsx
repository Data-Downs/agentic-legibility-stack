"use client";

import { useAppStore } from "@/lib/store";

interface Topic {
  id: string;
  label: string;
  questions: string[];
}

const SERVICE_TOPICS: Record<string, Topic[]> = {
  driving: [
    { id: "mot", label: "Vehicle maintenance & MOT", questions: [
      "When is my MOT due and what do I need to prepare?",
      "What happens if my MOT has expired?",
      "How do I find an MOT testing centre near me?",
    ]},
    { id: "tax", label: "Road tax & SORN", questions: [
      "How do I renew my road tax?",
      "Can I get a refund on my road tax?",
      "What is a SORN and when do I need one?",
    ]},
    { id: "licence", label: "Driving licence", questions: [
      "How do I renew my driving licence?",
      "How do I change the address on my licence?",
      "What documents do I need for a provisional licence?",
    ]},
    { id: "insurance", label: "Insurance", questions: [
      "What type of car insurance do I need?",
      "How do I check if a vehicle is insured?",
      "What happens if I drive without insurance?",
    ]},
  ],
  benefits: [
    { id: "uc", label: "Universal Credit", questions: [
      "Am I eligible for Universal Credit?",
      "How do I make a Universal Credit claim?",
      "What happens at my first work coach appointment?",
    ]},
    { id: "pension", label: "State Pension", questions: [
      "When can I claim my State Pension?",
      "How much State Pension will I get?",
      "Can I defer my State Pension?",
    ]},
    { id: "disability", label: "Disability benefits", questions: [
      "What disability benefits am I entitled to?",
      "How do I apply for PIP?",
      "What's the difference between PIP and DLA?",
    ]},
    { id: "housing", label: "Housing benefit", questions: [
      "Am I eligible for Housing Benefit?",
      "How do I apply for council tax reduction?",
      "What help is available with energy bills?",
    ]},
  ],
  family: [
    { id: "maternity", label: "Maternity & paternity", questions: [
      "What maternity pay am I entitled to?",
      "How do I claim Statutory Maternity Pay?",
      "When should I tell my employer I'm pregnant?",
    ]},
    { id: "childben", label: "Child Benefit", questions: [
      "How do I claim Child Benefit?",
      "Do I need to pay back Child Benefit?",
      "When does Child Benefit stop?",
    ]},
    { id: "birth", label: "Registering a birth", questions: [
      "How do I register my baby's birth?",
      "What documents do I need for birth registration?",
      "How long do I have to register a birth?",
    ]},
    { id: "schools", label: "Schools & childcare", questions: [
      "How do I apply for a school place?",
      "Am I eligible for free childcare?",
      "What's the Tax-Free Childcare scheme?",
    ]},
  ],
};

interface TopicListProps {
  service: string;
}

export function TopicList({ service }: TopicListProps) {
  const openBottomSheet = useAppStore((s) => s.openBottomSheet);
  const topics = SERVICE_TOPICS[service] || [];

  if (topics.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="text-base font-extrabold text-govuk-black mb-3">Topics</h3>
      <div className="bg-white rounded-card shadow-sm divide-y divide-gray-100">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => openBottomSheet("topic-questions", {
              topic: topic.label,
              questions: topic.questions,
              service,
            })}
            className="flex items-center gap-3 w-full p-3.5 text-left hover:bg-gray-50 transition-colors touch-feedback first:rounded-t-card last:rounded-b-card"
          >
            <span className="flex-1 text-sm font-medium text-govuk-black">{topic.label}</span>
            <svg className="shrink-0 text-govuk-mid-grey" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
