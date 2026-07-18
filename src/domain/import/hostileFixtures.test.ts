import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseMoneyPence,
  strictIdentifierSchema,
} from "../../schemas/fields";
import { PERFORMANCE_CSV_HEADERS } from "../../schemas/performanceCsv";
import { SCHEDULE_CSV_HEADERS } from "../../schemas/scheduleCsv";
import { encodeCsvCell } from "../../utils/safeCsvExport";
import { parseCsvText } from "./parseCsv";

const fixtureText = (name: string) =>
  readFileSync(
    fileURLToPath(new URL("../../test/fixtures/csv/hostile/" + name, import.meta.url)),
    "utf8",
  );

const parsedValue = (
  fileName: string,
  headers: readonly string[],
  column: string,
) => {
  const result = parseCsvText(fixtureText(fileName), {
    fileName,
    requiredHeaders: headers,
  });
  const columnIndex = result.header.indexOf(column);

  expect(result.issues.filter((issue) => issue.severity === "blocking")).toEqual([]);
  expect(columnIndex).toBeGreaterThanOrEqual(0);
  return result.records[0]?.cells[columnIndex] ?? "";
};

const parseHostileSchedule = (fileName: string) =>
  parseCsvText(fixtureText(fileName), {
    fileName,
    requiredHeaders: SCHEDULE_CSV_HEADERS,
  });

describe("checked-in hostile CSV fixtures", () => {
  it("classifies negative AC as a value-range error, not a formula error", () => {
    const suppliedValue = parsedValue(
      "performance-negative-ac.csv",
      PERFORMANCE_CSV_HEADERS,
      "ac_period",
    );

    expect(suppliedValue).toBe("-1200");
    expect(parseMoneyPence(suppliedValue, { allowNegative: false })).toMatchObject({
      success: false,
      code: "negative_not_allowed",
      message: "Value must be zero or positive.",
    });
  });

  it("classifies formula-like AC separately from a legitimate signed number", () => {
    const suppliedValue = parsedValue(
      "performance-formula-ac.csv",
      PERFORMANCE_CSV_HEADERS,
      "ac_period",
    );

    expect(suppliedValue).toBe("=1+1");
    expect(parseMoneyPence(suppliedValue, { allowNegative: false })).toMatchObject({
      success: false,
      code: "formula_like",
    });
  });

  it("blocks a formula-like identifier at the scalar trust boundary", () => {
    const suppliedValue = parsedValue(
      "schedule-formula-identifier.csv",
      SCHEDULE_CSV_HEADERS,
      "activity_id",
    );
    const result = strictIdentifierSchema.safeParse(suppliedValue);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("spreadsheet formula");
    }
  });

  it("accepts hostile-looking free text as inert text and escapes it on export", () => {
    const suppliedValue = parsedValue(
      "schedule-formula-commentary.csv",
      SCHEDULE_CSV_HEADERS,
      "commentary",
    );

    expect(suppliedValue).toBe("=cmd|' /C calc'!A0");
    expect(encodeCsvCell(suppliedValue)).toBe('"\'=cmd|\' /C calc\'!A0"');
  });

  it("preserves HTML-looking commentary as plain data", () => {
    const suppliedValue = parsedValue(
      "schedule-html-commentary.csv",
      SCHEDULE_CSV_HEADERS,
      "commentary",
    );

    expect(suppliedValue).toBe('<script>alert("fixture")</script>');
    expect(encodeCsvCell(suppliedValue)).toBe(
      '"<script>alert(""fixture"")</script>"',
    );
  });

  it("preserves leading control characters in free text for safe export", () => {
    const result = parseHostileSchedule("schedule-leading-control-text.csv");
    const commentaryIndex = result.header.indexOf("commentary");
    const values = result.records.map((record) => record.cells[commentaryIndex]);

    expect(values).toEqual(["+SUM(A1)", "@SUM(A1)", "\tformula", "\rformula"]);
    for (const value of values) {
      expect(encodeCsvCell(value ?? "").startsWith('"\'')).toBe(true);
    }
  });

  it("preserves URL-looking strings without interpreting them", () => {
    const result = parseHostileSchedule("schedule-url-text.csv");
    const commentaryIndex = result.header.indexOf("commentary");

    expect(result.records.map((record) => record.cells[commentaryIndex])).toEqual([
      "javascript:alert(1)",
      "data:text/html,fixture",
    ]);
  });

  it("preserves Unicode control, zero-width, and emoji data without shifting fields", () => {
    const result = parseHostileSchedule("schedule-unicode.csv");
    const nameIndex = result.header.indexOf("activity_name");
    const commentaryIndex = result.header.indexOf("commentary");

    expect(result.records[0]?.cells[nameIndex]).toBe("Unicode interface check ⚙️");
    expect(result.records[0]?.cells[commentaryIndex]).toContain("\u202e");
    expect(result.records[0]?.cells[commentaryIndex]).toContain("\u200b");
    expect(result.records[0]?.cells).toHaveLength(SCHEDULE_CSV_HEADERS.length);
  });
});
