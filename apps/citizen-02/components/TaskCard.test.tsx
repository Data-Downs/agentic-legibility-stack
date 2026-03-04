import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TaskCard } from "./TaskCard";

// Mutable store state — tests can override personaData before rendering
let mockStoreState: Record<string, unknown> = { personaData: null };

// Mock Zustand store
vi.mock("@/lib/store", () => ({
  useAppStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector(mockStoreState),
    {
      getState: () => mockStoreState,
      setState: vi.fn(),
      subscribe: vi.fn(),
    }
  ),
}));

// Mock URL.createObjectURL for calendar tests
vi.stubGlobal("URL", {
  ...globalThis.URL,
  createObjectURL: vi.fn(() => "blob:mock"),
  revokeObjectURL: vi.fn(),
});

describe("TaskCard", () => {
  const baseTask = {
    id: "t1",
    description: "Check eligibility",
    detail: "We will check your eligibility for UC",
    type: "agent" as const,
  };

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = { personaData: null };
  });

  it("renders agent task with Agent badge", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Check eligibility")).toBeInTheDocument();
    expect(screen.getByText("Do this")).toBeInTheDocument();
  });

  it("renders user task with You badge", () => {
    const userTask = { ...baseTask, type: "user" as const };
    render(<TaskCard task={userTask} />);
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("calls onComplete when agent task button clicked", () => {
    const onComplete = vi.fn();
    render(<TaskCard task={baseTask} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Do this"));
    expect(onComplete).toHaveBeenCalledWith("t1", "Please proceed with: Check eligibility");
  });

  it("renders date reminder variant with calendar and dismiss buttons", () => {
    const dateTask = {
      ...baseTask,
      type: "user" as const,
      dueDate: "2026-03-15",
      dataNeeded: undefined,
    };
    render(<TaskCard task={dateTask} />);
    expect(screen.getByText("Add to calendar")).toBeInTheDocument();
    expect(screen.getByText("Ask agent")).toBeInTheDocument();
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("dismiss calls onComplete with dismiss message", () => {
    const onComplete = vi.fn();
    const dateTask = {
      ...baseTask,
      type: "user" as const,
      dueDate: "2026-03-15",
    };
    render(<TaskCard task={dateTask} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(onComplete).toHaveBeenCalledWith("t1", "Dismissed: Check eligibility");
  });

  it("renders checkbox options when task has options", () => {
    const optionTask = {
      ...baseTask,
      type: "user" as const,
      options: [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
      ],
    };
    render(<TaskCard task={optionTask} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("submits selected options", () => {
    const onComplete = vi.fn();
    const optionTask = {
      ...baseTask,
      type: "user" as const,
      options: [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
      ],
    };
    render(<TaskCard task={optionTask} onComplete={onComplete} />);

    // Check "Option A"
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByText("Continue"));

    expect(onComplete).toHaveBeenCalledWith("t1", "Selected: Option A");
  });

  it("shows completed state with Submitted badge and Change button", () => {
    const completion = "Email address: test@example.com\nPhone number: 07700 900000";
    const { container } = render(
      <TaskCard
        task={baseTask}
        completion={completion}
        onReset={vi.fn()}
      />
    );
    expect(container.textContent).toContain("Submitted");
    expect(container.textContent).toContain("Change");
    // Table renders structured data
    expect(container.textContent).toContain("Email address");
    expect(container.textContent).toContain("test@example.com");
  });

  it("calls onReset when Change button clicked", () => {
    const onReset = vi.fn();
    render(
      <TaskCard
        task={baseTask}
        completion="Done"
        onReset={onReset}
      />
    );
    fireEvent.click(screen.getByText("Change"));
    expect(onReset).toHaveBeenCalledWith("t1");
  });

  it("hides Change button when disabled", () => {
    render(
      <TaskCard
        task={baseTask}
        completion="Done"
        disabled
      />
    );
    expect(screen.queryByText("Change")).not.toBeInTheDocument();
  });

  it("renders freeform textarea for user tasks with no fields/options", () => {
    const freeformTask = {
      id: "t2",
      description: "Tell us more",
      detail: "Please provide details",
      type: "user" as const,
    };
    render(<TaskCard task={freeformTask} />);
    expect(screen.getByPlaceholderText("Type your response here...")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  it("infers form fields from description text", () => {
    const fieldTask = {
      id: "t3",
      description: "Provide your bank details",
      detail: "We need your sort code and account number",
      type: "user" as const,
    };
    render(<TaskCard task={fieldTask} />);
    expect(screen.getByText("Sort code")).toBeInTheDocument();
    expect(screen.getByText("Account number")).toBeInTheDocument();
  });

  // ── Smart interaction inference tests ──

  it("renders person-selection radio buttons when task mentions people from persona", () => {
    mockStoreState = {
      personaData: {
        primaryContact: { firstName: "Mary", lastName: "Summers" },
        family: {
          dependents: [
            { firstName: "Margaret", lastName: "Evans", relationship: "Mary's mother" },
          ],
        },
      },
    };
    const task = {
      id: "t4",
      description: "Who is this for?",
      detail: "Let me know if this is for yourself (Mary) or your mother Margaret",
      type: "user" as const,
    };
    render(<TaskCard task={task} />);
    expect(screen.getByText("Myself (Mary Summers)")).toBeInTheDocument();
    expect(screen.getByText("Margaret Evans (Mary's mother)")).toBeInTheDocument();
    expect(screen.getByText("Someone else")).toBeInTheDocument();
    // Should NOT show a textarea
    expect(screen.queryByPlaceholderText("Type your response here...")).not.toBeInTheDocument();
  });

  it("renders Yes/No radio buttons for confirmation questions", () => {
    const task = {
      id: "t5",
      description: "Confirm details",
      detail: "Would you like to proceed with this application?",
      type: "user" as const,
    };
    render(<TaskCard task={task} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Type your response here...")).not.toBeInTheDocument();
  });

  it("reveals text input when 'Someone else' is selected", () => {
    mockStoreState = {
      personaData: {
        primaryContact: { firstName: "Mary", lastName: "Summers" },
        family: {
          dependents: [
            { firstName: "Margaret", lastName: "Evans", relationship: "Mary's mother" },
          ],
        },
      },
    };
    const task = {
      id: "t6",
      description: "Who is this for?",
      detail: "Is this for yourself (Mary) or Margaret?",
      type: "user" as const,
    };
    render(<TaskCard task={task} />);
    // Click "Someone else"
    fireEvent.click(screen.getByText("Someone else"));
    expect(screen.getByPlaceholderText("Please specify...")).toBeInTheDocument();
  });

  it("submits smart selection with Selected: prefix", () => {
    mockStoreState = {
      personaData: {
        primaryContact: { firstName: "Mary", lastName: "Summers" },
        family: {
          dependents: [
            { firstName: "Margaret", lastName: "Evans", relationship: "Mary's mother" },
          ],
        },
      },
    };
    const onComplete = vi.fn();
    const task = {
      id: "t7",
      description: "Who is this for?",
      detail: "Is this for yourself (Mary) or Margaret?",
      type: "user" as const,
    };
    render(<TaskCard task={task} onComplete={onComplete} />);
    // Select "Myself"
    fireEvent.click(screen.getByText("Myself (Mary Summers)"));
    fireEvent.click(screen.getByText("Continue"));
    expect(onComplete).toHaveBeenCalledWith("t7", "Selected: Myself (Mary Summers)");
  });

  it("still renders freeform textarea when no patterns match", () => {
    const task = {
      id: "t8",
      description: "Tell us more",
      detail: "Describe your situation in detail",
      type: "user" as const,
    };
    render(<TaskCard task={task} />);
    expect(screen.getByPlaceholderText("Type your response here...")).toBeInTheDocument();
  });

  // ── LLM fields tests ──

  it("renders text inputs from LLM fields with correct labels", () => {
    const task = {
      id: "tf1",
      description: "Provide your LISA details",
      detail: "We need your LISA info",
      type: "user" as const,
      fields: [
        { key: "account_holder", label: "Account holder name", type: "text" as const, prefill: "Thomas Summers" },
        { key: "lisa_provider", label: "LISA provider", type: "text" as const, placeholder: "e.g. Hargreaves Lansdown" },
      ],
    };
    render(<TaskCard task={task} />);
    expect(screen.getByText("Account holder name")).toBeInTheDocument();
    expect(screen.getByText("LISA provider")).toBeInTheDocument();
    // Prefill should populate value
    expect(screen.getByDisplayValue("Thomas Summers")).toBeInTheDocument();
  });

  it("renders currency field with £ prefix", () => {
    const task = {
      id: "tf2",
      description: "Provide property details",
      detail: "Enter the price",
      type: "user" as const,
      fields: [
        { key: "property_price", label: "Property price", type: "currency" as const, placeholder: "e.g. 350000" },
      ],
    };
    render(<TaskCard task={task} />);
    expect(screen.getByText("Property price")).toBeInTheDocument();
    expect(screen.getByText("£")).toBeInTheDocument();
  });

  it("renders confirm field as checkbox", () => {
    const task = {
      id: "tf3",
      description: "Confirm details",
      detail: "Check the box",
      type: "user" as const,
      fields: [
        { key: "first_time_buyer", label: "First-time buyer", type: "confirm" as const },
      ],
    };
    render(<TaskCard task={task} />);
    expect(screen.getByText("First-time buyer")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("renders select field as dropdown", () => {
    const task = {
      id: "tf4",
      description: "Choose provider",
      detail: "Select your ISA provider",
      type: "user" as const,
      fields: [
        {
          key: "provider",
          label: "ISA provider",
          type: "select" as const,
          options: [
            { value: "hl", label: "Hargreaves Lansdown" },
            { value: "aj", label: "AJ Bell" },
          ],
        },
      ],
    };
    render(<TaskCard task={task} />);
    expect(screen.getByText("ISA provider")).toBeInTheDocument();
    expect(screen.getByText("Hargreaves Lansdown")).toBeInTheDocument();
    expect(screen.getByText("AJ Bell")).toBeInTheDocument();
  });

  it("submits LLM fields with structured message including £ prefix for currency", () => {
    const onComplete = vi.fn();
    const task = {
      id: "tf5",
      description: "Provide your LISA details",
      detail: "Enter info",
      type: "user" as const,
      fields: [
        { key: "account_holder", label: "Account holder name", type: "text" as const, prefill: "Thomas" },
        { key: "property_price", label: "Property price", type: "currency" as const },
        { key: "first_time_buyer", label: "First-time buyer", type: "confirm" as const },
      ],
    };
    render(<TaskCard task={task} onComplete={onComplete} />);

    // Change property price — find by the input inside the currency field (second textbox after prefilled one)
    const textboxes = screen.getAllByRole("textbox");
    const priceInput = textboxes[1]; // second textbox is the currency input
    fireEvent.change(priceInput, { target: { value: "350000" } });

    // Check confirm
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByText("Submit"));
    expect(onComplete).toHaveBeenCalledWith("tf5", expect.stringContaining("Account holder name: Thomas"));
    expect(onComplete).toHaveBeenCalledWith("tf5", expect.stringContaining("Property price: £350000"));
    expect(onComplete).toHaveBeenCalledWith("tf5", expect.stringContaining("First-time buyer: Yes"));
  });

  it("LLM fields take priority over options, dataNeeded, and smart inference", () => {
    mockStoreState = {
      personaData: {
        primaryContact: { firstName: "Mary", lastName: "Summers" },
      },
    };
    const task = {
      id: "tf6",
      description: "Who is this for Mary?",
      detail: "Tell us about yourself Mary",
      type: "user" as const,
      dataNeeded: ["email", "phone"],
      options: [
        { value: "self", label: "Myself" },
        { value: "other", label: "Someone else" },
      ],
      fields: [
        { key: "name", label: "Full name", type: "text" as const },
      ],
    };
    render(<TaskCard task={task} />);
    // LLM fields should render, not options or dataNeeded fields
    expect(screen.getByText("Full name")).toBeInTheDocument();
    expect(screen.queryByText("Myself")).not.toBeInTheDocument();
    expect(screen.queryByText("Email address")).not.toBeInTheDocument();
  });

  it("does not show freeform textarea when LLM fields are present", () => {
    const task = {
      id: "tf7",
      description: "Tell us more",
      detail: "Provide details",
      type: "user" as const,
      fields: [
        { key: "details", label: "Extra details", type: "text" as const },
      ],
    };
    render(<TaskCard task={task} />);
    expect(screen.queryByPlaceholderText("Type your response here...")).not.toBeInTheDocument();
    expect(screen.getByText("Extra details")).toBeInTheDocument();
  });

  it("prefill populates initial values for LLM fields", () => {
    const task = {
      id: "tf8",
      description: "Confirm details",
      detail: "Check your info",
      type: "user" as const,
      fields: [
        { key: "name", label: "Name", type: "text" as const, prefill: "John Smith" },
        { key: "email", label: "Email", type: "email" as const, prefill: "john@example.com" },
      ],
    };
    render(<TaskCard task={task} />);
    expect(screen.getByDisplayValue("John Smith")).toBeInTheDocument();
    expect(screen.getByDisplayValue("john@example.com")).toBeInTheDocument();
  });

  it("LLM options take precedence over smart inference", () => {
    mockStoreState = {
      personaData: {
        primaryContact: { firstName: "Mary", lastName: "Summers" },
        family: {
          dependents: [
            { firstName: "Margaret", lastName: "Evans", relationship: "Mary's mother" },
          ],
        },
      },
    };
    const task = {
      id: "t9",
      description: "Who is this for?",
      detail: "Is this for Mary or Margaret?",
      type: "user" as const,
      options: [
        { value: "self", label: "Myself (Mary Summers)" },
        { value: "dep", label: "Margaret Evans" },
      ],
    };
    render(<TaskCard task={task} />);
    // Should render as checkbox options (LLM path), not radio (smart path)
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
  });
});
