import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { getBillingAccess } from '@/lib/billing/access'
import { getPool } from '@/lib/db/pool'
import { getWebsiteForUser } from '@/lib/db/websites'
import { getPlanLimit, requireFeature } from '@/lib/entitlements'

export const runtime = 'nodejs'

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function inferTermType(term: string): 'brand' | 'domain' {
  return !term.includes(' ') && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(term) ? 'domain' : 'brand'
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const body = (await request.json().catch(() => null)) as { siteId?: string; term?: string } | null
  const siteId = body?.siteId?.trim()
  const term = body?.term?.trim()
  if (!siteId || !term) {
    return json({ ok: false, error: 'missing_site_or_term' }, 400)
  }
  if (term.length < 2 || term.length > 120) {
    return json({ ok: false, error: 'invalid_term' }, 400)
  }

  const site = await getWebsiteForUser(siteId, session.user.id)
  if (!site) {
    return json({ ok: false, error: 'site_not_found' }, 404)
  }

  const billing = await getBillingAccess(session.user.id, session.user.email)
  const featureAccess = requireFeature(billing.accountKind, 'reputationPulse')
  if (!featureAccess.ok) {
    return json({ ok: false, error: 'reputation_pulse_locked', message: featureAccess.message }, featureAccess.status)
  }

  const pool = getPool()
  const count = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM social_watch_terms
     WHERE site_id = $1::uuid
       AND is_active = true`,
    [site.id],
  )
  const watchTermLimit = getPlanLimit(billing.accountKind, 'reputationWatchTerms') ?? 0
  if (Number(count.rows[0]?.count ?? 0) >= watchTermLimit) {
    return json({ ok: false, error: 'watch_term_limit_reached' }, 429)
  }

  const result = await pool.query<{
    id: string
    term: string
    term_type: string
    is_active: boolean
    created_at: string
  }>(
    `INSERT INTO social_watch_terms (site_id, user_id, term, term_type)
     SELECT $1::uuid, $2::uuid, $3, $4
     WHERE NOT EXISTS (
       SELECT 1
       FROM social_watch_terms
       WHERE site_id = $1::uuid
         AND lower(term) = lower($3)
     )
     RETURNING id::text, term, term_type, is_active, created_at::text`,
    [site.id, session.user.id, term, inferTermType(term)],
  )

  const row = result.rows[0]
  if (!row) {
    return json({ ok: false, error: 'watch_term_exists' }, 409)
  }

  return json({ ok: true, watchTerm: row })
}
