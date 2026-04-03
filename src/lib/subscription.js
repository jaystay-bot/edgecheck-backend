import Stripe from "stripe";

let stripeInstance = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

export async function hasActiveSubscription(email) {
  const stripe = getStripe();
  if (!stripe) return false;

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) return false;

    const customerId = customers.data[0].id;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) return true;

    const trialingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 1,
    });

    return trialingSubs.data.length > 0;
  } catch (err) {
    console.error("[Subscription] Stripe error:", err.message);
    return false;
  }
}
