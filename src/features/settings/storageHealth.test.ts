import { describe, expect, it, vi } from "vitest";
import { readStorageHealth, requestPersistentStorage } from "./storageHealth";

describe("browser storage health", () => {
  it("reports usage, quota and persistence without promising durability", async () => {
    const storage = {
      estimate: vi.fn().mockResolvedValue({ usage: 25, quota: 100 }),
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    };

    await expect(readStorageHealth(storage)).resolves.toMatchObject({
      availability: "supported",
      usageBytes: 25,
      quotaBytes: 100,
      usagePercent: 25,
      persisted: false,
      persistenceRequestSupported: true,
    });
    const afterRequest = await requestPersistentStorage(storage);
    expect(storage.persist).toHaveBeenCalledOnce();
    expect(afterRequest.availability).toBe("supported");
  });

  it("degrades gracefully when the browser storage API is unavailable", async () => {
    await expect(readStorageHealth(undefined)).resolves.toMatchObject({
      availability: "unavailable",
      persistenceRequestSupported: false,
    });
  });
});
