import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCHEDULE_CSV_HEADERS } from "../../schemas/scheduleCsv";
import { parseCsvBytes, parseCsvText } from "./parseCsv";

const fixture = (name: string) =>
  fileURLToPath(new URL("../../test/fixtures/csv/" + name, import.meta.url));

const readBytes = (name: string) => readFileSync(fixture(name));
const readText = (name: string) => readBytes(name).toString("utf8");
const parseSchedule = (name: string) =>
  parseCsvText(readText(name), {
    fileName: name,
    requiredHeaders: SCHEDULE_CSV_HEADERS,
  });
const parseScheduleBytes = (name: string) =>
  parseCsvBytes(readBytes(name), {
    fileName: name.split("/").at(-1) ?? name,
    requiredHeaders: SCHEDULE_CSV_HEADERS,
  });
const blockingCodes = (name: string) =>
  parseSchedule(name).issues
    .filter((issue) => issue.severity === "blocking")
    .map((issue) => issue.code);

describe("RFC-compatible CSV parser boundary", () => {
  it("accepts LF records without a final line ending", () => {
    const bytes = readBytes("rfc/schedule-lf-no-final-newline.csv");
    const result = parseSchedule("rfc/schedule-lf-no-final-newline.csv");

    expect(bytes.at(-1)).not.toBe(0x0a);
    expect(result.records).toHaveLength(1);
    expect(blockingCodes("rfc/schedule-lf-no-final-newline.csv")).toEqual([]);
  });

  it("accepts CRLF records and ignores only the terminal record ending", () => {
    const text = readText("rfc/schedule-crlf.csv");
    const result = parseSchedule("rfc/schedule-crlf.csv");

    expect(text).toContain("\r\n");
    expect(text.replaceAll("\r\n", "")).not.toContain("\n");
    expect(result.records).toHaveLength(1);
    expect(result.issues).toEqual([]);
  });

  it("removes a UTF-8 BOM and records the normalisation", () => {
    const bytes = readBytes("rfc/schedule-bom.csv");
    const result = parseSchedule("rfc/schedule-bom.csv");

    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(result.hadBom).toBe(true);
    expect(result.header[0]).toBe("project_id");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: "information", code: "bom_removed" }),
    );
  });

  it.each([
    ["rfc/schedule-embedded-comma.csv", "Access, survey, and permit accepted"],
    ["rfc/schedule-doubled-quotes.csv", 'Supplier said "ready"'],
    ["rfc/schedule-multiline.csv", "First line\r\nSecond line"],
  ])("preserves RFC-quoted content in %s", (name, expectedCommentary) => {
    const result = parseSchedule(name);
    const commentaryIndex = result.header.indexOf("commentary");

    expect(result.records[0]?.cells[commentaryIndex]).toBe(expectedCommentary);
    expect(result.records[0]?.physicalLineStart).toBe(2);
    expect(result.issues.filter((issue) => issue.severity === "blocking")).toEqual([]);
  });

  it("keeps record numbering stable after a multiline record", () => {
    const result = parseSchedule("rfc/schedule-after-multiline.csv");

    expect(result.records[1]).toMatchObject({
      recordNumber: 3,
      physicalLineStart: 4,
    });
  });

  it("omits physical-line hints when the enrichment scanner and parser diverge", () => {
    const [header = "", dataRow = ""] = readText(
      "rfc/schedule-lf-no-final-newline.csv",
    ).split("\n");
    const input =
      header +
      "\n" +
      dataRow.replace("Accepted fixture record", 'stray"quote') +
      "\n" +
      dataRow.replace("A-001", "A-002") +
      "\n";
    const result = parseCsvText(input, {
      fileName: "scanner-divergence.csv",
      requiredHeaders: SCHEDULE_CSV_HEADERS,
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.physicalLineStart)).toEqual([
      undefined,
      undefined,
    ]);
    expect(result.records.map((record) => record.recordNumber)).toEqual([2, 3]);
  });

  it("reports a blank physical line without shifting the following record", () => {
    const result = parseSchedule("rfc/schedule-blank-line.csv");
    const blankIssue = result.issues.find(
      (issue) => issue.code === "blank_physical_line",
    );

    expect(blankIssue).toMatchObject({
      severity: "blocking",
      recordNumber: 3,
      physicalLineStart: 3,
    });
    expect(result.records[2]).toMatchObject({
      recordNumber: 4,
      physicalLineStart: 4,
    });
  });

  it("reports an unclosed quote as a structural blocking error", () => {
    const result = parseSchedule("rfc/schedule-unclosed-quote.csv");

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "csv_missingquotes",
        recordNumber: 2,
        physicalLineStart: 2,
      }),
    );
  });

  it("rejects duplicate headers and reports the missing contract header", () => {
    const result = parseSchedule("rfc/schedule-duplicate-header.csv");

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "blocking",
        code: "duplicate_header",
        suppliedValue: "owner",
      }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "blocking",
        code: "header_contract",
        rule: expect.stringContaining("Missing: commentary"),
      }),
    );
  });

  it("accepts an exact header set in a different column order", () => {
    const result = parseSchedule("rfc/schedule-reordered-header.csv");

    expect(result.records).toHaveLength(1);
    expect(result.issues.filter((issue) => issue.severity === "blocking")).toEqual([]);
  });

  it.each([
    "rfc/schedule-semicolon.csv",
    "rfc/schedule-missing-header.csv",
    "rfc/schedule-extra-header.csv",
  ])("blocks a file that violates the exact header contract: %s", (name) => {
    expect(blockingCodes(name)).toContain("header_contract");
  });

  it.each(["rfc/empty.csv", "rfc/schedule-header-only.csv"])(
    "blocks a file with no data records: %s",
    (name) => {
      expect(blockingCodes(name)).toContain("no_data_rows");
    },
  );

  it("enforces the extension allowlist before parsing", () => {
    expect(
      parseScheduleBytes("rfc/schedule-wrong-extension.txt").issues,
    ).toContainEqual(expect.objectContaining({ code: "file_extension" }));
  });

  it("rejects non-UTF-8 binary content renamed with a CSV extension", () => {
    expect(parseScheduleBytes("rfc/renamed-xlsx.csv").issues).toContainEqual(
      expect.objectContaining({ code: "invalid_utf8" }),
    );
  });

  it("blocks a file one byte above the five-megabyte limit before parsing", () => {
    const result = parseScheduleBytes("limits/file-too-large.csv");

    expect(result.header).toEqual([]);
    expect(result.records).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "file_size",
        suppliedValue: "5242881 bytes",
      }),
    );
  });

  it("blocks the 10,001st data row", () => {
    const result = parseSchedule("limits/schedule-10001-rows.csv");

    expect(result.records).toHaveLength(10_001);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "row_limit",
        suppliedValue: "10001 data records",
      }),
    );
  });

  it("blocks a cell one character above the global limit", () => {
    const result = parseSchedule("limits/schedule-cell-1001.csv");

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "cell_length",
        column: "commentary",
      }),
    );
  });
});
