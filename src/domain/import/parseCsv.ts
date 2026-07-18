import Papa from "papaparse";
import type { ValidationIssue } from "../../schemas/validationIssue";
import { truncateSuppliedValue } from "../../schemas/validationIssue";
import {
  MAX_CSV_CELL_CHARACTERS,
  MAX_CSV_DATA_ROWS,
  MAX_CSV_FILE_BYTES,
} from "./limits";

export interface CsvContract {
  fileName: string;
  requiredHeaders: readonly string[];
  maximumCellCharacters?: number;
  maximumDataRows?: number;
  maximumFileBytes?: number;
}

export interface RawCsvRecord {
  recordNumber: number;
  physicalLineStart?: number;
  cells: string[];
}

export interface CsvParseResult {
  header: string[];
  records: RawCsvRecord[];
  issues: ValidationIssue[];
  hadBom: boolean;
}

interface ScannedRecord {
  raw: string;
  physicalLineStart: number;
}

const emptyParseResult = (issues: ValidationIssue[]): CsvParseResult => ({
  header: [],
  records: [],
  issues,
  hadBom: false,
});

export function parseCsvBytes(
  bytes: Uint8Array,
  contract: CsvContract,
): CsvParseResult {
  const issues: ValidationIssue[] = [];

  if (!contract.fileName.toLowerCase().endsWith(".csv")) {
    issues.push({
      severity: "blocking",
      code: "file_extension",
      fileName: contract.fileName,
      rule: "The MVP import allowlist accepts .csv files only.",
      suggestion: "Export the source data as a CSV file.",
    });
  }

  const maximumFileBytes = contract.maximumFileBytes ?? MAX_CSV_FILE_BYTES;
  if (bytes.byteLength > maximumFileBytes) {
    issues.push({
      severity: "blocking",
      code: "file_size",
      fileName: contract.fileName,
      suppliedValue: String(bytes.byteLength) + " bytes",
      rule: "File exceeds the " + String(maximumFileBytes) + " byte limit.",
      suggestion: "Split or reduce the source file before importing it.",
    });
  }

  if (issues.length > 0) return emptyParseResult(issues);

  const hasUtf8Bom =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = hasUtf8Bom ? bytes.slice(3) : bytes;

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return parseCsvText((hasUtf8Bom ? "\ufeff" : "") + decoded, contract);
  } catch {
    return emptyParseResult([
      {
        severity: "blocking",
        code: "invalid_utf8",
        fileName: contract.fileName,
        rule: "File is not valid UTF-8 text.",
        suggestion: "Export the source file as UTF-8 CSV and try again.",
      },
    ]);
  }
}

function scanRecordBoundaries(input: string): ScannedRecord[] {
  const records: ScannedRecord[] = [];
  let recordStart = 0;
  let recordLine = 1;
  let currentLine = 1;
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character !== "\n" && character !== "\r") continue;

    const isCrLf = character === "\r" && input[index + 1] === "\n";
    const endingWidth = isCrLf ? 2 : 1;

    if (!inQuotes) {
      records.push({
        raw: input.slice(recordStart, index),
        physicalLineStart: recordLine,
      });
      recordStart = index + endingWidth;
      recordLine = currentLine + 1;
    }

    currentLine += 1;
    if (isCrLf) index += 1;
  }

  records.push({
    raw: input.slice(recordStart),
    physicalLineStart: recordLine,
  });

  return records;
}

const hasTerminalRecordEnding = (input: string) => /(?:\r\n|\r|\n)$/.test(input);

