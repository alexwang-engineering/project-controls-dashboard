import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fixtureRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../test/fixtures/csv",
);

describe("checked-in CSV fixture integrity", () => {
  it("matches every exact fixture to its pinned SHA-256 checksum", () => {
    const checksumFile = readFileSync(resolve(fixtureRoot, "SHA256SUMS"), "utf8");
    const entries = checksumFile
      .trimEnd()
      .split("\n")
      .map((line) => {
        const [checksum = "", relativePath = ""] = line.split("  ");
        return { checksum, relativePath };
      });

    expect(entries).toHaveLength(29);

    for (const entry of entries) {
      const bytes = readFileSync(resolve(fixtureRoot, entry.relativePath));
      const actual = createHash("sha256").update(bytes).digest("hex");
      expect(actual, entry.relativePath).toBe(entry.checksum);
    }
  });
});
