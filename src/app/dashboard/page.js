import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  // Get authenticated user
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!email) {
    redirect("/sign-in");
  }

  // Check email is verified
  const emailVerified =
    user?.primaryEmailAddress?.verification?.status === "verified";

  if (!emailVerified) {
    redirect("/verify-email");
  }

  // All authenticated users can view the dashboard
  // Stripe subscription check happens on Analyze button click
  return <DashboardClient userEmail={email} />;
}
