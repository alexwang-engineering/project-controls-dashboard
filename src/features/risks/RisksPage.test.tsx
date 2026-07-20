import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../app/store";
import type { Risk } from "../../domain/types";
import { RisksPage } from "./RisksPage";

const risk = (overrides: Partial<Risk>): Risk => ({
  id: "R-001",
  title: "Supplier delivery delay",
  owner: "Alice",
  wbsId: "WP200",
  category: "Delivery",
  status: "active",
  objective: "schedule",
  condition: "The supplier has not secured the planned dispatch slot.",
  event: "The control panel may arrive after the installation window.",
  consequence: "Energisation and integrated testing could be delayed.",
  inherentProbability: 5,
  inherentImpact: 4,
  inherentScore: 20,
  inherentRating: "critical",
  previousResidualProbability: 3,
  previousResidualImpact: 3,
  residualProbability: 4,
  residualImpact: 4,
  residualScore: 16,
  rating: "critical",
  treatment: "Expedite the purchase order and track dispatch evidence daily.",
  treatmentDue: "2026-07-19",
  reviewDate: "2026-07-19",
  triggerDescription: "Dispatch evidence is not received by the agreed cut-off.",
  triggerStatus: "breached",
  controlDescription: "Daily supplier progress confirmation and receipt log review.",
  controlOwner: "Alice",
  controlEvidence: "SUPPLIER-LOG-001",
  controlTestDate: "2026-07-18",
  controlEffectiveness: "ineffective",
  disposition: "escalated",
  escalationOwner: "Project Director",
  escalationDate: "2026-07-18",
  ...overrides,
});

const risks: Risk[] = [
  risk({}),
  risk({
    id: "R-002",
    title: "Incomplete test scripts",
    category: "Technical",
    inherentProbability: 3,
    inherentImpact: 4,
    inherentScore: 12,
    inherentRating: "high",
    previousResidualProbability: 2,
    previousResidualImpact: 4,
    residualProbability: 2,
    residualImpact: 3,
    residualScore: 6,
    rating: "moderate",
    treatmentDue: "2026-07-28",
    reviewDate: "2026-07-24",
    triggerStatus: "watch",
    controlEffectiveness: "partly-effective",
    disposition: "within-tolerance",
    escalationOwner: undefined,
    escalationDate: undefined,
  }),
  risk({
    id: "R-003",
    title: "Closed lifting-plan risk",
    owner: "Bob",
    status: "closed",
    inherentProbability: 4,
    inherentImpact: 5,
    inherentScore: 20,
    inherentRating: "critical",
    previousResidualProbability: 2,
    previousResidualImpact: 3,
    residualProbability: 1,
    residualImpact: 4,
    residualScore: 4,
    rating: "low",
    triggerStatus: "clear",
    controlEffectiveness: "effective",
    disposition: "within-tolerance",
    escalationOwner: undefined,
    escalationDate: undefined,
  }),
];

describe("risk-control page", () => {
  beforeEach(() => {
    useProjectStore.setState({
      risks,
      milestones: [],
      changes: [],
      selectedWorkPackage: "all",
    });
  });

  afterEach(() => cleanup());

  it("combines owner, category, status and rating filters with AND logic", async () => {
    const user = userEvent.setup();
    render(<RisksPage reportingDateOverride="2026-07-20" />);

    await user.selectOptions(screen.getByLabelText("Owner filter"), "Alice");
    await user.selectOptions(screen.getByLabelText("Category filter"), "Delivery");
    await user.selectOptions(screen.getByLabelText("Rating filter"), "critical");

    const register = screen.getByRole("table", { name: "Filtered project risk register" });
    expect(within(register).getByRole("row", { name: /Supplier delivery delay/ })).toBeInTheDocument();
    expect(within(register).queryByRole("row", { name: /Incomplete test scripts/ })).not.toBeInTheDocument();
    expect(within(register).queryByRole("row", { name: /Closed lifting-plan risk/ })).not.toBeInTheDocument();
    expect(screen.getByText("1 of 3 risks shown")).toBeInTheDocument();
  });

  it("switches inherent and residual exposure for both heatmap and register", async () => {
    const user = userEvent.setup();
    render(<RisksPage reportingDateOverride="2026-07-20" />);

    expect(
      screen.getByRole("button", {
        name: "Probability 2, impact 3: 1 risk (R-002)",
      }),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Exposure basis"), "inherent");
    expect(
      screen.getByRole("button", {
        name: "Probability 3, impact 4: 1 risk (R-002)",
      }),
    ).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Incomplete test scripts/ });
    expect(within(row).getByText("3 × 4 = 12")).toBeInTheDocument();
  });

  it("filters the register by an accessible heatmap cell and explains the matrix", async () => {
    const user = userEvent.setup();
    render(<RisksPage reportingDateOverride="2026-07-20" />);

    await user.click(
      screen.getByRole("button", {
        name: "Probability 4, impact 4: 1 risk (R-001)",
      }),
    );

    const register = screen.getByRole("table", { name: "Filtered project risk register" });
    expect(within(register).getByRole("row", { name: /Supplier delivery delay/ })).toBeInTheDocument();
    expect(within(register).queryByRole("row", { name: /Incomplete test scripts/ })).not.toBeInTheDocument();
    expect(screen.getByText(/ordinal prioritisation aid/i)).toBeInTheDocument();
    expect(screen.getByText(/does not aggregate exposure/i)).toBeInTheDocument();
  });

  it("surfaces breached, overdue, weak-control and tolerance exceptions", () => {
    render(<RisksPage reportingDateOverride="2026-07-20" />);

    const exceptions = screen.getByRole("region", {
      name: "Risk exceptions requiring attention",
    });
    const item = within(exceptions).getByText("R-001 · Supplier delivery delay").closest("li");
    expect(item).not.toBeNull();
    expect(item).toHaveTextContent("Above tolerance");
    expect(item).toHaveTextContent("Treatment overdue");
    expect(item).toHaveTextContent("Review overdue");
    expect(item).toHaveTextContent("Breached trigger");
    expect(item).toHaveTextContent("Ineffective control");
  });

  it("clears local filters when the global work-package scope changes", async () => {
    const user = userEvent.setup();
    const wp300Risk = risk({
      id: "R-004",
      title: "Mechanical interface tolerance",
      wbsId: "WP300",
      owner: "Carla",
      category: "Interfaces",
    });
    useProjectStore.setState({
      risks: [...risks, wp300Risk],
      selectedWorkPackage: "WP200",
    });
    render(<RisksPage reportingDateOverride="2026-07-20" />);

    await user.selectOptions(screen.getByLabelText("Owner filter"), "Alice");
    await user.selectOptions(screen.getByLabelText("Category filter"), "Technical");
    expect(
      screen.getByRole("row", { name: /Incomplete test scripts/ }),
    ).toBeInTheDocument();

    act(() => {
      useProjectStore.getState().setSelectedWorkPackage("WP300");
    });

    expect(screen.getByLabelText("Owner filter")).toHaveValue("all");
    expect(screen.getByLabelText("Category filter")).toHaveValue("all");
    expect(
      screen.getByRole("row", { name: /Mechanical interface tolerance/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("row", { name: /Incomplete test scripts/ }),
    ).not.toBeInTheDocument();
  });
});
