import type {
  ImportProcessingInput,
  ImportProcessingResult,
} from "./importProcessor";

export const IMPORT_WORKER_PROTOCOL_VERSION = 1 as const;

export interface ImportWorkerRequest {
  protocolVersion: typeof IMPORT_WORKER_PROTOCOL_VERSION;
  requestId: string;
  type: "process-import";
  input: ImportProcessingInput;
}

export type ImportWorkerResponse =
  | {
      protocolVersion: typeof IMPORT_WORKER_PROTOCOL_VERSION;
      requestId: string;
      type: "result";
      result: ImportProcessingResult;
    }
  | {
      protocolVersion: typeof IMPORT_WORKER_PROTOCOL_VERSION;
      requestId: string;
      type: "error";
      message: string;
    };
