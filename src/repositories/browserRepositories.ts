import { DatasetRepository } from "./datasetRepository";
import { ProjectControlsDb } from "./db";
import { ImportRepository } from "./importRepository";
import { BackupRepository } from "./backupRepository";
import { ProjectConfigurationRepository } from "./projectConfigurationRepository";
import { ReportPublicationRepository } from "./reportPublicationRepository";
import { ManagementRegisterRepository } from "./managementRegisterRepository";
import { RiskAppetiteRepository } from "./riskAppetiteRepository";

let browserRepositories:
  | {
      db: ProjectControlsDb;
      datasets: DatasetRepository;
      imports: ImportRepository;
      backups: BackupRepository;
      configurations: ProjectConfigurationRepository;
      reportPublications: ReportPublicationRepository;
      managementRegisters: ManagementRegisterRepository;
      riskAppetite: RiskAppetiteRepository;
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
    reportPublications: new ReportPublicationRepository(db),
    managementRegisters: new ManagementRegisterRepository(db),
    riskAppetite: new RiskAppetiteRepository(db),
  };
  return browserRepositories;
}
