import { describe, expect, it } from "vitest";
import { createSyntheticImportFiles } from "./demoImportFiles";
import {
  processImportFiles,
  type ImportProcessingInput,
} from "./importProcessor";
import {
  executeImportProcessing,
  type ImportWorkerPort,
} from "./importWorkerClient";
import {
  IMPORT_WORKER_PROTOCOL_VERSION,
  type ImportWorkerResponse,
} from "./importWorkerProtocol";

const demoInput = async (): Promise<ImportProcessingInput> => {
  const files = createSyntheticImportFiles();
  return {
    schedule: {
      kind: "schedule",
      fileName: files.schedule.name,
      bytes: await files.schedule.arrayBuffer(),
    },
    performance: {
      kind: "performance",
      fileName: files.performance.name,
      bytes: await files.performance.arrayBuffer(),
    },
  };
};

const inProcessWorker = (): ImportWorkerPort => {
  const port: ImportWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (request) => {
      void processImportFiles(request.input).then((result) => {
        const response: ImportWorkerResponse = {
          protocolVersion: IMPORT_WORKER_PROTOCOL_VERSION,
          requestId: request.requestId,
          type: "result",
          result,
        };
        port.onmessage?.({ data: response } as MessageEvent<ImportWorkerResponse>);
      });
    },
    terminate: () => undefined,
  };
  return port;
};

describe("typed import worker boundary", () => {
  it("produces exactly the same result in the worker and pure processor", async () => {
    const input = await demoInput();
    const direct = await processImportFiles(input);
    const executed = await executeImportProcessing(input, {
      workerFactory: inProcessWorker,
    });

    expect(executed.runtime.mode).toBe("worker");
    expect(executed.result).toEqual(direct);
    expect(executed.result.preview?.scheduleCounts.acceptedRows).toBe(60);
    expect(executed.result.preview?.performanceCounts.acceptedRows).toBe(960);
  });

  it("falls back with identical results when the module worker cannot start", async () => {
    const input = await demoInput();
    const direct = await processImportFiles(input);
    const executed = await executeImportProcessing(input, {
      workerFactory: () => {
        throw new Error("worker construction blocked");
      },
    });

    expect(executed.runtime).toMatchObject({
      mode: "fallback",
      warning:
        "The module worker could not start; identical validation ran on the compatibility fallback.",
    });
    expect(executed.result).toEqual(direct);
  });
});
