import type { QueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type OrganizationAuthClient = typeof authClient & {
  organization: {
    setActive: (input: { organizationId: string }) => Promise<unknown>;
  };
};

const authWithOrganization = authClient as OrganizationAuthClient;

export function isWorkspaceScopedQuery(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === "workspace";
}

export async function switchWorkspace(
  queryClient: QueryClient,
  input: { organizationId: string; slug: string },
  navigate: (path: string) => void,
  refresh: () => void
): Promise<void> {
  await authWithOrganization.organization.setActive({
    organizationId: input.organizationId,
  });
  queryClient.removeQueries({
    predicate: (query) => isWorkspaceScopedQuery(query.queryKey),
  });
  navigate(`/w/${input.slug}/reports`);
  refresh();
}
