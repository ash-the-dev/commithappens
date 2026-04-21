import { createHash } from "node:crypto";
import { getPool } from "@/lib/db/pool";
import type { WebsiteAlert, WebsiteAlertCenterData } from "@/lib/db/alerts";
import { getWebsiteAlertCenterData } from "@/lib/db/alerts";
import type { WebsiteRecommendationsResult } from "@/lib/ai/types";
import { generateWebsiteRecommendations } from "@/lib/ai/generate-website-recommendations";

export type NotificationStatus = "unread" | "read" | "acknowledged";
export type NotificationSeverity = "critical" | "high" | "medium" | "low";
export type NotificationCategory =
  | "uptime"
  | "performance"
  | "threat"
  | "traffic_anomaly"
  | "conversion"
  | "change_impact"
  | "monitoring_gap"
  | "recommendation";

export type DashboardNotification = {
  id: string;
  website_id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  summary: string | null;
  evidence_points: string[];
  recommended_actions: string[];
  source_type: "alert" | "recommendation";
  source_ref: string;
  detected_at: string;
  status: NotificationStatus;
  priority_score: number;
};

export type NotificationCandidate = Omit<
  DashboardNotification,
  "id" | "website_id" | "status"
>;

type PreloadedSignals = {
  alertCenter?: WebsiteAlertCenterData;
  recommendations?: WebsiteRecommendationsResult;
};

const NOTIFICATION_RULES = {
  recommendationPriorityCritical: 95,
  recommendationPriorityHigh: 80,
  recommendationPriorityMedium: 60,
  recommendationPriorityLow: 35,
} as const;

function isUndefinedTableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

function severityRank(severity: NotificationSeverity): number {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function priorityFromSeverity(severity: NotificationSeverity): number {
  if (severity === "critical") return 100;
  if (severity === "high") return 80;
  if (severity === "medium") return 60;
  return 40;
}

function fingerprint(candidate: NotificationCandidate): string {
  return createHash("sha1")
    .update(
      JSON.stringify({
        category: candidate.category,
        severity: candidate.severity,
        title: candidate.title,
        summary: candidate.summary,
        evidence_points: candidate.evidence_points,
        recommended_actions: candidate.recommended_actions,
        priority_score: candidate.priority_score,
      }),
    )
    .digest("hex");
}

function candidateFromAlert(alert: WebsiteAlert): NotificationCandidate {
  return {
    category: alert.category,
    severity: alert.severity,
    title: alert.title,
    summary: alert.summary,
    evidence_points: alert.evidence_points.slice(0, 4),
    recommended_actions: alert.recommended_actions.slice(0, 4),
    source_type: "alert",
    source_ref: alert.id,
    detected_at: alert.detected_at,
    priority_score: priorityFromSeverity(alert.severity),
  };
}

function candidateFromRecommendations(
  recommendations: WebsiteRecommendationsResult,
): NotificationCandidate | null {
  const d = recommendations.data;
  if (d.urgent_actions.length === 0 && d.priority_label === "low") return null;
  const score =
    d.priority_label === "critical"
      ? NOTIFICATION_RULES.recommendationPriorityCritical
      : d.priority_label === "high"
        ? NOTIFICATION_RULES.recommendationPriorityHigh
        : d.priority_label === "medium"
          ? NOTIFICATION_RULES.recommendationPriorityMedium
          : NOTIFICATION_RULES.recommendationPriorityLow;
  return {
    category: "recommendation",
    severity: d.priority_label,
    title: "Prioritized next actions available",
    summary: d.summary,
    evidence_points: d.urgent_actions.slice(0, 2),
    recommended_actions: [...d.urgent_actions, ...d.next_actions].slice(0, 4),
    source_type: "recommendation",
    source_ref: `recommendations:${d.priority_label}`,
    detected_at: recommendations.generated_at,
    priority_score: score,
  };
}

export async function buildWebsiteNotificationCandidates(
  websiteId: string,
  preloaded?: PreloadedSignals,
): Promise<NotificationCandidate[]> {
  const [alertCenter, recommendations] = await Promise.all([
    preloaded?.alertCenter ?? getWebsiteAlertCenterData(websiteId),
    preloaded?.recommendations ?? generateWebsiteRecommendations(websiteId),
  ]);

  const candidates = alertCenter.alerts.map(candidateFromAlert);
  const recommendationCandidate = candidateFromRecommendations(recommendations);
  if (recommendationCandidate) candidates.push(recommendationCandidate);

  candidates.sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity);
    if (sev !== 0) return sev;
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });
  return candidates;
}

