import { useMemo } from "react";
import {
  buildImportedPerformanceSnapshot,
  buildSyntheticPerformanceSnapshot,
} from "../domain/viewModels/projectPerformance";
import { useActiveDataset } from "./ActiveDatasetContext";

const syntheticTestSnapshot =
  import.meta.env.MODE === "test" ? buildSyntheticPerformanceSnapshot() : undefined;

export function useProjectPerformance() {
  const active = useActiveDataset();
  const snapshot = useMemo(
    () =>
      active.dataset
        ? buildImportedPerformanceSnapshot(active.dataset)
        : syntheticTestSnapshot,
    [active.dataset],
  );

  return { ...active, snapshot };
}
