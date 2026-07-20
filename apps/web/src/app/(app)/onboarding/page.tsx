import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { createWorkspaceAction } from "./actions";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { session, user } = await getServerSession();

  if (!(session && user)) {
    redirect("/login");
  }

  return <OnboardingForm createWorkspaceAction={createWorkspaceAction} />;
}
