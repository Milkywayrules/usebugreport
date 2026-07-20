"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { switchWorkspace as performWorkspaceSwitch } from "@/lib/workspace-switch";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceSwitchContextValue {
  isSwitching: boolean;
  switchWorkspace: (workspace: WorkspaceRow) => Promise<void>;
}

const WorkspaceSwitchContext =
  createContext<WorkspaceSwitchContextValue | null>(null);

export function WorkspaceSwitchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const [isSwitching, setIsSwitching] = useState(false);
  const inFlightRef = useRef(false);
  const pendingSlugRef = useRef<string | null>(null);

  useEffect(() => {
    const pendingSlug = pendingSlugRef.current;
    if (!pendingSlug || !isSwitching) {
      return;
    }

    if (pathname?.includes(`/w/${pendingSlug}/`)) {
      pendingSlugRef.current = null;
      inFlightRef.current = false;
      setIsSwitching(false);
    }
  }, [isSwitching, pathname]);

  const switchWorkspace = useCallback(
    async (workspace: WorkspaceRow) => {
      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      pendingSlugRef.current = workspace.slug;
      setIsSwitching(true);

      try {
        await performWorkspaceSwitch(
          queryClient,
          { organizationId: workspace.id, slug: workspace.slug },
          (path) => router.push(path),
          () => router.refresh()
        );
      } catch {
        pendingSlugRef.current = null;
        inFlightRef.current = false;
        setIsSwitching(false);
      }
    },
    [queryClient, router]
  );

  const value = useMemo(
    () => ({ isSwitching, switchWorkspace }),
    [isSwitching, switchWorkspace]
  );

  return (
    <WorkspaceSwitchContext.Provider value={value}>
      {children}
    </WorkspaceSwitchContext.Provider>
  );
}

export function useWorkspaceSwitch(): WorkspaceSwitchContextValue {
  const context = useContext(WorkspaceSwitchContext);
  if (!context) {
    throw new Error(
      "useWorkspaceSwitch must be used within WorkspaceSwitchProvider"
    );
  }
  return context;
}
