import { DatasetRepository } from "./datasetRepository";
import { ProjectControlsDb } from "./db";
import { ImportRepository } from "./importRepository";

let browserRepositories:
  | {
      db: ProjectControlsDb;
      datasets: DatasetRepository;
      imports: ImportRepository;
    }
  | undefined;

export function getBrowserRepositories() {
  if (browserRepositories !== undefined) return browserRepositories;

  const db = new ProjectControlsDb();
  browserRepositories = {
    db,
    datasets: new DatasetRepository(db),
    imports: new ImportRepository(db),
  };
  return browserRepositories;
}
