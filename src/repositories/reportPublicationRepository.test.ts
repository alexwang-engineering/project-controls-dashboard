import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WeeklyReportSnapshot } from "../domain/reports/weeklyReport";
import {
  buildReportSourceFingerprint,
  type WeeklyReportNarrative,
  type WeeklyReportSourceEvidence,
} from "../domain/reports/reportPublication";
import { ProjectControlsDb } from "./db";
import {
  ReportDraftNotCurrentError,
  ReportPublicationBlockedError,
  ReportPublicationRepository,
  StaleReportSourceError,
} from "./reportPublicationRepository";

let sequence = 0;
let db: ProjectControlsDb;
let repository: ReportPublicationRepository;

const report = {
  identity: {
    projectId: "ASTER",
    projectName: "Project Aster",
    reportingPeriod: "2026-06-14",
    baselineVersion: "B0",
    generatedAt: "2026-07-19T18:00:00.000Z",
    sourceImportId: "IMPORT-001",
  },
  canPublish: true,
} as WeeklyReportSnapshot;

const evidence: WeeklyReportSourceEvidence = {
  activeImportId: "IMPORT-001",
  signedAnalyses: [],
  milestones: [],
  risks: [],
  changes: [],
};

const narrative: WeeklyReportNarrative = {
  author: "Project Controls Manager",
  managementSummary: "Management has reviewed the reconciled project position and forecast.",
  decisionsRequired: "Approve the recorded recovery resources this week.",
  nextPeriodFocus: "Track recovery output and close the late milestone exception.",
};

const input = () => ({
  report,
  evidence,
  sourceFingerprint: buildReportSourceFingerprint(report, evidence),
  narrative,
});

