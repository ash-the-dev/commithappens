import { getPool } from "@/lib/db/pool";
import type {
  DashboardNotification,
  NotificationSeverity,
} from "@/lib/db/notifications";
import { getWebsiteNotifications } from "@/lib/db/notifications";

export type CaseStatus =
  | "open"
  | "investigating"
  | "monitoring"
  | "resolved"
  | "dismissed";

export type DashboardCase = {
  id: string;
  website_id: string;
  title: string;
  summary: string | null;
  source_type: string;
  source_ref: string;
  severity: NotificationSeverity;
  status: CaseStatus;
  assigned_to_user_id: string | null;
  assigned_to_label: string | null;
  next_action: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  note_count: number;
};

export type DashboardCaseNote = {
  id: string;
  case_id: string;
  note_text: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DashboardCaseWorkbenchData = {
  cases: DashboardCase[];
  notes_by_case_id: Record<string, DashboardCaseNote[]>;
};

type CreateCaseInput = {
  websiteId: string;
  title: string;
  summary?: string | null;
  sourceType: string;
  sourceRef: string;
  severity?: NotificationSeverity;
  assignedToUserId?: string | null;
  nextAction?: string | null;
  metadata?: Record<string, unknown>;
};

function isUndefinedTableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mapCaseRow(row: {
  id: string;
  website_id: string;
  title: string;
  summary: string | null;
  source_type: string;
  source_ref: string;
  severity: NotificationSeverity;
  status: CaseStatus;
  assigned_to_user_id?: string | null;
  assigned_to_label?: string | null;
  next_action?: string | null;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
  note_count?: string;
}): DashboardCase {
  return {
    id: row.id,
    website_id: row.website_id,
    title: row.title,
    summary: row.summary,
    source_type: row.source_type,
    source_ref: row.source_ref,
    severity: row.severity,
    status: row.status,
    assigned_to_user_id: row.assigned_to_user_id ?? null,
    assigned_to_label: row.assigned_to_label ?? null,
    next_action: row.next_action ?? null,
    metadata: parseJsonObject(row.metadata),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    closed_at: row.closed_at ? row.closed_at.toISOString() : null,
    note_count: Number(row.note_count ?? 0),
  };
}

export async function createCase(input: CreateCaseInput): Promise<DashboardCase> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    website_id: string;
    title: string;
    summary: string | null;
    source_type: string;
    source_ref: string;
    severity: NotificationSeverity;
    status: CaseStatus;
    assigned_to_user_id: string | null;
    assigned_to_label: string | null;
    next_action: string | null;
    metadata: unknown;
    created_at: Date;
    updated_at: Date;
    closed_at: Date | null;
  }>(
    `INSERT INTO dashboard_cases (
       website_id, title, summary, source_type, source_ref, severity, assigned_to_user_id, next_action, metadata
     )
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8, $9::jsonb)
     RETURNING
       id, website_id, title, summary, source_type, source_ref, severity, status, assigned_to_user_id, null::text as assigned_to_label, next_action, metadata,
       created_at, updated_at, closed_at`,
    [
      input.websiteId,
      input.title.trim(),
      input.summary ?? null,
      input.sourceType.trim(),
      input.sourceRef.trim(),
      input.severity ?? "medium",
      input.assignedToUserId ?? null,
      input.nextAction ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return mapCaseRow(result.rows[0]);
}

export async function createCaseFromNotification(
  websiteId: string,
  notificationId: string,
): Promise<DashboardCase | null> {
  try {
    const notifications = await getWebsiteNotifications(websiteId, "all");
    const n = notifications.find((item) => item.id === notificationId);
    if (!n) return null;

    const existing = await findOpenCaseBySource(websiteId, n.source_type, n.source_ref);
    if (existing) return existing;

    return createCase({
      websiteId,
      title: n.title,
      summary: n.summary,
      sourceType: n.source_type,
      sourceRef: n.source_ref,
      severity: n.severity,
      nextAction: n.recommended_actions[0] ?? null,
      metadata: {
        notification_id: n.id,
        category: n.category,
        evidence_points: n.evidence_points,
        recommended_actions: n.recommended_actions,
      },
    });
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return null;
    }
    throw err;
  }
}

