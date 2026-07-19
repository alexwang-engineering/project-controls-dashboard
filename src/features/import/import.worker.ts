import { processImportFiles } from "./importProcessor";
import {
  IMPORT_WORKER_PROTOCOL_VERSION,
  type ImportWorkerRequest,
  type ImportWorkerResponse,
} from "./importWorkerProtocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<ImportWorkerRequest>) => void) | null;
  postMessage: (response: ImportWorkerResponse) => void;
}

const workerScope = globalThis as unknown as WorkerScope;

workerScope.onmessage = (event) => {
  const request = event.data;
  if (
    request.protocolVersion !== IMPORT_WORKER_PROTOCOL_VERSION ||
    request.type !== "process-import"
  ) {
    return;
  }
  void processImportFiles(request.input)
    .then((result) => {
      workerScope.postMessage({
        protocolVersion: IMPORT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "result",
        result,
      });
    })
    .catch((error: unknown) => {
      workerScope.postMessage({
        protocolVersion: IMPORT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "The import worker could not process the selected files.",
      });
    });
};
