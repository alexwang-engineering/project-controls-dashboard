import { DatasetRepository } from "./datasetRepository";
import { ProjectControlsDb } from "./db";
import { ImportRepository } from "./importRepository";
import { BackupRepository } from "./backupRepository";
import { ProjectConfigurationRepository } from "./projectConfigurationRepository";

let browserRepositories:
  | {
      db: ProjectControlsDb;
      datasets: DatasetRepository;
      imports: ImportRepository;
      backups: BackupRepository;
      configurations: ProjectConfigurationRepository;
    }
  | undefined;

export function getBrowserRepositories() {
  if (browserRepositories !== undefined) return browserRepositories;

  const db = new ProjectControlsDb();
  const imports = new ImportRepository(db);
  browserRepositories = {
    db,
    datasets: new DatasetRepository(db),
    imports,
    backups: new BackupRepository(db, imports),
    configurations: new ProjectConfigurationRepository(db),
  };
  return browserRepositories;
}
