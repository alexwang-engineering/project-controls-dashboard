import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateEarnedValue } from "../../domain/calculations/earnedValue";
import {
  createVarianceAnalysisContext,
  type VarianceAnalysisRecord,
} from "../../domain/varianceAnalysis";
import type {
  SaveVarianceDraftInput,
  SignOffVarianceAnalysisInput,
  VarianceAnalysisContextState,
} from "../../repositories/varianceAnalysisRepository";
import {
  VarianceAnalysisPanel,
  type VarianceAnalysisPanelDependencies,
} from "./VarianceAnalysisPanel";

const context = createVarianceAnalysisContext({
  projectId: "ASTER",
  baselineVersion: "B0",
  scopeId: "all",
  reportingPeriod: "2026-06-14",
  sourceImportId: "IMPORT-001",
  expectedActiveImportId: "IMPORT-001",
  managementScenario: "cpi",
  metrics: calculateEarnedValue({
    bac: 2_400_000,
    pv: 1_500_000,
    ev: 1_350_000,
    ac: 1_440_000,
    managementEac: 2_560_000,
  }),
});

const draftRecord = (input: SaveVarianceDraftInput): VarianceAnalysisRecord =>
  ({
    recordId: `DRAFT::${input.context.contextKey}::${input.context.sourceImportId}`,
    recordType: "draft",
    contextKey: input.context.contextKey,
    projectId: input.context.projectId,
    baselineVersion: input.context.baselineVersion,
    scopeType: input.context.scopeType,
    scopeId: input.context.scopeId,
    reportingPeriod: input.context.reportingPeriod,
    sourceImportId: input.context.sourceImportId,
    managementScenario: input.context.managementScenario,
    breachedMetrics: [...input.context.breachedMetrics],
    facts: input.context.facts,
    factFingerprint: input.context.factFingerprint,
    details: input.details,
    createdAt: input.savedAt,
    updatedAt: input.savedAt,
  });

const signedRecord = (
  input: SignOffVarianceAnalysisInput,
): VarianceAnalysisRecord => ({
  ...draftRecord({
    context: input.context,
    details: input.details,
    savedAt: input.signedAt,
  }),
  recordId: `SIGNED::${input.context.contextKey}::1`,
  recordType: "signed",
  revision: 1,
  signedAt: input.signedAt,
});

const dependencies = (
  loaded: VarianceAnalysisContextState = {
    signedRevisions: [],
    retainedDraftCount: 0,
  },
) => {
  const value: VarianceAnalysisPanelDependencies = {
    load: vi.fn().mockResolvedValue(loaded),
    saveDraft: vi.fn().mockImplementation(async (input) => draftRecord(input)),
    signOff: vi.fn().mockImplementation(async (input) => signedRecord(input)),
    now: () => "2026-07-19T13:00:00.000Z",
  };
  return value;
};

describe("variance analysis panel", () => {
  afterEach(() => cleanup());

  it("requires a saved complete draft before immutable sign-off", async () => {
    const user = userEvent.setup();
    const controls = dependencies();
    render(<VarianceAnalysisPanel context={context} dependencies={controls} />);

    const region = await screen.findByRole("region", {
      name: "Variance analysis and recovery control",
    });
    const signOff = within(region).getByRole("button", {
      name: "Sign off immutable revision",
    });
    expect(signOff).toBeDisabled();

    const fields = [
      ["Root cause", "Late control-panel release constrained installation."],
      ["Dependency impact", "Mechanical completion and test entry are delayed."],
      ["Milestone impact", "Site acceptance is forecast seven days late."],
      ["Critical or near-critical path impact", "Source schedule does not identify critical path."],
      ["Cost and EAC effect", "CPI continuation indicates a £160,000 overrun."],
      ["Corrective action", "Add a second wiring team and resequence dry testing."],
      ["Accountable owner", "Controls Manager"],
      ["Recovery evidence", "Weekly completed-panel count reaches four units."],
      ["Prepared by", "Project Controls Engineer"],
    ] as const;
    for (const [label, value] of fields) {
      await user.type(within(region).getByLabelText(label), value);
    }
    await user.type(within(region).getByLabelText("Action due date"), "2026-06-21");
    await user.type(
      within(region).getByLabelText("Expected recovery period"),
      "2026-06-28",
    );

    await user.click(
      within(region).getByRole("button", { name: "Save current draft" }),
    );
    expect(controls.saveDraft).toHaveBeenCalledOnce();
    expect(signOff).toBeEnabled();

    await user.click(signOff);
    expect(controls.signOff).toHaveBeenCalledOnce();
    expect(
      await within(region).findByText("Revision 1 was signed and locked."),
    ).toBeInTheDocument();
  });

  it("shows signed history from an earlier source generation without editing it", async () => {
    const old = signedRecord({
      context: { ...context, sourceImportId: "IMPORT-OLD" },
      details: {
        rootCause: "Late control-panel release constrained installation.",
        dependencyImpact: "Mechanical completion and test entry are delayed.",
        milestoneImpact: "Site acceptance is forecast seven days late.",
        criticalPathImpact: "Source schedule does not identify critical path.",
        costEacEffect: "CPI continuation indicates a £160,000 overrun.",
        correctiveAction: "Add a second wiring team and resequence dry testing.",
        owner: "Controls Manager",
        dueDate: "2026-06-21",
        recoveryEvidence: "Weekly completed-panel count reaches four units.",
        expectedRecoveryPeriod: "2026-06-28",
        status: "open",
        author: "Project Controls Engineer",
      },
      signedAt: "2026-07-18T13:00:00.000Z",
    });
    render(
      <VarianceAnalysisPanel
        context={context}
        dependencies={dependencies({
          signedRevisions: [old],
          retainedDraftCount: 1,
        })}
      />,
    );

    const history = await screen.findByRole("table", {
      name: "Signed variance-analysis history",
    });
    expect(within(history).getByText("Revision 1")).toBeInTheDocument();
    expect(within(history).getByText("Earlier generation")).toBeInTheDocument();
    expect(
      screen.getByText("1 earlier-generation draft is retained."),
    ).toBeInTheDocument();
  });
});
