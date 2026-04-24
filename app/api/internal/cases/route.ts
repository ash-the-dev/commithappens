import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { requireIntelligenceForUser } from "@/lib/billing/intelligence-guard";
import { getWebsiteForUser } from "@/lib/db/websites";
import {
  addCaseNote,
  assignCase,
  buildCaseDraftFromNotification,
  claimCase,
  clearCaseNextAction,
  createCase,
  createCaseFromNotification,
  pinCaseEvidence,
  setCaseNextAction,
  type CaseStatus,
  unassignCase,
  updateCaseStatus,
} from "@/lib/db/cases";
import { getWebsiteNotifications } from "@/lib/db/notifications";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

type Body =
  | {
      action: "create_from_notification";
      website_id?: string;
      notification_id?: string;
    }
  | {
      action: "create_case";
      website_id?: string;
      title?: string;
      summary?: string | null;
      source_type?: string;
      source_ref?: string;
      severity?: "critical" | "high" | "medium" | "low";
    }
  | {
      action: "update_status";
      website_id?: string;
      case_id?: string;
      status?: CaseStatus;
    }
  | {
      action: "claim_case";
      website_id?: string;
      case_id?: string;
    }
  | {
      action: "assign_case";
      website_id?: string;
      case_id?: string;
      assignee_user_id?: string;
    }
  | {
      action: "unassign_case";
      website_id?: string;
      case_id?: string;
    }
  | {
      action: "set_next_action";
      website_id?: string;
      case_id?: string;
      next_action?: string;
    }
  | {
      action: "clear_next_action";
      website_id?: string;
      case_id?: string;
    }
  | {
      action: "add_note";
      website_id?: string;
      case_id?: string;
      note_text?: string;
    }
  | {
      action: "pin_evidence";
      website_id?: string;
      case_id?: string;
      evidence?: Record<string, unknown>;
    };

