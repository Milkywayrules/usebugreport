"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ReportStatusValue } from "@/lib/reports/status";

export interface SpotlightProjectRow {
  id: string;
  name: string;
}

export interface SpotlightCommandBridge {
  bulkPatchStatus?: (status: ReportStatusValue) => Promise<void>;
  bulkPushLinear?: () => void;
  canEdit?: boolean;
  pushLinear?: () => void | Promise<void>;
  patchStatus?: (
    reportId: string,
    status: ReportStatusValue
  ) => Promise<void>;
  projects: SpotlightProjectRow[];
  reportId?: string;
  selectedReportIds: string[];
  workspaceSlug?: string;
}

const EMPTY_BRIDGE: SpotlightCommandBridge = {
  projects: [],
  selectedReportIds: [],
};

interface SpotlightCommandContextValue {
  bridge: SpotlightCommandBridge;
  setBridge: (patch: Partial<SpotlightCommandBridge>) => void;
}

const SpotlightCommandContext = createContext<SpotlightCommandContextValue>({
  bridge: EMPTY_BRIDGE,
  setBridge: () => undefined,
});

export function SpotlightCommandProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridgeState] = useState<SpotlightCommandBridge>(EMPTY_BRIDGE);

  const setBridge = useCallback((patch: Partial<SpotlightCommandBridge>) => {
    setBridgeState((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo(() => ({ bridge, setBridge }), [bridge, setBridge]);

  return (
    <SpotlightCommandContext.Provider value={value}>
      {children}
    </SpotlightCommandContext.Provider>
  );
}

export function useSpotlightCommandBridge(): SpotlightCommandContextValue {
  return useContext(SpotlightCommandContext);
}

export function useRegisterSpotlightBridge(
  patch: Partial<SpotlightCommandBridge>,
  deps: unknown[] = []
): void {
  const { setBridge } = useSpotlightCommandBridge();
  useEffect(() => {
    setBridge(patch);
    return () => {
      setBridge({
        bulkPatchStatus: undefined,
        bulkPushLinear: undefined,
        canEdit: undefined,
        pushLinear: undefined,
        patchStatus: undefined,
        projects: [],
        reportId: undefined,
        selectedReportIds: [],
      });
    };
  }, deps);
}
