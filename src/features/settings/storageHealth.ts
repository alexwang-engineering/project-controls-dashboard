export interface StorageManagerLike {
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

export interface StorageHealth {
  availability: "supported" | "unavailable" | "error";
  usageBytes?: number;
  quotaBytes?: number;
  usagePercent?: number;
  persisted?: boolean;
  persistenceRequestSupported: boolean;
  message: string;
}

const browserStorage = (): StorageManagerLike | undefined =>
  typeof navigator === "undefined" ? undefined : navigator.storage;

export async function readStorageHealth(
  storage: StorageManagerLike | undefined = browserStorage(),
): Promise<StorageHealth> {
  if (storage?.estimate === undefined) {
    return {
      availability: "unavailable",
      persistenceRequestSupported: storage?.persist !== undefined,
      message: "This browser does not expose a storage estimate.",
    };
  }
  try {
    const [estimate, persisted] = await Promise.all([
      storage.estimate(),
      storage.persisted?.() ?? Promise.resolve(undefined),
    ]);
    const usageBytes = estimate.usage;
    const quotaBytes = estimate.quota;
    return {
      availability: "supported",
      usageBytes,
      quotaBytes,
      usagePercent:
        usageBytes !== undefined && quotaBytes !== undefined && quotaBytes > 0
          ? (usageBytes / quotaBytes) * 100
          : undefined,
      persisted,
      persistenceRequestSupported: storage.persist !== undefined,
      message:
        persisted === true
          ? "The browser currently marks this origin as persistent."
          : "Storage remains browser-managed and may be evicted; keep a current backup.",
    };
  } catch {
    return {
      availability: "error",
      persistenceRequestSupported: storage.persist !== undefined,
      message: "The browser could not report local storage health.",
    };
  }
}

export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined = browserStorage(),
) {
  if (storage?.persist === undefined) {
    return readStorageHealth(storage);
  }
  try {
    await storage.persist();
  } catch {
    return {
      availability: "error",
      persistenceRequestSupported: true,
      message: "The browser did not complete the persistence request.",
    } satisfies StorageHealth;
  }
  return readStorageHealth(storage);
}
