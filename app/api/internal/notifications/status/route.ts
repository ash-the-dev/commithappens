import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getWebsiteForUser } from "@/lib/db/websites";
import {
  acknowledgeNotification,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "@/lib/db/notifications";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

type Body = {
  website_id?: string;
  notification_id?: string;
  action?: "read" | "unread" | "acknowledge" | "read_all";
};

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
  const notificationId =
    typeof body.notification_id === "string" ? body.notification_id.trim() : "";
  const action = body.action;
  if (!websiteId) return json({ ok: false, error: "website_id_required" }, 400);
  if (!action) return json({ ok: false, error: "action_required" }, 400);
  if (action !== "read_all" && !notificationId) {
    return json({ ok: false, error: "notification_id_required" }, 400);
  }

  const site = await getWebsiteForUser(websiteId, userId);
  if (!site) return json({ ok: false, error: "website_not_found" }, 404);

  try {
    if (action === "read_all") {
      const count = await markAllNotificationsRead(websiteId);
      return json({ ok: true, updated: count }, 200);
    }
    const ok =
      action === "read"
        ? await markNotificationRead(websiteId, notificationId)
        : action === "unread"
          ? await markNotificationUnread(websiteId, notificationId)
          : await acknowledgeNotification(websiteId, notificationId);
    if (!ok) return json({ ok: false, error: "notification_not_found" }, 404);
    return json({ ok: true }, 200);
  } catch (err) {
    console.error("[notifications.status] failed", err);
    return json({ ok: false, error: "update_failed" }, 500);
  }
}

