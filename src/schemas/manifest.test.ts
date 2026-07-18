import { describe, expect, it } from "vitest";
import { importManifestDraftSchema } from "./manifest";

const counts = {
  sourceRows: 2,
  acceptedRows: 1,
  blockedRows: 1,
  quarantinedRows: 1,
  warningIssues: 0,
};

const validDraft = () => ({
  importId: "IMPORT-001",
  schemaVersion: "1",
  projectId: "ASTER",
  baselineVersion: "B0",
  dataDate: "2026-04-12",
  importedAt: "2026-07-18T12:00:00.000Z",
  files: [
    {
      kind: "schedule",
      originalFileName: "schedule.csv",
      byteSize: 100,
      checksumSha256: "a".repeat(64),
      counts,
    },
    {
      kind: "performance",
      originalFileName: "performance.csv",
      byteSize: 100,
      checksumSha256: "b".repeat(64),
      counts,
    },
  ],
  totals: {
    sourceRows: 4,
    acceptedRows: 2,
    blockedRows: 2,
    quarantinedRows: 2,
    warningIssues: 0,
  },
  quarantinedRecords: [
    {
      fileName: "schedule.csv",
      recordNumber: 3,
      reasonCodes: ["self_link"],
      rationale: "Explicit exclusion.",
    },
    {
      fileName: "performance.csv",
      recordNumber: 3,
      reasonCodes: ["unknown_activity_reference"],
      rationale: "Explicit dependent exclusion.",
    },
  ],
  projectConfigurationConfirmed: true,
  duplicateChecksumConfirmed: false,
});

describe("immutable import manifest reconciliation", () => {
  it("accepts totals that reconcile across files and quarantine detail", () => {
    expect(importManifestDraftSchema.safeParse(validDraft()).success).toBe(true);
  });

  it("rejects accepted-plus-blocked and quarantine-count drift", () => {
    const draft = validDraft();
    draft.files[0]!.counts = { ...counts, acceptedRows: 2 };
    draft.quarantinedRecords.pop();

    const result = importManifestDraftSchema.safeParse(draft);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "Source rows must equal accepted rows plus blocked rows.",
          "Quarantined record details must reconcile with the total.",
        ]),
      );
    }
  });

  it("rejects duplicate quarantine detail even when its count is unchanged", () => {
    const draft = validDraft();
    draft.quarantinedRecords[1] = { ...draft.quarantinedRecords[0]! };

    const result = importManifestDraftSchema.safeParse(draft);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: "Each quarantined source record must appear exactly once.",
        }),
      );
    }
  });
});
