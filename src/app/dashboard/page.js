import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

const WHOP_CHECKOUT_URL = "https://whop.com/checkout/plan_nQHnE1nsW602p";

async function verifyWhopMembership(email) {
  const apiKey = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;

  if (!apiKey || !productId) {
    console.error("[EdgeCheck] Missing WHOP_API_KEY or WHOP_PRODUCT_ID");
    return false;
  }

  try {
    const url = new URL("https://api.whop.com/api/v2/memberships");
    url.searchParams.set("product_id", productId);
    url.searchParams.set("email", email);
    url.searchParams.set("per", "50");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[EdgeCheck] Whop API error:", res.status);
      return false;
    }

    const data = await res.json();
    const memberships = data.data ?? data;
    const validStatuses = ["active", "trialing", "completed"];

    return (
      Array.isArray(memberships) &&
      memberships.some((m) => validStatuses.includes(m.status))
    );
  } catch (err) {
    console.error("[EdgeCheck] Whop verification error:", err.message);
    return false;
  }
}

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

  // Verify Whop membership on EVERY dashboard load
  const hasActiveMembership = await verifyWhopMembership(email);

  if (!hasActiveMembership) {
    // No active membership — redirect to Whop checkout
    redirect(WHOP_CHECKOUT_URL);
  }

  // User has active membership — render dashboard
  return <DashboardClient />;
}
