import { describe, expect, it } from "vitest";
import { encodeCsv, encodeCsvCell, neutraliseSpreadsheetCell } from "./safeCsvExport";

describe("safe CSV export", () => {
  it.each(["=1+1", "+cmd", "-1200", "@SUM(A1)", "\tformula", "\rformula", "\nformula"])(
    "neutralises the hostile leading character in %j",
    (input) => {
      expect(neutraliseSpreadsheetCell(input)).toBe("'" + input);
      expect(encodeCsvCell(input).startsWith('"\'')).toBe(true);
    },
  );

  it("applies formula neutralisation before RFC quote escaping", () => {
    expect(encodeCsvCell('=cmd,"quoted"')).toBe('"\'=cmd,""quoted"""');
  });

  it("uses CRLF records and includes a final record ending", () => {
    const output = encodeCsv([
      ["field", "supplied value"],
      ["activity_id", "=1+1"],
    ]);

    expect(output).toBe("field,supplied value\r\nactivity_id,\"'=1+1\"\r\n");
    expect(output.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("allows explicitly trusted scalar columns without weakening text columns", () => {
    const output = encodeCsv(
      [
        ["metric", "value"],
        ["schedule_variance", "-150000"],
      ],
      { columnTrust: ["untrusted-text", "trusted-scalar"] },
    );

    expect(output).toBe("metric,value\r\nschedule_variance,-150000\r\n");
    expect(encodeCsvCell("-150000")).toBe("\"'-150000\"");
  });
});
