import Decimal from "decimal.js";

export interface EarnedValueInput {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  managementEac?: number;
}

export interface EarnedValueResult {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  sv: number;
  cv: number;
  spi: number | null;
  cpi: number | null;
  workRemaining: number;
  eacBudgetRate: number;
  eacCpi: number | null;
  eacComposite: number | null;
  managementEac: number;
  etc: number;
  vac: number;
  tcpiBac: number | null;
  tcpiEac: number | null;
  plannedCompletion: number | null;
  earnedCompletion: number | null;
  budgetSpent: number | null;
}

export const PERFORMANCE_TOLERANCE = {
  onPlan: 1,
  recovery: 0.98,
} as const;

const value = (input: number) => new Decimal(input);

const decimalOrNull = (
  numerator: Decimal,
  denominator: Decimal,
): Decimal | null => {
  if (denominator.isZero()) {
    return null;
  }

  return numerator.dividedBy(denominator);
};

const numberOrNull = (input: Decimal | null): number | null =>
  input === null ? null : input.toNumber();

export function calculateEarnedValue(
  input: EarnedValueInput,
): EarnedValueResult {
  const bac = value(input.bac);
  const pv = value(input.pv);
  const ev = value(input.ev);
  const ac = value(input.ac);
  const workRemaining = bac.minus(ev);
  const spi = decimalOrNull(ev, pv);
  const cpi = decimalOrNull(ev, ac);
  const eacBudgetRate = ac.plus(workRemaining);
  const eacCpi =
    cpi === null || cpi.isZero()
      ? null
      : ac.plus(workRemaining.dividedBy(cpi));
  const eacComposite =
    cpi === null || spi === null || cpi.isZero() || spi.isZero()
      ? null
      : ac.plus(workRemaining.dividedBy(cpi.times(spi)));
  const managementEac = value(
    input.managementEac ?? eacCpi?.toNumber() ?? eacBudgetRate.toNumber(),
  );
  const tcpiBac =
    bac.greaterThan(ac) ? workRemaining.dividedBy(bac.minus(ac)) : null;
  const tcpiEac = managementEac.greaterThan(ac)
    ? workRemaining.dividedBy(managementEac.minus(ac))
    : null;

  return {
    bac: bac.toNumber(),
    pv: pv.toNumber(),
    ev: ev.toNumber(),
    ac: ac.toNumber(),
    sv: ev.minus(pv).toNumber(),
    cv: ev.minus(ac).toNumber(),
    spi: numberOrNull(spi),
    cpi: numberOrNull(cpi),
    workRemaining: workRemaining.toNumber(),
    eacBudgetRate: eacBudgetRate.toNumber(),
    eacCpi: numberOrNull(eacCpi),
    eacComposite: numberOrNull(eacComposite),
    managementEac: managementEac.toNumber(),
    etc: managementEac.minus(ac).toNumber(),
    vac: bac.minus(managementEac).toNumber(),
    tcpiBac: numberOrNull(tcpiBac),
    tcpiEac: numberOrNull(tcpiEac),
    plannedCompletion: numberOrNull(decimalOrNull(pv, bac)),
    earnedCompletion: numberOrNull(decimalOrNull(ev, bac)),
    budgetSpent: numberOrNull(decimalOrNull(ac, bac)),
  };
}

export function efficiencyStatus(
  valueToAssess: number | null,
): "positive" | "attention" | "adverse" | "neutral" {
  if (valueToAssess === null) {
    return "neutral";
  }

  if (valueToAssess >= PERFORMANCE_TOLERANCE.onPlan) {
    return "positive";
  }

  if (valueToAssess >= PERFORMANCE_TOLERANCE.recovery) {
    return "attention";
  }

  return "adverse";
}

export function efficiencyStatusLabel(valueToAssess: number | null): string {
  const status = efficiencyStatus(valueToAssess);
  if (status === "positive") return "On plan";
  if (status === "attention") return "Within tolerance";
  if (status === "adverse") return "Recovery required";
  return "Unavailable";
}

export function isEfficiencyBreach(valueToAssess: number | null): boolean {
  return (
    valueToAssess !== null &&
    valueToAssess < PERFORMANCE_TOLERANCE.recovery
  );
}
