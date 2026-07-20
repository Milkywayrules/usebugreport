import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient(
  {
    baseURL,
    fetchOptions: {
      credentials: "include",
    },
    plugins: [organizationClient()],
  }
);

export const { signIn, signOut, useSession } = authClient;
