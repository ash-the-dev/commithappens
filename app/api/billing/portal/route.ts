import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getStripe } from "@/lib/billing/stripe";
import { getUserSubscription } from "@/lib/db/subscriptions";

export const runtime = "nodejs";

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
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const sub = await getUserSubscription(session.user.id);
  if (!sub?.stripeCustomerId) {
    return json({ ok: false, error: "no_billing_customer" }, 400);
  }

  const stripe = getStripe();
  const origin = appOrigin(request);
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/dashboard`,
  });
  return json({ ok: true, url: portal.url });
}
