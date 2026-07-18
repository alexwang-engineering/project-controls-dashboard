import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(repositoryRoot, "src/test/fixtures/csv");
const generatedFixtures = [];

const scheduleHeaders = [
  "project_id",
  "baseline_version",
  "activity_id",
  "wbs_id",
  "activity_name",
  "owner",
  "baseline_start",
  "baseline_finish",
  "forecast_start",
  "forecast_finish",
  "actual_start",
  "actual_finish",
  "predecessor_links",
  "calendar_id",
  "constraint_type",
  "constraint_date",
  "is_milestone",
  "baseline_budget",
  "progress_method",
  "commentary",
];

const performanceHeaders = [
  "project_id",
  "baseline_version",
  "period_end",
  "activity_id",
  "pv_period",
  "ev_period",
  "ac_period",
  "physical_percent_complete",
  "remaining_cost_forecast",
  "progress_commentary",
];

const scheduleDefaults = {
  project_id: "ASTER",
  baseline_version: "B0",
  activity_id: "A-001",
  wbs_id: "WP100",
  activity_name: "Confirm design requirements",
  owner: "Design Lead",
  baseline_start: "2026-04-06",
  baseline_finish: "2026-04-10",
  forecast_start: "2026-04-06",
  forecast_finish: "2026-04-10",
  actual_start: "2026-04-06",
  actual_finish: "2026-04-10",
  predecessor_links: "",
  calendar_id: "CAL-5D",
  constraint_type: "none",
  constraint_date: "",
  is_milestone: "false",
  baseline_budget: "100000",
  progress_method: "percent_complete",
  commentary: "Accepted fixture record",
};

const performanceDefaults = {
  project_id: "ASTER",
  baseline_version: "B0",
  period_end: "2026-04-12",
  activity_id: "A-001",
  pv_period: "25000",
  ev_period: "25000",
  ac_period: "24000",
  physical_percent_complete: "25",
  remaining_cost_forecast: "75000",
  progress_commentary: "First reporting period",
};

const encodeCell = (value) => {
  const text = String(value);
  return /[",\r\n]/.test(text)
    ? '"' + text.replaceAll('"', '""') + '"'
    : text;
};

const row = (headers, values) =>
  headers.map((header) => encodeCell(values[header] ?? "")).join(",");

const scheduleRow = (overrides = {}) =>
  row(scheduleHeaders, { ...scheduleDefaults, ...overrides });

const performanceRow = (overrides = {}) =>
  row(performanceHeaders, { ...performanceDefaults, ...overrides });

const writeFixture = (relativePath, content, options = {}) => {
  const target = resolve(fixtureRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  const body = Buffer.from(content, "utf8");
  const bytes = options.bom
    ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])
    : body;
  writeFileSync(target, bytes);
  generatedFixtures.push({ relativePath, bytes });
};

const scheduleHeader = scheduleHeaders.join(",");
const performanceHeader = performanceHeaders.join(",");

writeFixture(
  "rfc/schedule-lf-no-final-newline.csv",
  scheduleHeader + "\n" + scheduleRow(),
);
writeFixture(
  "rfc/schedule-crlf.csv",
  scheduleHeader + "\r\n" + scheduleRow() + "\r\n",
);
writeFixture(
  "rfc/schedule-bom.csv",
  scheduleHeader + "\n" + scheduleRow() + "\n",
  { bom: true },
);
writeFixture(
  "rfc/schedule-embedded-comma.csv",
  scheduleHeader +
    "\n" +
    scheduleRow({ commentary: "Access, survey, and permit accepted" }) +
    "\n",
);
writeFixture(
  "rfc/schedule-doubled-quotes.csv",
  scheduleHeader +
    "\n" +
    scheduleRow({ commentary: 'Supplier said "ready"' }) +
    "\n",
);
writeFixture(
  "rfc/schedule-multiline.csv",
  scheduleHeader +
    "\r\n" +
    scheduleRow({ commentary: "First line\r\nSecond line" }) +
    "\r\n",
);
writeFixture(
  "rfc/schedule-blank-line.csv",
  scheduleHeader +
    "\n" +
    scheduleRow() +
    "\n\n" +
    scheduleRow({ activity_id: "A-002", activity_name: "Second activity" }) +
    "\n",
);
writeFixture(
  "rfc/schedule-unclosed-quote.csv",
  scheduleHeader +
    "\n" +
    scheduleRow({ commentary: "UNFINISHED_QUOTE" }).replace(
      "UNFINISHED_QUOTE",
      '"Unclosed commentary',
    ),
);

const duplicateHeader = [...scheduleHeaders];
duplicateHeader[duplicateHeader.length - 1] = "owner";
writeFixture(
  "rfc/schedule-duplicate-header.csv",
  duplicateHeader.join(",") + "\n" + scheduleRow() + "\n",
);

