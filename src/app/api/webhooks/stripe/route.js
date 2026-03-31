import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // For development without webhook secret
      event = JSON.parse(body);
      console.warn("[EdgeCheck] Stripe webhook secret not configured - skipping signature verification");
    }
  } catch (err) {
    console.error("[EdgeCheck] Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      console.log("[EdgeCheck] Checkout completed:", {
        customer: session.customer,
        email: session.customer_details?.email,
        subscription: session.subscription,
      });
      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object;
      console.log("[EdgeCheck] Subscription created:", {
        id: subscription.id,
        customer: subscription.customer,
        status: subscription.status,
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      console.log("[EdgeCheck] Subscription updated:", {
        id: subscription.id,
        customer: subscription.customer,
        status: subscription.status,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      console.log("[EdgeCheck] Subscription canceled:", {
        id: subscription.id,
        customer: subscription.customer,
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      console.log("[EdgeCheck] Invoice paid:", {
        id: invoice.id,
        customer: invoice.customer,
        amount: invoice.amount_paid,
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      console.log("[EdgeCheck] Payment failed:", {
        id: invoice.id,
        customer: invoice.customer,
      });
      break;
    }

    default:
      console.log("[EdgeCheck] Unhandled webhook event:", event.type);
  }

  return NextResponse.json({ received: true });
}
