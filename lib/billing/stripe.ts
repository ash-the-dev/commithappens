import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (cachedStripe) return cachedStripe;
  const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
  }
  cachedStripe = new Stripe(apiKey);
  return cachedStripe;
}
