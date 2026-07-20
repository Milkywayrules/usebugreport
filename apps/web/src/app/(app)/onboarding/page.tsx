import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import {
  createWorkspaceAction,
  fetchFirstReportIdAction,
} from "./actions";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { session, user } = await getServerSession();

  if (!(session && user)) {
    redirect("/login");
  }

  const captureApiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  return (
    <OnboardingForm
      captureApiBaseUrl={captureApiBaseUrl}
      createWorkspaceAction={createWorkspaceAction}
      fetchFirstReportIdAction={fetchFirstReportIdAction}
    />
  );
}
