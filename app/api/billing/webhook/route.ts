import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { BILLING_PLANS, resolvePlanKeyFromPriceId } from "@/lib/billing/plans";
import {
  findUserIdByStripeCustomerId,
  subscriptionPriceId,
  upsertCustomerMapping,
  upsertSubscriptionFromStripe,
} from "@/lib/db/subscriptions";

export const runtime = "nodejs";

function toSubStatus(status: Stripe.Subscription.Status) {
  return status;
}

function resolveUserIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const metaUser = subscription.metadata?.user_id?.trim();
  if (metaUser) return metaUser;
  return null;
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const priceId = subscriptionPriceId(subscription);
  const planKey =
    resolvePlanKeyFromPriceId(priceId ?? "") ??
    ((subscription.metadata?.plan_key?.trim() as keyof typeof BILLING_PLANS) || null);

  const currentPeriodEnd =
    subscription.items.data
      .map((item) => item.current_period_end)
      .sort((a, b) => b - a)[0] ?? null;

  const fromMeta = resolveUserIdFromSubscription(subscription);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  let userId = fromMeta;
  if (!userId && customerId) {
    userId = await findUserIdByStripeCustomerId(customerId);
  }
  if (!userId) return;
  if (customerId) {
    await upsertCustomerMapping(userId, customerId);
  }
  await upsertSubscriptionFromStripe({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    status: toSubStatus(subscription.status),
    trialEndsAt: subscription.trial_end ?? null,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    planKey: planKey && planKey in BILLING_PLANS ? planKey : null,
  });
}

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !webhookSecret) {
    return Response.json({ ok: false, error: "missing_webhook_config" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return Response.json(
      { ok: false, error: "invalid_signature", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id?.trim();
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        if (userId && customerId) {
          await upsertCustomerMapping(userId, customerId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionEvent(sub);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription ?? null;
        if (subRef) {
          const subId = typeof subRef === "string" ? subRef : subRef.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscriptionEvent(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[billing][webhook] processing failure", err);
    return Response.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
