import { z } from "zod";

export type Pence = number & { readonly __brand: "Pence" };

export type ScalarFailureCode =
  | "formula_like"
  | "invalid_money"
  | "negative_not_allowed"
  | "money_out_of_range";

export type ScalarResult<T> =
  | { success: true; value: T }
  | { success: false; code: ScalarFailureCode; message: string };

const signedMoneyGrammar = /^-?\d+(?:\.\d{1,2})?$/;
const formulaPrefix = /^[=+\-@\t\r\n]/;
const maximumSafePence = BigInt(Number.MAX_SAFE_INTEGER);

export const startsWithFormulaCharacter = (value: string) =>
  formulaPrefix.test(value);

const invalidMoneyResult = (input: string): ScalarResult<Pence> => {
  if (startsWithFormulaCharacter(input)) {
    return {
      success: false,
      code: "formula_like",
      message:
        "Value resembles a spreadsheet formula and does not match the required money grammar.",
    };
  }

  return {
    success: false,
    code: "invalid_money",
    message:
      "Enter GBP using digits and an optional full stop with no more than two decimal places.",
  };
};

export function parseMoneyPence(
  input: string,
  options: { allowNegative: boolean },
): ScalarResult<Pence> {
  if (!signedMoneyGrammar.test(input)) {
    return invalidMoneyResult(input);
  }

  if (!options.allowNegative && input.startsWith("-")) {
    return {
      success: false,
      code: "negative_not_allowed",
      message: "Value must be zero or positive.",
    };
  }

  const negative = input.startsWith("-");
  const unsigned = negative ? input.slice(1) : input;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const absolutePence = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));

  if (absolutePence > maximumSafePence) {
    return {
      success: false,
      code: "money_out_of_range",
      message: "Value is outside the supported monetary range.",
    };
  }

  const pence = Number(negative ? -absolutePence : absolutePence) as Pence;
  return { success: true, value: pence };
}

const moneySchema = (allowNegative: boolean) =>
  z.string().transform((input, context) => {
    const result = parseMoneyPence(input, { allowNegative });

    if (!result.success) {
      context.addIssue({ code: "custom", message: result.message });
      return z.NEVER;
    }

    return result.value;
  });

export const nonNegativeMoneyPenceSchema = moneySchema(false);
export const signedMoneyPenceSchema = moneySchema(true);

const identifierGrammar = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export const strictIdentifierSchema = z.string().superRefine((input, context) => {
  if (identifierGrammar.test(input)) return;

  context.addIssue({
    code: "custom",
    message: startsWithFormulaCharacter(input)
      ? "Identifier resembles a spreadsheet formula."
      : "Use uppercase letters, digits, and internal hyphens only.",
  });
});

const isoDateGrammar = /^(\d{4})-(\d{2})-(\d{2})$/;

export const strictIsoDateSchema = z.string().superRefine((input, context) => {
  if (startsWithFormulaCharacter(input)) {
    context.addIssue({
      code: "custom",
      message: "Date resembles a spreadsheet formula.",
    });
    return;
  }

  const match = isoDateGrammar.exec(input);
  if (!match) {
    context.addIssue({ code: "custom", message: "Use YYYY-MM-DD." });
    return;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isRealDate) {
    context.addIssue({ code: "custom", message: "Enter a real calendar date." });
  }
});

export const strictBooleanSchema = z
  .string()
  .superRefine((input, context) => {
    if (input === "true" || input === "false") return;
    context.addIssue({
      code: "custom",
      message: startsWithFormulaCharacter(input)
        ? "Boolean resembles a spreadsheet formula."
        : "Use lowercase true or false.",
    });
  })
  .transform((input) => input === "true");
