import { runSocialMentionCheck } from '@/lib/social/socialMentionService'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.UPTIME_CRON_SECRET?.trim()
  if (!secret) return false
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get('secret')?.trim()
  const headerSecret = request.headers.get('x-cron-secret')?.trim()
  return querySecret === secret || headerSecret === secret
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  try {
    const stats = await runSocialMentionCheck()
    return json(stats)
  } catch (error) {
    console.error('[social-check] batch failed', error)
    return json({ ok: false, error: 'social_check_failed' }, 500)
  }
}
