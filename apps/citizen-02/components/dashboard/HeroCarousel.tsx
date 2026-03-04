"use client";

import { useRef, useState, useCallback } from "react";
import type { PersonaData } from "@/lib/types";
import { DEMO_TODAY } from "@/lib/types";
import { UrgencyDot } from "../ui/UrgencyDot";

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const diff = target.getTime() - DEMO_TODAY.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface HeroCard {
  id: string;
  title: string;
  subtitle: string;
  stats: Array<{ label: string; value: string; urgency?: "urgent" | "warning" | "ok" }>;
  service: string;
}

function buildHeroCards(data: PersonaData): HeroCard[] {
  const cards: HeroCard[] = [];

  // Vehicle cards
  if (data.vehicles) {
    for (const v of data.vehicles) {
      const motDays = v.motExpiry ? daysUntil(v.motExpiry) : null;
      const taxDays = v.taxExpiry ? daysUntil(v.taxExpiry) : null;
      const stats: HeroCard["stats"] = [];
      if (motDays !== null) {
        stats.push({
          label: "MOT",
          value: motDays < 0 ? "Expired" : `${motDays} days`,
          urgency: motDays < 0 ? "urgent" : motDays < 30 ? "warning" : "ok",
        });
      }
      if (taxDays !== null) {
        stats.push({
          label: "Tax",
          value: taxDays < 0 ? "Expired" : `${taxDays} days`,
          urgency: taxDays < 0 ? "urgent" : taxDays < 30 ? "warning" : "ok",
        });
      }
      cards.push({
        id: `vehicle-${v.registrationNumber}`,
        title: `${v.make} ${v.model}`,
        subtitle: v.registrationNumber,
        stats,
        service: "driving",
      });
    }
  }

  // Benefits / pension cards
  const financials = data.financials as Record<string, unknown> | undefined;
  if (financials?.statePension) {
    const sp = financials.statePension as Record<string, unknown>;
    cards.push({
      id: "state-pension",
      title: "State Pension",
      subtitle: sp.type as string || "State Pension",
      stats: [
        { label: "Weekly", value: sp.weeklyAmount ? `£${sp.weeklyAmount}` : "Active", urgency: "ok" },
      ],
      service: "benefits",
    });
  }
  if (data.benefits?.currentlyReceiving) {
    for (const b of data.benefits.currentlyReceiving) {
      cards.push({
        id: `benefit-${b.type}`,
        title: b.type,
        subtitle: `£${b.amount}/${b.frequency}`,
        stats: [
          { label: "Amount", value: `£${b.amount}`, urgency: "ok" },
        ],
        service: "benefits",
      });
    }
  }

  // Pregnancy card
  if (data.pregnancy?.dueDate) {
    const days = daysUntil(data.pregnancy.dueDate);
    const weeks = Math.floor(days / 7);
    cards.push({
      id: "pregnancy",
      title: "Baby due",
      subtitle: data.pregnancy.hospital || "",
      stats: [
        {
          label: "Due in",
          value: weeks > 0 ? `${weeks} weeks` : `${days} days`,
          urgency: days < 60 ? "warning" : "ok",
        },
      ],
      service: "family",
    });
  }

  // Children cards
  if (data.children && data.children.length > 0 && !data.pregnancy) {
    cards.push({
      id: "children",
      title: `${data.children.length} ${data.children.length === 1 ? "child" : "children"}`,
      subtitle: data.children.map((c) => c.firstName).join(", "),
      stats: [],
      service: "family",
    });
  }

  return cards;
}

interface HeroCarouselProps {
  personaData: PersonaData;
  filterService?: string;
  onCardTap?: (service: string) => void;
}

export function HeroCarousel({ personaData, filterService, onCardTap }: HeroCarouselProps) {
  const allCards = buildHeroCards(personaData);
  const cards = filterService ? allCards.filter((c) => c.service === filterService) : allCards;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const cardWidth = el.firstElementChild?.clientWidth || 1;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.max(0, Math.min(idx, cards.length - 1)));
  }, [cards.length]);

  if (cards.length === 0) return null;

  return (
    <div className="mb-5">
      {/* Carousel track */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scroll-snap-x scroll-momentum pb-2 -mx-4 px-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => onCardTap?.(card.service)}
            className="min-w-[260px] max-w-[300px] flex-shrink-0 scroll-snap-item bg-white rounded-card p-4 text-left touch-feedback transition-shadow hover:shadow-md"
          >
            <div className="mb-2">
              <h3 className="font-bold text-govuk-black text-base">{card.title}</h3>
              <p className="text-sm text-govuk-dark-grey">{card.subtitle}</p>
            </div>
            {card.stats.length > 0 && (
              <div className="flex gap-4 mt-3">
                {card.stats.map((stat, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {stat.urgency && <UrgencyDot urgency={stat.urgency} />}
                    <div>
                      <p className="text-xs text-govuk-dark-grey">{stat.label}</p>
                      <p className={`text-sm font-bold ${
                        stat.urgency === "urgent" ? "text-govuk-red" :
                        stat.urgency === "warning" ? "text-govuk-orange" :
                        "text-govuk-black"
                      }`}>{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Pagination dots */}
      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {cards.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === activeIndex ? "bg-govuk-blue w-4" : "bg-govuk-mid-grey"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
