import type Stripe from "stripe";
import { getPool } from "@/lib/db/pool";
import { BILLING_PLANS, type PlanKey } from "@/lib/billing/plans";

export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export type UserSubscription = {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  planKey: PlanKey | null;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  maxSites: number;
  seoEnabled: boolean;
  updatedAt: string;
};

const ENABLED_STATUSES = new Set<SubscriptionStatus>(["trialing", "active", "past_due"]);

let ensuredTable = false;

async function ensureSubscriptionsTable() {
  if (ensuredTable) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
      stripe_customer_id text UNIQUE,
      stripe_subscription_id text UNIQUE,
      stripe_price_id text,
      plan_key text,
      status text,
      trial_ends_at timestamptz,
      current_period_end timestamptz,
      cancel_at_period_end boolean NOT NULL DEFAULT false,
      max_sites integer NOT NULL DEFAULT 0,
      seo_enabled boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_subscriptions_plan_status_idx
    ON user_subscriptions (plan_key, status)
  `);
  ensuredTable = true;
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  await ensureSubscriptionsTable();
  const pool = getPool();
  const result = await pool.query<{
    user_id: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    plan_key: PlanKey | null;
    status: SubscriptionStatus | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    max_sites: number;
    seo_enabled: boolean;
    updated_at: string;
  }>(
    `SELECT
       user_id,
       stripe_customer_id,
       stripe_subscription_id,
       stripe_price_id,
       plan_key,
       status,
       trial_ends_at::text,
       current_period_end::text,
       cancel_at_period_end,
       max_sites,
       seo_enabled,
       updated_at::text
     FROM user_subscriptions
     WHERE user_id = $1::uuid
     LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    planKey: row.plan_key,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    maxSites: row.max_sites,
    seoEnabled: row.seo_enabled,
    updatedAt: row.updated_at,
  };
}

export async function hasPaidAccess(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  return Boolean(sub?.status && ENABLED_STATUSES.has(sub.status));
}

export async function upsertSubscriptionFromStripe(params: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  status: SubscriptionStatus | null;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  planKey: PlanKey | null;
}) {
  await ensureSubscriptionsTable();
  const plan = params.planKey ? BILLING_PLANS[params.planKey] : null;
  const pool = getPool();
  await pool.query(
    `INSERT INTO user_subscriptions (
       user_id,
       stripe_customer_id,
       stripe_subscription_id,
       stripe_price_id,
       plan_key,
       status,
       trial_ends_at,
       current_period_end,
       cancel_at_period_end,
       max_sites,
       seo_enabled,
       updated_at
     ) VALUES (
       $1::uuid,
       $2,
       $3,
       $4,
       $5,
       $6,
       CASE WHEN $7::bigint IS NULL THEN NULL ELSE to_timestamp($7::bigint) END,
       CASE WHEN $8::bigint IS NULL THEN NULL ELSE to_timestamp($8::bigint) END,
       $9,
       $10,
       $11,
       now()
     )
     ON CONFLICT (user_id)
     DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       plan_key = EXCLUDED.plan_key,
       status = EXCLUDED.status,
       trial_ends_at = EXCLUDED.trial_ends_at,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       max_sites = EXCLUDED.max_sites,
       seo_enabled = EXCLUDED.seo_enabled,
       updated_at = now()`,
    [
      params.userId,
      params.stripeCustomerId,
      params.stripeSubscriptionId,
      params.stripePriceId,
      params.planKey,
      params.status,
      params.trialEndsAt,
      params.currentPeriodEnd,
      params.cancelAtPeriodEnd,
      plan?.maxSites ?? 0,
      plan?.seoEnabled ?? false,
    ],
  );
}

export async function upsertCustomerMapping(userId: string, stripeCustomerId: string) {
  await ensureSubscriptionsTable();
  const pool = getPool();
  await pool.query(
    `INSERT INTO user_subscriptions (
       user_id,
       stripe_customer_id,
       max_sites,
       seo_enabled,
       updated_at
     ) VALUES ($1::uuid, $2, 0, false, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = now()`,
    [userId, stripeCustomerId],
  );
}

export async function findUserIdByStripeCustomerId(customerId: string): Promise<string | null> {
  await ensureSubscriptionsTable();
  const pool = getPool();
  const mapped = await pool.query<{ user_id: string }>(
    `SELECT user_id
     FROM user_subscriptions
     WHERE stripe_customer_id = $1
     LIMIT 1`,
    [customerId],
  );
  if (mapped.rows[0]?.user_id) return mapped.rows[0].user_id;
  return null;
}

export function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}
