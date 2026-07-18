import Dexie, { type DexieOptions, type Table } from "dexie";
import type {
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
} from "../domain/records";
import type { ImportManifest } from "../schemas/manifest";
import { IMPORT_SCHEMA_VERSION } from "../schemas/manifest";

export interface MetaRecord {
  key: "activeImportId" | "schemaVersion";
  value: string;
}

export interface StoredActivity extends NormalisedActivity {
  importId: string;
}

export interface StoredPerformanceRecord extends PerformanceRecord {
  importId: string;
}

export interface ProjectConfigurationRecord {
  projectId: string;
  configuration: ProjectConfigurationInput;
  createdImportId: string;
  updatedAt: string;
}

export class ProjectControlsDb extends Dexie {
  meta!: Table<MetaRecord, string>;
  manifests!: Table<ImportManifest, string>;
  activities!: Table<StoredActivity, [string, string]>;
  performance!: Table<StoredPerformanceRecord, [string, string, string]>;
  projectConfigurations!: Table<ProjectConfigurationRecord, string>;

  constructor(name = "project-controls-dashboard", options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      meta: "&key",
      manifests: "&importId, projectId, importedAt",
      activities: "[importId+activityId], importId, activityId",
      performance:
        "[importId+activityId+periodEnd], importId, [importId+activityId], periodEnd",
      projectConfigurations: "&projectId",
    });
    this.on("populate", () =>
      this.meta.add({ key: "schemaVersion", value: IMPORT_SCHEMA_VERSION }),
    );
  }
}
