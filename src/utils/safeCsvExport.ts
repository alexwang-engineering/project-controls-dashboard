import { startsWithFormulaCharacter } from "../schemas/fields";

export const neutraliseSpreadsheetCell = (value: string) =>
  startsWithFormulaCharacter(value) ? "'" + value : value;

export function encodeCsvCell(value: string): string {
  const neutralised = neutraliseSpreadsheetCell(value);
  const requiresQuoting =
    neutralised !== value || /[",\r\n]/.test(neutralised);

  return requiresQuoting
    ? '"' + neutralised.replaceAll('"', '""') + '"'
    : neutralised;
}

export function encodeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(encodeCsvCell).join(",")).join("\r\n") + "\r\n";
}
