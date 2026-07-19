import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ActiveDataset } from "../repositories/datasetRepository";
import { getBrowserRepositories } from "../repositories/browserRepositories";

export type ActiveDatasetStatus = "loading" | "ready" | "error";

interface ActiveDatasetContextValue {
  dataset?: ActiveDataset;
  status: ActiveDatasetStatus;
  error?: string;
  refresh: () => Promise<void>;
}

const defaultValue: ActiveDatasetContextValue = {
  status: "ready",
  refresh: async () => undefined,
};

const ActiveDatasetContext = createContext<ActiveDatasetContextValue>(defaultValue);

export function ActiveDatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<ActiveDataset>();
  const [status, setStatus] = useState<ActiveDatasetStatus>("loading");
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(undefined);
    try {
      setDataset(await getBrowserRepositories().datasets.getActiveDataset());
      setStatus("ready");
    } catch (readError) {
      setDataset(undefined);
      setError(
        readError instanceof Error
          ? readError.message
          : "The active local generation could not be read.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ dataset, status, error, refresh }),
    [dataset, error, refresh, status],
  );

  return (
    <ActiveDatasetContext.Provider value={value}>
      {children}
    </ActiveDatasetContext.Provider>
  );
}

export const useActiveDataset = () => useContext(ActiveDatasetContext);
