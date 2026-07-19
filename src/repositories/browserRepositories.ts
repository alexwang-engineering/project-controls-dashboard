import { DatasetRepository } from "./datasetRepository";
import { ProjectControlsDb } from "./db";
import { ImportRepository } from "./importRepository";
import { BackupRepository } from "./backupRepository";

let browserRepositories:
  | {
      db: ProjectControlsDb;
      datasets: DatasetRepository;
      imports: ImportRepository;
      backups: BackupRepository;
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
  };
  return browserRepositories;
}