export async function syncWebsiteNotifications(
  websiteId: string,
  preloaded?: PreloadedSignals,
): Promise<void> {
  const pool = getPool();
  const candidates = await buildWebsiteNotificationCandidates(websiteId, preloaded);
  try {
    if (candidates.length === 0) {
      await pool.query(`DELETE FROM dashboard_notifications WHERE website_id = $1::uuid`, [
        websiteId,
      ]);
      return;
    }

    const refs = candidates.map((c) => `${c.source_type}:${c.source_ref}`);
    await pool.query(
      `DELETE FROM dashboard_notifications
       WHERE website_id = $1::uuid
         AND (source_type || ':' || source_ref) <> ALL($2::text[])`,
      [websiteId, refs],
    );

    for (const c of candidates) {
      const fp = fingerprint(c);
      await pool.query(
        `INSERT INTO dashboard_notifications (
          website_id,
          category,
          severity,
          title,
          summary,
          evidence_points,
          recommended_actions,
          source_type,
          source_ref,
          detected_at,
          status,
          priority_score,
          fingerprint
        )
       VALUES (
          $1::uuid, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10::timestamptz, 'unread', $11, $12
       )
       ON CONFLICT (website_id, source_type, source_ref)
       DO UPDATE SET
         category = EXCLUDED.category,
         severity = EXCLUDED.severity,
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         evidence_points = EXCLUDED.evidence_points,
         recommended_actions = EXCLUDED.recommended_actions,
         detected_at = EXCLUDED.detected_at,
         priority_score = EXCLUDED.priority_score,
         status = CASE
           WHEN dashboard_notifications.fingerprint <> EXCLUDED.fingerprint
             AND dashboard_notifications.status <> 'acknowledged'
           THEN 'unread'
           ELSE dashboard_notifications.status
         END,
         fingerprint = EXCLUDED.fingerprint,
         updated_at = now()`,
        [
          websiteId,
          c.category,
          c.severity,
          c.title,
          c.summary,
          JSON.stringify(c.evidence_points),
          JSON.stringify(c.recommended_actions),
          c.source_type,
          c.source_ref,
          c.detected_at,
          c.priority_score,
          fp,
        ],
      );
    }
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return;
    }
    throw err;
  }
}

export async function getWebsiteNotifications(
  websiteId: string,
  status?: NotificationStatus | "all",
): Promise<DashboardNotification[]> {
  const pool = getPool();
  const whereStatus =
    status && status !== "all" ? `AND status = $2` : "";
  const params = status && status !== "all" ? [websiteId, status] : [websiteId];
  try {
    const result = await pool.query<{
    id: string;
    website_id: string;
    category: NotificationCategory;
    severity: NotificationSeverity;
    title: string;
    summary: string | null;
    evidence_points: unknown;
    recommended_actions: unknown;
    source_type: "alert" | "recommendation";
    source_ref: string;
    detected_at: Date;
    status: NotificationStatus;
    priority_score: number;
    }>(
      `SELECT
       id, website_id, category, severity, title, summary, evidence_points, recommended_actions,
       source_type, source_ref, detected_at, status, priority_score
     FROM dashboard_notifications
     WHERE website_id = $1::uuid
     ${whereStatus}
     ORDER BY
       CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
       CASE status WHEN 'unread' THEN 2 WHEN 'read' THEN 1 ELSE 0 END DESC,
       priority_score DESC,
       detected_at DESC`,
      params,
    );

    return result.rows.map((row) => ({
      ...row,
      detected_at: row.detected_at.toISOString(),
      evidence_points: Array.isArray(row.evidence_points)
        ? (row.evidence_points as string[])
        : [],
      recommended_actions: Array.isArray(row.recommended_actions)
        ? (row.recommended_actions as string[])
        : [],
    }));
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return [];
    }
    throw err;
  }
}

async function updateStatus(
  websiteId: string,
  notificationId: string,
  status: NotificationStatus,
): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE dashboard_notifications
       SET status = $3, updated_at = now()
       WHERE id = $1::uuid AND website_id = $2::uuid`,
      [notificationId, websiteId, status],
    );
    return result.rowCount === 1;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return false;
    }
    throw err;
  }
}

export async function markNotificationRead(
  websiteId: string,
  notificationId: string,
): Promise<boolean> {
  return updateStatus(websiteId, notificationId, "read");
}

export async function markNotificationUnread(
  websiteId: string,
  notificationId: string,
): Promise<boolean> {
  return updateStatus(websiteId, notificationId, "unread");
}

export async function acknowledgeNotification(
  websiteId: string,
  notificationId: string,
): Promise<boolean> {
  return updateStatus(websiteId, notificationId, "acknowledged");
}

export async function markAllNotificationsRead(websiteId: string): Promise<number> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE dashboard_notifications
       SET status = 'read', updated_at = now()
       WHERE website_id = $1::uuid AND status = 'unread'`,
      [websiteId],
    );
    return result.rowCount ?? 0;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return 0;
    }
    throw err;
  }
}