const duplicateHeaders = (headers: readonly string[]) => {
  const counts = new Map<string, number>();
  for (const header of headers) counts.set(header, (counts.get(header) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([header]) => header);
};

export function parseCsvText(
  rawInput: string,
  contract: CsvContract,
): CsvParseResult {
  const hadBom = rawInput.charCodeAt(0) === 0xfeff;
  const input = hadBom ? rawInput.slice(1) : rawInput;
  const scannedRecords = scanRecordBoundaries(input);
  const parsed = Papa.parse<string[]>(input, {
    delimiter: ",",
    header: false,
    dynamicTyping: false,
    skipEmptyLines: false,
  });
  const rows = parsed.data.map((row) => row.map(String));

  if (
    hasTerminalRecordEnding(input) &&
    rows.at(-1)?.length === 1 &&
    rows.at(-1)?.[0] === ""
  ) {
    rows.pop();
    scannedRecords.pop();
  }

  // The scanner exists only to enrich Papa's authoritative record numbers with
  // a physical-line hint. If their record boundaries ever diverge, omitting the
  // hint is safer than reporting a plausible but incorrect physical line.
  const physicalLineAlignmentIsReliable = scannedRecords.length === rows.length;
  const physicalLineStartFor = (rowIndex: number) =>
    physicalLineAlignmentIsReliable
      ? scannedRecords[rowIndex]?.physicalLineStart
      : undefined;

  const header = rows[0] ?? [];
  const issues: ValidationIssue[] = [];

  if (hadBom) {
    issues.push({
      severity: "information",
      code: "bom_removed",
      fileName: contract.fileName,
      recordNumber: 1,
      physicalLineStart: 1,
      rule: "A leading UTF-8 BOM is accepted and removed.",
      suggestion: "No action is required.",
    });
  }

  for (const error of parsed.errors) {
    const rowIndex = error.row ?? 0;
    issues.push({
      severity: "blocking",
      code: "csv_" + error.code.toLowerCase(),
      fileName: contract.fileName,
      recordNumber: rowIndex + 1,
      physicalLineStart: physicalLineStartFor(rowIndex),
      rule: error.message,
      suggestion: "Correct the CSV structure and import the file again.",
    });
  }

  const duplicates = duplicateHeaders(header);
  if (duplicates.length > 0) {
    issues.push({
      severity: "blocking",
      code: "duplicate_header",
      fileName: contract.fileName,
      recordNumber: 1,
      physicalLineStart: 1,
      suppliedValue: duplicates.join(", "),
      rule: "Header names must be unique.",
      suggestion: "Remove or rename the duplicated columns.",
    });
  }

  const expected = new Set(contract.requiredHeaders);
  const supplied = new Set(header);
  const missing = contract.requiredHeaders.filter((name) => !supplied.has(name));
  const unexpected = header.filter((name) => !expected.has(name));

  if (missing.length > 0 || unexpected.length > 0) {
    issues.push({
      severity: "blocking",
      code: "header_contract",
      fileName: contract.fileName,
      recordNumber: 1,
      physicalLineStart: 1,
      rule:
        "Headers must be an exact set. Missing: " +
        (missing.join(", ") || "none") +
        "; unexpected: " +
        (unexpected.join(", ") || "none") +
        ".",
      suggestion: "Use the current versioned CSV template.",
    });
  }

  const maximumCellCharacters =
    contract.maximumCellCharacters ?? MAX_CSV_CELL_CHARACTERS;
  const records = rows.slice(1).map((cells, index): RawCsvRecord => {
    const recordNumber = index + 2;
    const scanned = scannedRecords[index + 1];
    const physicalLineStart = physicalLineStartFor(index + 1);

    if (physicalLineAlignmentIsReliable && scanned?.raw === "") {
      issues.push({
        severity: "blocking",
        code: "blank_physical_line",
        fileName: contract.fileName,
        recordNumber,
        physicalLineStart,
        rule: "Blank physical lines outside quoted fields are not allowed.",
        suggestion: "Delete the blank line without shifting adjacent records.",
      });
    }

    if (cells.length !== header.length) {
      issues.push({
        severity: "blocking",
        code: "column_count",
        fileName: contract.fileName,
        recordNumber,
        physicalLineStart,
        rule:
          "Record contains " +
          String(cells.length) +
          " fields; the header contains " +
          String(header.length) +
          ".",
        suggestion: "Correct missing delimiters, extra delimiters, or quoting.",
      });
    }

    cells.forEach((cell, columnIndex) => {
      if (cell.length <= maximumCellCharacters) return;
      issues.push({
        severity: "blocking",
        code: "cell_length",
        fileName: contract.fileName,
        recordNumber,
        physicalLineStart,
        column: header[columnIndex] ?? "column_" + String(columnIndex + 1),
        suppliedValue: truncateSuppliedValue(cell),
        rule:
          "Cell exceeds the " + String(maximumCellCharacters) + " character limit.",
        suggestion: "Shorten the supplied value.",
      });
    });

    return {
      recordNumber,
      physicalLineStart,
      cells,
    };
  });

  if (records.length === 0) {
    issues.push({
      severity: "blocking",
      code: "no_data_rows",
      fileName: contract.fileName,
      rule: "A CSV file must contain at least one data record.",
      suggestion: "Add data below the required header row.",
    });
  }

  const maximumDataRows = contract.maximumDataRows ?? MAX_CSV_DATA_ROWS;
  if (records.length > maximumDataRows) {
    issues.push({
      severity: "blocking",
      code: "row_limit",
      fileName: contract.fileName,
      suppliedValue: String(records.length) + " data records",
      rule: "File exceeds the " + String(maximumDataRows) + " data-row limit.",
      suggestion: "Split the source data into a supported project import.",
    });
  }

  return { header, records, issues, hadBom };
}