describe("report publication repository", () => {
  beforeEach(async () => {
    sequence += 1;
    db = new ProjectControlsDb(`report-publication-${String(sequence)}`, {
      indexedDB,
      IDBKeyRange,
    });
    repository = new ReportPublicationRepository(db);
    await db.meta.put({ key: "activeImportId", value: "IMPORT-001" });
  });

  afterEach(async () => {
    await db.delete();
  });

  it("persists one editable draft with the exact report and source evidence", async () => {
    await repository.saveDraft({ ...input(), savedAt: "2026-07-19T18:05:00.000Z" });

    const state = await repository.loadContext({
      projectId: "ASTER",
      baselineVersion: "B0",
      reportingPeriod: "2026-06-14",
      sourceImportId: "IMPORT-001",
    });
    expect(state.currentDraft?.narrative.managementSummary).toContain("reconciled");
    expect(state.currentDraft?.report.identity.generatedAt).toBe(
      "2026-07-19T18:00:00.000Z",
    );
    expect(state.currentDraft?.sourceEvidence.activeImportId).toBe("IMPORT-001");
  });

  it("publishes an immutable revision and removes only the current draft", async () => {
    await repository.saveDraft({ ...input(), savedAt: "2026-07-19T18:05:00.000Z" });
    const revisionOne = await repository.publish({
      ...input(),
      publishedAt: "2026-07-19T18:10:00.000Z",
    });
    await repository.saveDraft({
      ...input(),
      narrative: { ...narrative, nextPeriodFocus: "Monitor recovery every day and evidence completed work." },
      savedAt: "2026-07-20T09:00:00.000Z",
    });
    const revisionTwo = await repository.publish({
      ...input(),
      narrative: { ...narrative, nextPeriodFocus: "Monitor recovery every day and evidence completed work." },
      publishedAt: "2026-07-20T09:05:00.000Z",
    });

    expect(revisionOne.revision).toBe(1);
    expect(revisionOne.createdAt).toBe("2026-07-19T18:05:00.000Z");
    expect(revisionTwo.revision).toBe(2);
    const state = await repository.loadContext({
      projectId: "ASTER",
      baselineVersion: "B0",
      reportingPeriod: "2026-06-14",
      sourceImportId: "IMPORT-001",
    });
    expect(state.currentDraft).toBeUndefined();
    expect(state.publishedRevisions.map(({ revision }) => revision)).toEqual([2, 1]);
    expect(state.publishedRevisions[1]?.narrative).toEqual(narrative);
  });

  it("allows only one immutable revision when two publish clicks race", async () => {
    await repository.saveDraft({ ...input(), savedAt: "2026-07-19T18:05:00.000Z" });

    const results = await Promise.allSettled([
      repository.publish({
        ...input(),
        publishedAt: "2026-07-19T18:10:00.000Z",
      }),
      repository.publish({
        ...input(),
        publishedAt: "2026-07-19T18:10:01.000Z",
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const records = await db.reportPublications.toArray();
    const published = records.filter(({ recordType }) => recordType === "published");
    expect(published).toHaveLength(1);
    expect(published.map(({ revision }) => revision)).toEqual([1]);
    expect(new Set(published.map(({ revision }) => revision)).size).toBe(1);
    expect(records.filter(({ recordType }) => recordType === "draft")).toHaveLength(0);
  });

  it("rolls back publication when the immutable record insert fails", async () => {
    await repository.saveDraft({ ...input(), savedAt: "2026-07-19T18:05:00.000Z" });
    const injectedFailure = () => {
      throw new Error("Injected publication add failure");
    };
    db.reportPublications.hook("creating", injectedFailure);

    try {
      await expect(
        repository.publish({
          ...input(),
          publishedAt: "2026-07-19T18:10:00.000Z",
        }),
      ).rejects.toThrow("Injected publication add failure");
    } finally {
      db.reportPublications.hook.creating.unsubscribe(injectedFailure);
    }

    const records = await db.reportPublications.toArray();
    expect(records.filter(({ recordType }) => recordType === "draft")).toHaveLength(1);
    expect(records.filter(({ recordType }) => recordType === "published")).toHaveLength(0);
  });

  it("allows only one immutable revision when three publish attempts race", async () => {
    await repository.saveDraft({ ...input(), savedAt: "2026-07-19T18:05:00.000Z" });

    const results = await Promise.allSettled([
      repository.publish({
        ...input(),
        publishedAt: "2026-07-19T18:10:00.000Z",
      }),
      repository.publish({
        ...input(),
        publishedAt: "2026-07-19T18:10:01.000Z",
      }),
      repository.publish({
        ...input(),
        publishedAt: "2026-07-19T18:10:02.000Z",
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(2);
    const records = await db.reportPublications.toArray();
    expect(
      records
        .filter(({ recordType }) => recordType === "published")
        .map(({ revision }) => revision),
    ).toEqual([1]);
    expect(records.filter(({ recordType }) => recordType === "draft")).toHaveLength(0);
  });

  it("rejects a stale active-generation pointer without changing the draft", async () => {
    await repository.saveDraft({ ...input(), savedAt: "2026-07-19T18:05:00.000Z" });
    await db.meta.put({ key: "activeImportId", value: "IMPORT-002" });

    await expect(
      repository.publish({ ...input(), publishedAt: "2026-07-19T18:10:00.000Z" }),
    ).rejects.toBeInstanceOf(StaleReportSourceError);
    expect(await db.reportPublications.count()).toBe(1);
  });

  it("rejects publication when the live fingerprint no longer matches the saved draft", async () => {
    await repository.saveDraft({ ...input(), savedAt: "2026-07-19T18:05:00.000Z" });

    await expect(
      repository.publish({
        ...input(),
        sourceFingerprint: "changed-source-fingerprint",
        publishedAt: "2026-07-19T18:10:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ReportDraftNotCurrentError);
    expect(await db.reportPublications.count()).toBe(1);
  });

  it("rejects publication of a report whose controls are blocked", async () => {
    const blocked = { ...report, canPublish: false };
    const blockedInput = {
      ...input(),
      report: blocked,
      sourceFingerprint: buildReportSourceFingerprint(blocked, evidence),
    };
    await repository.saveDraft({
      ...blockedInput,
      savedAt: "2026-07-19T18:05:00.000Z",
    });

    await expect(
      repository.publish({
        ...blockedInput,
        publishedAt: "2026-07-19T18:10:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ReportPublicationBlockedError);
    expect(await db.reportPublications.count()).toBe(1);
  });
});
