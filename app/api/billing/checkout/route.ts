import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getStripe } from "@/lib/billing/stripe";
import { resolvePriceIdFromPlanKey, type PlanKey } from "@/lib/billing/plans";
import { getUserSubscription, upsertCustomerMapping } from "@/lib/db/subscriptions";

export const runtime = "nodejs";

type CheckoutBody = {
  planKey?: string;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function appOrigin(request: Request): string {
  const configured = process.env.NEXTAUTH_URL?.trim() || process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: CheckoutBody = {};
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    body = {};
  }
  const planKey = (body.planKey ?? "").trim().toLowerCase() as PlanKey;
  const priceId = resolvePriceIdFromPlanKey(planKey);
  if (!priceId) {
    return json({ ok: false, error: "invalid_plan" }, 400);
  }

  const stripe = getStripe();
  const existing = await getUserSubscription(session.user.id);
  const customerId = existing?.stripeCustomerId
    ? existing.stripeCustomerId
    : (
        await stripe.customers.create({
          email: session.user.email,
          metadata: { user_id: session.user.id },
        })
      ).id;
  if (!existing?.stripeCustomerId) {
    await upsertCustomerMapping(session.user.id, customerId);
  }

  const origin = appOrigin(request);
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing/cancel`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        user_id: session.user.id,
        plan_key: planKey,
      },
    },
    metadata: {
      user_id: session.user.id,
      plan_key: planKey,
    },
  });

  return json({ ok: true, url: checkout.url });
}