export async function findOpenCaseBySource(
  websiteId: string,
  sourceType: string,
  sourceRef: string,
): Promise<DashboardCase | null> {
  const pool = getPool();
  try {
    const result = await pool.query<{
    id: string;
    website_id: string;
    title: string;
    summary: string | null;
    source_type: string;
    source_ref: string;
    severity: NotificationSeverity;
    status: CaseStatus;
    assigned_to_user_id: string | null;
    assigned_to_label: string | null;
    next_action: string | null;
    metadata: unknown;
    created_at: Date;
    updated_at: Date;
    closed_at: Date | null;
    note_count: string;
    }>(
      `SELECT
       c.id, c.website_id, c.title, c.summary, c.source_type, c.source_ref,
       c.severity, c.status, c.assigned_to_user_id,
       coalesce(u.display_name, u.email) AS assigned_to_label,
       c.next_action,
       c.metadata, c.created_at, c.updated_at, c.closed_at,
       (SELECT count(*)::text FROM dashboard_case_notes n WHERE n.case_id = c.id) AS note_count
     FROM dashboard_cases c
     LEFT JOIN users u ON u.id = c.assigned_to_user_id
     WHERE c.website_id = $1::uuid
       AND c.source_type = $2
       AND c.source_ref = $3
       AND c.status IN ('open', 'investigating', 'monitoring')
     ORDER BY c.updated_at DESC
     LIMIT 1`,
      [websiteId, sourceType, sourceRef],
    );
    return result.rows[0] ? mapCaseRow(result.rows[0]) : null;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return null;
    }
    throw err;
  }
}

export async function updateCaseStatus(
  websiteId: string,
  caseId: string,
  status: CaseStatus,
): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE dashboard_cases
       SET
         status = $3,
         updated_at = now(),
         closed_at = CASE
           WHEN $3 IN ('resolved', 'dismissed') THEN now()
           ELSE NULL
         END
       WHERE id = $1::uuid
         AND website_id = $2::uuid`,
      [caseId, websiteId, status],
    );
    return result.rowCount === 1;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return false;
    }
    throw err;
  }
}

export async function assignCase(
  websiteId: string,
  caseId: string,
  assigneeUserId: string,
): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE dashboard_cases
       SET assigned_to_user_id = $3::uuid, updated_at = now()
       WHERE id = $1::uuid AND website_id = $2::uuid`,
      [caseId, websiteId, assigneeUserId],
    );
    return result.rowCount === 1;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return false;
    }
    throw err;
  }
}

export async function claimCase(
  websiteId: string,
  caseId: string,
  userId: string,
): Promise<boolean> {
  return assignCase(websiteId, caseId, userId);
}

export async function unassignCase(
  websiteId: string,
  caseId: string,
): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE dashboard_cases
       SET assigned_to_user_id = NULL, updated_at = now()
       WHERE id = $1::uuid AND website_id = $2::uuid`,
      [caseId, websiteId],
    );
    return result.rowCount === 1;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return false;
    }
    throw err;
  }
}

export async function setCaseNextAction(
  websiteId: string,
  caseId: string,
  actionText: string,
): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE dashboard_cases
       SET next_action = $3, updated_at = now()
       WHERE id = $1::uuid AND website_id = $2::uuid`,
      [caseId, websiteId, actionText.trim()],
    );
    return result.rowCount === 1;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return false;
    }
    throw err;
  }
}

export async function clearCaseNextAction(
  websiteId: string,
  caseId: string,
): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE dashboard_cases
       SET next_action = NULL, updated_at = now()
       WHERE id = $1::uuid AND website_id = $2::uuid`,
      [caseId, websiteId],
    );
    return result.rowCount === 1;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return false;
    }
    throw err;
  }
}

export async function addCaseNote(
  websiteId: string,
  caseId: string,
  noteText: string,
): Promise<DashboardCaseNote | null> {
  const pool = getPool();
  try {
    const caseExists = await pool.query<{ id: string }>(
      `SELECT id
       FROM dashboard_cases
       WHERE id = $1::uuid
         AND website_id = $2::uuid
       LIMIT 1`,
      [caseId, websiteId],
    );
    if (!caseExists.rows[0]) return null;

    const result = await pool.query<{
      id: string;
      case_id: string;
      note_text: string;
      metadata: unknown;
      created_at: Date;
    }>(
      `INSERT INTO dashboard_case_notes (case_id, note_text, metadata)
       VALUES ($1::uuid, $2, '{}'::jsonb)
       RETURNING id, case_id, note_text, metadata, created_at`,
      [caseId, noteText.trim()],
    );
    const row = result.rows[0];
    return {
      id: row.id,
      case_id: row.case_id,
      note_text: row.note_text,
      metadata: parseJsonObject(row.metadata),
      created_at: row.created_at.toISOString(),
    };
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return null;
    }
    throw err;
  }
}

export async function pinCaseEvidence(
  websiteId: string,
  caseId: string,
  evidenceRef: Record<string, unknown>,
): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE dashboard_cases
       SET metadata = jsonb_set(
         metadata,
         '{pinned_evidence}',
         coalesce(metadata->'pinned_evidence', '[]'::jsonb) || $3::jsonb
       ),
       updated_at = now()
       WHERE id = $1::uuid
         AND website_id = $2::uuid`,
      [caseId, websiteId, JSON.stringify([evidenceRef])],
    );
    return result.rowCount === 1;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return false;
    }
    throw err;
  }
}

