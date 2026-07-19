import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { buildEacScenarios, type EacScenarioId } from "../../domain/calculations/eacScenarios";
import { calculateEarnedValue } from "../../domain/calculations/earnedValue";
import { EacScenarioPanel } from "./EacScenarioPanel";

const input = {
  bac: 2_400_000,
  pv: 1_500_000,
  ev: 1_350_000,
  ac: 1_440_000,
};

function ScenarioHarness() {
  const base = calculateEarnedValue(input);
  const scenarios = buildEacScenarios(base);
  const [selected, setSelected] = useState<EacScenarioId>("cpi");
  const selectedValue = scenarios.find(({ id }) => id === selected)?.value;
  const metrics = calculateEarnedValue({
    ...input,
    ...(selectedValue === null || selectedValue === undefined
      ? {}
      : { managementEac: selectedValue }),
  });

  return (
    <EacScenarioPanel
      metrics={metrics}
      scenarios={scenarios}
      selectedScenarioId={selected}
      onSelect={setSelected}
    />
  );
}

describe("EAC scenario panel", () => {
  afterEach(() => cleanup());

  it("explains all assumptions and makes the management selection explicit", async () => {
    const user = userEvent.setup();
    render(<ScenarioHarness />);

    const region = screen.getByRole("region", {
      name: "EAC sensitivity and management selection",
    });
    expect(
      within(region).getByRole("radio", { name: /CPI-continuation EAC/ }),
    ).toBeChecked();
    expect(within(region).getByText("£2,560,000")).toBeInTheDocument();
    expect(within(region).getByText("-£160,000")).toBeInTheDocument();
    expect(within(region).getByText("AC + WR ÷ CPI")).toBeInTheDocument();

    await user.click(
      within(region).getByRole("radio", {
        name: /CPI × SPI sensitivity/,
      }),
    );
    expect(within(region).getByText("£2,684,444")).toBeInTheDocument();
    expect(within(region).getByText("-£284,444")).toBeInTheDocument();
    expect(within(region).getByText("0.844")).toBeInTheDocument();
  });

  it("disables unavailable index-dependent scenarios with a reason", () => {
    const metrics = calculateEarnedValue({ bac: 100, pv: 0, ev: 0, ac: 0 });
    render(
      <EacScenarioPanel
        metrics={metrics}
        scenarios={buildEacScenarios(metrics)}
        selectedScenarioId="budget-rate"
        onSelect={() => undefined}
      />,
    );

    expect(
      screen.getByRole("radio", { name: /CPI-continuation EAC/ }),
    ).toBeDisabled();
    expect(
      screen.getAllByText("CPI is unavailable because actual cost is zero."),
    ).toHaveLength(2);
  });
});