function isCaseStatus(value: string): value is CaseStatus {
  return (
    value === "open" ||
    value === "investigating" ||
    value === "monitoring" ||
    value === "resolved" ||
    value === "dismissed"
  );
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

  const entBlock = await requireIntelligenceForUser(userId, session.user.email);
  if (entBlock) return entBlock;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
  if (!websiteId) return json({ ok: false, error: "website_id_required" }, 400);
  const site = await getWebsiteForUser(websiteId, userId);
  if (!site) return json({ ok: false, error: "website_not_found" }, 404);

  try {
    if (body.action === "create_from_notification") {
      const notificationId =
        typeof body.notification_id === "string" ? body.notification_id.trim() : "";
      if (!notificationId) {
        return json({ ok: false, error: "notification_id_required" }, 400);
      }
      const created = await createCaseFromNotification(websiteId, notificationId);
      if (!created) return json({ ok: false, error: "notification_not_found" }, 404);
      return json({ ok: true, case: created }, 200);
    }

    if (body.action === "create_case") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const sourceType = typeof body.source_type === "string" ? body.source_type.trim() : "";
      const sourceRef = typeof body.source_ref === "string" ? body.source_ref.trim() : "";
      if (!title) return json({ ok: false, error: "title_required" }, 400);
      if (!sourceType) return json({ ok: false, error: "source_type_required" }, 400);
      if (!sourceRef) return json({ ok: false, error: "source_ref_required" }, 400);
      const created = await createCase({
        websiteId,
        title,
        summary: body.summary ?? null,
        sourceType,
        sourceRef,
        severity: body.severity ?? "medium",
      });
      return json({ ok: true, case: created }, 201);
    }

    if (body.action === "update_status") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      const status = typeof body.status === "string" ? body.status.trim() : "";
      if (!caseId) return json({ ok: false, error: "case_id_required" }, 400);
      if (!isCaseStatus(status)) return json({ ok: false, error: "invalid_status" }, 400);
      const ok = await updateCaseStatus(websiteId, caseId, status);
      if (!ok) return json({ ok: false, error: "case_not_found" }, 404);
      return json({ ok: true }, 200);
    }

    if (body.action === "claim_case") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      if (!caseId) return json({ ok: false, error: "case_id_required" }, 400);
      const ok = await claimCase(websiteId, caseId, userId);
      if (!ok) return json({ ok: false, error: "case_not_found" }, 404);
      return json({ ok: true }, 200);
    }

    if (body.action === "assign_case") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      const assigneeUserId =
        typeof body.assignee_user_id === "string" ? body.assignee_user_id.trim() : "";
      if (!caseId) return json({ ok: false, error: "case_id_required" }, 400);
      if (!assigneeUserId) return json({ ok: false, error: "assignee_user_id_required" }, 400);
      const ok = await assignCase(websiteId, caseId, assigneeUserId);
      if (!ok) return json({ ok: false, error: "case_not_found" }, 404);
      return json({ ok: true }, 200);
    }

    if (body.action === "unassign_case") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      if (!caseId) return json({ ok: false, error: "case_id_required" }, 400);
      const ok = await unassignCase(websiteId, caseId);
      if (!ok) return json({ ok: false, error: "case_not_found" }, 404);
      return json({ ok: true }, 200);
    }

    if (body.action === "set_next_action") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      const nextAction = typeof body.next_action === "string" ? body.next_action.trim() : "";
      if (!caseId) return json({ ok: false, error: "case_id_required" }, 400);
      if (!nextAction) return json({ ok: false, error: "next_action_required" }, 400);
      const ok = await setCaseNextAction(websiteId, caseId, nextAction);
      if (!ok) return json({ ok: false, error: "case_not_found" }, 404);
      return json({ ok: true }, 200);
    }

    if (body.action === "clear_next_action") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      if (!caseId) return json({ ok: false, error: "case_id_required" }, 400);
      const ok = await clearCaseNextAction(websiteId, caseId);
      if (!ok) return json({ ok: false, error: "case_not_found" }, 404);
      return json({ ok: true }, 200);
    }

    if (body.action === "add_note") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      const noteText = typeof body.note_text === "string" ? body.note_text.trim() : "";
      if (!caseId) return json({ ok: false, error: "case_id_required" }, 400);
      if (!noteText) return json({ ok: false, error: "note_text_required" }, 400);
      const note = await addCaseNote(websiteId, caseId, noteText);
      if (!note) return json({ ok: false, error: "case_not_found" }, 404);
      return json({ ok: true, note }, 201);
    }

    if (body.action === "pin_evidence") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      if (!caseId) return json({ ok: false, error: "case_id_required" }, 400);
      const evidence =
        body.evidence && typeof body.evidence === "object" ? body.evidence : null;
      if (!evidence) return json({ ok: false, error: "evidence_required" }, 400);
      const ok = await pinCaseEvidence(websiteId, caseId, evidence);
      if (!ok) return json({ ok: false, error: "case_not_found" }, 404);
      return json({ ok: true }, 200);
    }

    return json({ ok: false, error: "unsupported_action" }, 400);
  } catch (err) {
    console.error("[cases.route] failed", err);
    return json({ ok: false, error: "case_action_failed" }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

  const url = new URL(request.url);
  const websiteId = url.searchParams.get("website_id")?.trim() ?? "";
  const notificationId = url.searchParams.get("notification_id")?.trim() ?? "";
  if (!websiteId || !notificationId) {
    return json({ ok: false, error: "website_id_and_notification_id_required" }, 400);
  }
  const site = await getWebsiteForUser(websiteId, userId);
  if (!site) return json({ ok: false, error: "website_not_found" }, 404);
  const notifications = await getWebsiteNotifications(websiteId, "all");
  const target = notifications.find((n) => n.id === notificationId);
  if (!target) return json({ ok: false, error: "notification_not_found" }, 404);
  return json({ ok: true, draft: buildCaseDraftFromNotification(target) }, 200);
}

