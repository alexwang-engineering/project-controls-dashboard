import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../app/store";
import { ChangesPage } from "../changes/ChangesPage";
import { MilestonesPage } from "../milestones/MilestonesPage";
import { RisksPage } from "../risks/RisksPage";

describe("input-first management registers", () => {
  beforeEach(() => {
    useProjectStore.setState({ milestones: [], risks: [], changes: [] });
  });

  afterEach(() => cleanup());

  it("starts the milestone register empty and saves user input", async () => {
    const user = userEvent.setup();
    render(<MilestonesPage />);

    expect(screen.getByText("No milestones have been entered.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add milestone" }));

    await user.type(screen.getByLabelText("Milestone ID"), "M-001");
    await user.type(screen.getByLabelText("Milestone name"), "Design approved");
    await user.type(screen.getByLabelText("Work package ID"), "WP100");
    await user.type(screen.getByLabelText("Owner"), "Design Manager");
    await user.type(screen.getByLabelText("Baseline date"), "2026-08-10");
    await user.type(screen.getByLabelText("Previous forecast date"), "2026-08-10");
    await user.type(screen.getByLabelText("Current forecast date"), "2026-08-12");
    await user.selectOptions(screen.getByLabelText("Milestone status"), "forecast-late");
    await user.type(
      screen.getByLabelText("Control commentary"),
      "Approval meeting booked and action owner confirmed.",
    );
    await user.click(screen.getByRole("button", { name: "Save milestone" }));

    const row = screen.getByRole("row", { name: /Design approved/ });
    expect(within(row).getByText("M-001 · WP100")).toBeInTheDocument();
    expect(useProjectStore.getState().milestones).toHaveLength(1);
  });

  it("derives risk score and rating from user-entered probability and impact", async () => {
    const user = userEvent.setup();
    render(<RisksPage />);

    expect(screen.getByText("No risks have been entered.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add risk" }));

    await user.type(screen.getByLabelText("Risk ID"), "R-001");
    await user.type(screen.getByLabelText("Risk title"), "Supplier delivery delay");
    await user.type(screen.getByLabelText("Work package ID"), "WP200");
    await user.type(screen.getByLabelText("Owner"), "Supply Chain Manager");
    await user.type(screen.getByLabelText("Category"), "Delivery");
    await user.clear(screen.getByLabelText("Residual probability"));
    await user.type(screen.getByLabelText("Residual probability"), "4");
    await user.clear(screen.getByLabelText("Residual impact"));
    await user.type(screen.getByLabelText("Residual impact"), "4");
    await user.type(
      screen.getByLabelText("Treatment action"),
      "Expedite the purchase order and track dispatch evidence daily.",
    );
    await user.type(screen.getByLabelText("Treatment due"), "2026-08-01");
    await user.click(screen.getByRole("button", { name: "Save risk" }));

    const row = screen.getByRole("row", { name: /Supplier delivery delay/ });
    expect(within(row).getByText("4 × 4 = 16")).toBeInTheDocument();
    expect(within(row).getByText("Critical")).toBeInTheDocument();
  });

  it("creates a draft and exposes only the controlled next transition", async () => {
    const user = userEvent.setup();
    render(<ChangesPage />);

    expect(
      screen.getByRole("heading", { name: "Original-to-current baseline reconciliation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Import a validated schedule and performance pair/),
    ).toBeInTheDocument();
    expect(screen.getByText("No change requests have been entered.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add change request" }));

    await user.type(screen.getByLabelText("Change ID"), "CR-001");
    await user.type(screen.getByLabelText("Change title"), "Add inspection platform");
    await user.type(screen.getByLabelText("Work package ID"), "WP300");
    await user.type(screen.getByLabelText("Cost impact (£)"), "25000");
    await user.type(screen.getByLabelText("Schedule impact (days)"), "3");
    await user.type(screen.getByLabelText("Decision due"), "2026-08-05");
    await user.click(screen.getByRole("button", { name: "Save change request" }));

    const row = screen.getByRole("row", { name: /Add inspection platform/ });
    expect(within(row).getByText("£25,000")).toBeInTheDocument();
    expect(within(row).getByText("Not incorporated")).toBeInTheDocument();
    expect(useProjectStore.getState().changes[0]?.status).toBe("draft");

    await user.click(screen.getByRole("button", { name: "Edit CR-001" }));
    const status = screen.getByLabelText("Change status");
    expect(within(status).getByRole("option", { name: "Draft" })).toBeInTheDocument();
    expect(within(status).getByRole("option", { name: "Submitted" })).toBeInTheDocument();
    expect(within(status).queryByRole("option", { name: "Approved" })).not.toBeInTheDocument();

    await user.selectOptions(status, "submitted");
    await user.type(screen.getByLabelText("Requester"), "Engineering Manager");
    await user.type(
      screen.getByLabelText("Reason for change"),
      "Improve safe access for mandatory inspection work.",
    );
    await user.type(
      screen.getByLabelText("Scope description"),
      "Add one permanent access platform and associated guarding.",
    );
    await user.type(
      screen.getByLabelText("Technical and quality impact"),
      "Inspection access improves and loading requires design verification.",
    );
    await user.type(
      screen.getByLabelText("Risk impact"),
      "Reduces access risk and introduces a design interface risk.",
    );
    await user.type(
      screen.getByLabelText("Benefit"),
      "Safer repeat inspection with a shorter planned outage.",
    );
    await user.type(
      screen.getByLabelText("Assumptions"),
      "Existing steelwork can carry the verified platform loads.",
    );
    await user.type(
      screen.getByLabelText("Alternatives considered"),
      "Mobile access equipment was assessed and rejected for repeat use.",
    );
    await user.type(
      screen.getByLabelText("Recommendation"),
      "Submit the permanent platform for Change Board approval.",
    );
    await user.type(screen.getByLabelText("Submitted date"), "2026-07-20");
    await user.type(
      screen.getByLabelText("Decision authority"),
      "Project Change Board",
    );
    await user.type(
      screen.getByLabelText("Evidence reference"),
      "CCB-PACK-001",
    );
    await user.click(screen.getByRole("button", { name: "Save change request" }));

    expect(useProjectStore.getState().changes[0]).toMatchObject({
      status: "submitted",
      decisionAuthority: "Project Change Board",
    });
    expect(useProjectStore.getState().changes[0]?.decisionHistory).toHaveLength(1);
    expect(screen.getByRole("row", { name: /Add inspection platform/ })).toHaveTextContent(
      "Project Change Board",
    );
  });
});
