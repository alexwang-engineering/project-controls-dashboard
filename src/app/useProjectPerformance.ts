import { useMemo } from "react";
import {
  buildImportedPerformanceSnapshot,
  buildSyntheticPerformanceSnapshot,
} from "../domain/viewModels/projectPerformance";
import { useActiveDataset } from "./ActiveDatasetContext";

const syntheticSnapshot = buildSyntheticPerformanceSnapshot();

export function useProjectPerformance() {
  const active = useActiveDataset();
  const snapshot = useMemo(
    () =>
      active.dataset
        ? buildImportedPerformanceSnapshot(active.dataset)
        : syntheticSnapshot,
    [active.dataset],
  );

  return { ...active, snapshot };
}