writeFixture(
  "rfc/schedule-semicolon.csv",
  scheduleHeaders.join(";") +
    "\n" +
    scheduleHeaders.map((header) => scheduleDefaults[header] ?? "").join(";") +
    "\n",
);

const missingHeader = scheduleHeaders.filter((header) => header !== "commentary");
writeFixture(
  "rfc/schedule-missing-header.csv",
  missingHeader.join(",") +
    "\n" +
    row(missingHeader, scheduleDefaults) +
    "\n",
);

const extraHeader = [...scheduleHeaders, "unexpected_column"];
writeFixture(
  "rfc/schedule-extra-header.csv",
  extraHeader.join(",") +
    "\n" +
    row(extraHeader, { ...scheduleDefaults, unexpected_column: "unexpected" }) +
    "\n",
);

const reorderedHeader = [...scheduleHeaders].reverse();
writeFixture(
  "rfc/schedule-reordered-header.csv",
  reorderedHeader.join(",") +
    "\n" +
    row(reorderedHeader, scheduleDefaults) +
    "\n",
);

writeFixture("rfc/empty.csv", "");
writeFixture("rfc/schedule-header-only.csv", scheduleHeader + "\n");
writeFixture(
  "rfc/schedule-wrong-extension.txt",
  scheduleHeader + "\n" + scheduleRow() + "\n",
);
writeFixture(
  "rfc/renamed-xlsx.csv",
  Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x01]),
);

const tenThousandAndOneRows = Array.from({ length: 10_001 }, (_, index) =>
  scheduleRow({
    activity_id: "A-" + String(index + 1).padStart(5, "0"),
    activity_name: "Generated limit record " + String(index + 1),
  }),
);
writeFixture(
  "limits/schedule-10001-rows.csv",
  scheduleHeader + "\n" + tenThousandAndOneRows.join("\n") + "\n",
);
writeFixture(
  "limits/schedule-cell-1001.csv",
  scheduleHeader +
    "\n" +
    scheduleRow({ commentary: "A".repeat(1_001) }) +
    "\n",
);
writeFixture(
  "limits/file-too-large.csv",
  Buffer.alloc(5 * 1024 * 1024 + 1, 0x41),
);

writeFixture(
  "hostile/schedule-formula-identifier.csv",
  scheduleHeader +
    "\n" +
    scheduleRow({ activity_id: "=cmd|' /C calc'!A0" }) +
    "\n",
);
writeFixture(
  "hostile/schedule-formula-commentary.csv",
  scheduleHeader +
    "\n" +
    scheduleRow({ commentary: "=cmd|' /C calc'!A0" }) +
    "\n",
);
writeFixture(
  "hostile/schedule-html-commentary.csv",
  scheduleHeader +
    "\n" +
    scheduleRow({ commentary: '<script>alert("fixture")</script>' }) +
    "\n",
);
writeFixture(
  "hostile/schedule-leading-control-text.csv",
  scheduleHeader +
    "\r\n" +
    [
      scheduleRow({ activity_id: "A-101", commentary: "+SUM(A1)" }),
      scheduleRow({ activity_id: "A-102", commentary: "@SUM(A1)" }),
      scheduleRow({ activity_id: "A-103", commentary: "\tformula" }),
      scheduleRow({ activity_id: "A-104", commentary: "\rformula" }),
    ].join("\r\n") +
    "\r\n",
);
writeFixture(
  "hostile/schedule-url-text.csv",
  scheduleHeader +
    "\n" +
    [
      scheduleRow({ activity_id: "A-201", commentary: "javascript:alert(1)" }),
      scheduleRow({ activity_id: "A-202", commentary: "data:text/html,fixture" }),
    ].join("\n") +
    "\n",
);
writeFixture(
  "hostile/schedule-unicode.csv",
  scheduleHeader +
    "\n" +
    scheduleRow({
      activity_name: "Unicode interface check ⚙️",
      commentary: "RTL \u202e marker, zero-width \u200b marker, emoji ✅",
    }) +
    "\n",
);
writeFixture(
  "hostile/performance-negative-ac.csv",
  performanceHeader +
    "\n" +
    performanceRow({ ac_period: "-1200" }) +
    "\n",
);
writeFixture(
  "hostile/performance-formula-ac.csv",
  performanceHeader +
    "\n" +
    performanceRow({ ac_period: "=1+1" }) +
    "\n",
);

const checksumLines = generatedFixtures
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  .map(({ relativePath, bytes }) => {
    const checksum = createHash("sha256").update(bytes).digest("hex");
    return checksum + "  " + relativePath;
  });
writeFileSync(resolve(fixtureRoot, "SHA256SUMS"), checksumLines.join("\n") + "\n");

process.stdout.write(
  "Generated " + String(generatedFixtures.length) + " exact CSV fixtures.\n",
);
