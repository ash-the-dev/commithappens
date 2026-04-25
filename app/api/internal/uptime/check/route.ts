export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.UPTIME_CRON_SECRET?.trim();
  if (!secret) return false;
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret")?.trim();
  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  return querySecret === secret || headerSecret === secret;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  return json({ ok: true, message: "uptime checker route alive" });
}
