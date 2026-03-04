import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock child components that would need their own complex setup
vi.mock("./dashboard/UnifiedTimeline", () => ({
  UnifiedTimeline: () => <div data-testid="unified-timeline" />,
}));
vi.mock("./dashboard/NearYouSection", () => ({
  NearYouSection: () => <div data-testid="near-you-section" />,
}));

const mockNavigateTo = vi.fn();
const mockStartNewConversation = vi.fn();
const mockStartPlan = vi.fn();
const mockLoadPlan = vi.fn();
const mockOpenBottomSheet = vi.fn();

// Mock store with persona data
const mockPersonaData = {
  personaId: "emma",
  personaName: "Emma Parker",
  primaryContact: { firstName: "Emma", lastName: "Parker", dateOfBirth: "1992-03-15" },
  address: { line1: "12 Maple Road", city: "Manchester", postcode: "M1 4BH" },
  vehicles: [{ make: "Ford", model: "Fiesta", registration: "AB12 CDE" }],
  benefits: { currentlyReceiving: [{ type: "Child Benefit", amount: 96.2, frequency: "weekly" }] },
  employment: { status: "employed", employer: "TechCo" },
  financials: { monthlyRent: 650 },
};

vi.mock("@/lib/store", () => ({
  useAppStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => {
      const state: Record<string, unknown> = {
        personaData: mockPersonaData,
        persona: "emma",
        enrichedData: null,
        navigateTo: mockNavigateTo,
        startNewConversation: mockStartNewConversation,
        startPlan: mockStartPlan,
        loadPlan: mockLoadPlan,
        openBottomSheet: mockOpenBottomSheet,
      };
      return selector(state);
    },
    {
      getState: () => ({
        loadConversation: vi.fn(),
      }),
      setState: vi.fn(),
      subscribe: vi.fn(),
    }
  ),
  getConversations: vi.fn().mockReturnValue([]),
  getActivePlans: vi.fn().mockReturnValue([]),
}));

import { Dashboard } from "./Dashboard";

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock fetch for life-events
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ lifeEvents: [] }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders greeting with persona first name", () => {
    render(<Dashboard />);
    expect(screen.getByText("Hello, Emma")).toBeInTheDocument();
  });

  it("shows relevant topics based on persona data", () => {
    render(<Dashboard />);
    // Emma has vehicles → driving should show
    expect(screen.getByText("Driving & Transport")).toBeInTheDocument();
    // Emma has benefits → benefits should show
    expect(screen.getByText("Benefits")).toBeInTheDocument();
    // Emma has employment → employment should show
    expect(screen.getByText("Employment")).toBeInTheDocument();
    // Emma has financials → money should show
    expect(screen.getByText("Money & Tax")).toBeInTheDocument();
  });

  it("shows Browse topics button", () => {
    render(<Dashboard />);
    expect(screen.getByText("Browse topics")).toBeInTheDocument();
  });

  it("opens Browse topics overlay when clicked", () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByText("Browse topics"));
    // Overlay should show "Add topics to your homepage" text
    expect(screen.getByText(/Add topics to your homepage/)).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("closes Browse topics overlay with Back button", () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByText("Browse topics"));
    expect(screen.getByText(/Add topics to your homepage/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back"));
    expect(screen.queryByText(/Add topics to your homepage/)).not.toBeInTheDocument();
  });

  it("navigates to detail view when topic clicked", () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByText("Driving & Transport"));
    expect(mockNavigateTo).toHaveBeenCalledWith("detail", "driving", "Driving & Transport");
  });
});
