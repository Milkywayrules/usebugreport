import { headers } from "next/headers";
import { authClient } from "./auth-client";

interface OrganizationListClient {
  organization: {
    list: (input?: {
      fetchOptions?: { headers: Headers };
    }) => Promise<{ data: unknown[] | null }>;
  };
}

export async function getServerSession() {
  const requestHeaders = await headers();

  const sessionResult = await authClient.getSession({
    fetchOptions: {
      headers: requestHeaders,
    },
  });

  const organizationsResult = await (
    authClient as unknown as OrganizationListClient
  ).organization.list({
    fetchOptions: {
      headers: requestHeaders,
    },
  });

  return {
    organizations: organizationsResult.data ?? [],
    session: sessionResult.data?.session ?? null,
    user: sessionResult.data?.user ?? null,
  };
}