export async function listWebsiteCases(
  websiteId: string,
  status: CaseStatus | "all" = "all",
): Promise<DashboardCase[]> {
  const pool = getPool();
  const where = status === "all" ? "" : "AND c.status = $2";
  const params = status === "all" ? [websiteId] : [websiteId, status];
  try {
    const result = await pool.query<{
    id: string;
    website_id: string;
    title: string;
    summary: string | null;
    source_type: string;
    source_ref: string;
    severity: NotificationSeverity;
    status: CaseStatus;
    assigned_to_user_id: string | null;
    assigned_to_label: string | null;
    next_action: string | null;
    metadata: unknown;
    created_at: Date;
    updated_at: Date;
    closed_at: Date | null;
    note_count: string;
    }>(
      `SELECT
       c.id, c.website_id, c.title, c.summary, c.source_type, c.source_ref,
       c.severity, c.status, c.assigned_to_user_id,
       coalesce(u.display_name, u.email) AS assigned_to_label,
       c.next_action,
       c.metadata, c.created_at, c.updated_at, c.closed_at,
       (SELECT count(*)::text FROM dashboard_case_notes n WHERE n.case_id = c.id) AS note_count
     FROM dashboard_cases c
     LEFT JOIN users u ON u.id = c.assigned_to_user_id
     WHERE c.website_id = $1::uuid
     ${where}
     ORDER BY
       CASE c.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
       CASE c.status
         WHEN 'open' THEN 5
         WHEN 'investigating' THEN 4
         WHEN 'monitoring' THEN 3
         WHEN 'resolved' THEN 2
         ELSE 1
       END DESC,
       c.updated_at DESC`,
      params,
    );
    return result.rows.map(mapCaseRow);
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return [];
    }
    throw err;
  }
}

export async function listCaseNotesByCaseIds(
  websiteId: string,
  caseIds: string[],
): Promise<Record<string, DashboardCaseNote[]>> {
  if (caseIds.length === 0) return {};
  const pool = getPool();
  try {
    const result = await pool.query<{
    id: string;
    case_id: string;
    note_text: string;
    metadata: unknown;
    created_at: Date;
    }>(
      `SELECT n.id, n.case_id, n.note_text, n.metadata, n.created_at
     FROM dashboard_case_notes n
     JOIN dashboard_cases c ON c.id = n.case_id
     WHERE c.website_id = $1::uuid
       AND n.case_id = ANY($2::uuid[])
     ORDER BY n.created_at DESC`,
      [websiteId, caseIds],
    );
    const out: Record<string, DashboardCaseNote[]> = {};
    for (const row of result.rows) {
      const mapped: DashboardCaseNote = {
        id: row.id,
        case_id: row.case_id,
        note_text: row.note_text,
        metadata: parseJsonObject(row.metadata),
        created_at: row.created_at.toISOString(),
      };
      if (!out[row.case_id]) out[row.case_id] = [];
      out[row.case_id].push(mapped);
    }
    return out;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return {};
    }
    throw err;
  }
}

export async function getCaseWorkbenchData(
  websiteId: string,
  status: CaseStatus | "all" = "all",
): Promise<DashboardCaseWorkbenchData> {
  const cases = await listWebsiteCases(websiteId, status);
  const notesByCaseId = await listCaseNotesByCaseIds(
    websiteId,
    cases.map((c) => c.id),
  );
  return { cases, notes_by_case_id: notesByCaseId };
}

export function buildCaseDraftFromNotification(
  notification: DashboardNotification,
): { title: string; summary: string; sourceType: string; sourceRef: string } {
  return {
    title: notification.title,
    summary: notification.summary ?? "Case created from dashboard notification.",
    sourceType: notification.source_type,
    sourceRef: notification.source_ref,
  };
}

