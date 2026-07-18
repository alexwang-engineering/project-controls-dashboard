import { describe, expect, it } from "vitest";
import {
  nonNegativeMoneyPenceSchema,
  parseMoneyPence,
  signedMoneyPenceSchema,
  strictBooleanSchema,
  strictIdentifierSchema,
  strictIsoDateSchema,
} from "./fields";

describe("CSV scalar trust boundary", () => {
  it.each([
    ["0", 0],
    ["1200", 120_000],
    ["01", 100],
    ["1200.5", 120_050],
    ["1200.05", 120_005],
  ])("normalises %s pounds to integer pence", (input, expected) => {
    expect(nonNegativeMoneyPenceSchema.parse(input)).toBe(expected);
  });

  it("reports a legitimate negative number as disallowed rather than formula-like", () => {
    expect(parseMoneyPence("-1200", { allowNegative: false })).toEqual({
      success: false,
      code: "negative_not_allowed",
      message: "Value must be zero or positive.",
    });
    expect(signedMoneyPenceSchema.parse("-1200")).toBe(-120_000);
  });

  it.each(["=1+1", "+1200", "@SUM(A1)"])(
    "blocks formula-like numeric input %s",
    (input) => {
      expect(parseMoneyPence(input, { allowNegative: false })).toMatchObject({
        success: false,
        code: "formula_like",
      });
    },
  );

  it.each(["1e5", "1,000", "£100", "100.999"])(
    "rejects non-canonical money input %s",
    (input) => {
      expect(parseMoneyPence(input, { allowNegative: false })).toMatchObject({
        success: false,
        code: "invalid_money",
      });
    },
  );

  it("keeps identifiers as strings and blocks formula-like identifiers", () => {
    expect(strictIdentifierSchema.parse("A-007")).toBe("A-007");
    expect(strictIdentifierSchema.safeParse("=cmd|A0").success).toBe(false);
    expect(strictIdentifierSchema.safeParse("wp_100").success).toBe(false);
  });

  it.each(["2026-02-30", "2026-13-01", "31/12/2026", "2026-1-1"])(
    "rejects invalid or non-canonical date %s",
    (input) => {
      expect(strictIsoDateSchema.safeParse(input).success).toBe(false);
    },
  );

  it("accepts real ISO dates and lowercase booleans only", () => {
    expect(strictIsoDateSchema.parse("2026-02-28")).toBe("2026-02-28");
    expect(strictBooleanSchema.parse("true")).toBe(true);
    expect(strictBooleanSchema.parse("false")).toBe(false);
    expect(strictBooleanSchema.safeParse("TRUE").success).toBe(false);
  });

  it("reports formula-like dates and booleans through the hostile-input rule", () => {
    const date = strictIsoDateSchema.safeParse("=TODAY()");
    const boolean = strictBooleanSchema.safeParse("+true");

    expect(date.success).toBe(false);
    expect(boolean.success).toBe(false);
    if (!date.success) expect(date.error.issues[0]?.message).toContain("formula");
    if (!boolean.success) {
      expect(boolean.error.issues[0]?.message).toContain("formula");
    }
  });
});
