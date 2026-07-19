import {
  processImportFiles,
  type ImportProcessingInput,
  type ImportProcessingResult,
} from "./importProcessor";
import {
  IMPORT_WORKER_PROTOCOL_VERSION,
  type ImportWorkerRequest,
  type ImportWorkerResponse,
} from "./importWorkerProtocol";

export interface ImportRuntimeEvidence {
  mode: "worker" | "fallback";
  durationMs: number;
  warning?: string;
}

export interface ExecutedImportProcessing {
  result: ImportProcessingResult;
  runtime: ImportRuntimeEvidence;
}

export interface ImportWorkerPort {
  onmessage: ((event: MessageEvent<ImportWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (request: ImportWorkerRequest, transfer: Transferable[]) => void;
  terminate: () => void;
}

export type ImportWorkerFactory = () => ImportWorkerPort;

const createModuleWorker: ImportWorkerFactory = () =>
  new Worker(new URL("./import.worker.ts", import.meta.url), {
    type: "module",
    name: "project-controls-import",
  });

const fallback = async (
  input: ImportProcessingInput,
  startedAt: number,
  warning: string,
): Promise<ExecutedImportProcessing> => ({
  result: await processImportFiles(input),
  runtime: {
    mode: "fallback",
    durationMs: performance.now() - startedAt,
    warning,
  },
});

export async function executeImportProcessing(
  input: ImportProcessingInput,
  options: {
    workerFactory?: ImportWorkerFactory;
    timeoutMs?: number;
  } = {},
): Promise<ExecutedImportProcessing> {
  const startedAt = performance.now();
  if (typeof Worker === "undefined" && options.workerFactory === undefined) {
    return fallback(
      input,
      startedAt,
      "Module workers are unavailable; identical validation ran on the compatibility fallback.",
    );
  }

  let worker: ImportWorkerPort;
  try {
    worker = (options.workerFactory ?? createModuleWorker)();
  } catch {
    return fallback(
      input,
      startedAt,
      "The module worker could not start; identical validation ran on the compatibility fallback.",
    );
  }

  const requestId = globalThis.crypto.randomUUID();
  const workerInput: ImportProcessingInput = {
    ...input,
    schedule: { ...input.schedule, bytes: input.schedule.bytes.slice(0) },
    performance: { ...input.performance, bytes: input.performance.bytes.slice(0) },
  };

  try {
    const result = await new Promise<ImportProcessingResult>((resolve, reject) => {
      const timeout = globalThis.setTimeout(
        () => reject(new Error("The import worker timed out.")),
        options.timeoutMs ?? 30_000,
      );
      const finish = (operation: () => void) => {
        globalThis.clearTimeout(timeout);
        operation();
      };
      worker.onmessage = (event) => {
        const response = event.data;
        if (
          response.protocolVersion !== IMPORT_WORKER_PROTOCOL_VERSION ||
          response.requestId !== requestId
        ) {
          return;
        }
        if (response.type === "error") {
          finish(() => reject(new Error(response.message)));
          return;
        }
        finish(() => resolve(response.result));
      };
      worker.onerror = (event) =>
        finish(() => reject(new Error(event.message || "Import worker error.")));
      worker.onmessageerror = () =>
        finish(() => reject(new Error("Import worker message error.")));
      worker.postMessage(
        {
          protocolVersion: IMPORT_WORKER_PROTOCOL_VERSION,
          requestId,
          type: "process-import",
          input: workerInput,
        },
        [workerInput.schedule.bytes, workerInput.performance.bytes],
      );
    });
    return {
      result,
      runtime: {
        mode: "worker",
        durationMs: performance.now() - startedAt,
      },
    };
  } catch {
    return fallback(
      input,
      startedAt,
      "The module worker did not complete; identical validation ran on the compatibility fallback.",
    );
  } finally {
    worker.terminate();
  }
}
