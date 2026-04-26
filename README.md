This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Ingest CORS allowlist

The tracker ingest endpoint (`/api/v1/ingest`) only accepts cross-origin requests from allowed site origins.

Set this environment variable in each deployment:

```bash
INGEST_ALLOWED_ORIGINS=https://www.ashthedev.com,https://www.example.com,https://example.org
```

Notes:

- Use a comma-separated list of full origins (`scheme + host`, optional port).
- Match each live site origin exactly (`https://site.com` and `https://www.site.com` are different).
- `INGEST_ALLOWED_ORIGINS` is optional overrides/extra allowlist entries.
- The ingest route also auto-allows origins derived from active, non-deleted `websites.primary_domain` records (including both apex and `www` forms), so newly added customer sites work without manual CORS edits.

## SEO response-code pipeline (Apify -> Supabase)

The SEO pipeline is now Apify-centered:

1. The dashboard posts to `/api/seo/run`.
2. The app creates a pending `seo_crawl_runs` row and starts the configured Apify actor.
3. Apify calls `/api/seo/webhook` when the run finishes.
4. The webhook imports, normalizes, and enriches dataset rows into `seo_crawl_pages`, `seo_page_reports`, `seo_issues`, `seo_site_summaries`, and `response_code_reports`.
5. The dashboard refreshes stored reports from Supabase.

Manual fallback:

- `npm run seo:import-apify` imports from an existing dataset (`APIFY_DATASET_ID`) or run (`APIFY_ACTOR_RUN_ID`).

### Required environment variables

```bash
APIFY_API_TOKEN=...
APIFY_ACTOR_ID=...
APIFY_WEBHOOK_SECRET=...
SEO_CRAWL_WEBHOOK_URL=https://commithappens.com/api/seo/webhook
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SEO_SITE_ID=...
```

Optional:

```bash
APIFY_ACTOR_INPUT_JSON={"startUrls":[{"url":"https://example.com"}]}
APIFY_POLL_INTERVAL_MS=5000
APIFY_DATASET_ID=...      # manual import mode
APIFY_ACTOR_RUN_ID=...    # manual import mode
```

## Billing (Stripe subscriptions)

The app supports beta paid plans:

- `situationship` -> 1 monitored site, monthly crawl, AI recommendations, analytics
- `committed` -> SEO + monitoring + analysis, up to 3 sites
- `unlimited` -> up to 25 sites with weekly crawls per site

Required env vars:

```bash
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_SITUATIONSHIP_MONTHLY=price_...
STRIPE_PRICE_ID_COMMITTED_MONTHLY=price_...
```

Routes:

- `POST /api/billing/checkout` -> create Stripe Checkout session (`subscription`)
- `POST /api/billing/portal` -> Stripe Customer Portal session
- `POST /api/billing/webhook` -> Stripe event handler for subscription state sync

Webhook events handled:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
