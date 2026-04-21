import type { Pool, PoolClient } from "pg";
import {
  classifyTrafficChannel,
  fingerprintFields,
} from "@/lib/ingestion/attribution";
import type {
  CustomIngestEvent,
  IngestEvent,
  IngestPayload,
  PageviewIngestEvent,
  WebVitalIngestEvent,
} from "@/lib/ingestion/types";

/** Accepts any RFC-4122-style UUID returned by Postgres `gen_random_uuid()`. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_EVENTS = 100;
const MAX_STRING = 4096;
const MAX_EVENT_NAME = 128;

type ColumnCaps = {
  pageviewsFullUrl: boolean;
  pageviewsLoadTimeMs: boolean;
  pageviewsMetadata: boolean;
  eventsCategory: boolean;
  eventsPath: boolean;
  eventsValue: boolean;
  eventsConversion: boolean;
  webVitalsMetadata: boolean;
  sessionsLastSeenAt: boolean;
  sessionsPageviewCount: boolean;
  sessionsEventCount: boolean;
  sessionsDurationSeconds: boolean;
  sessionsIsBounce: boolean;
  sessionsRiskScore: boolean;
};

let cachedCaps: ColumnCaps | null = null;

async function getColumnCaps(client: PoolClient): Promise<ColumnCaps> {
  if (cachedCaps) return cachedCaps;
  const result = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('sessions', 'pageviews', 'events', 'web_vitals')`,
  );

  const has = (table: string, col: string) =>
    result.rows.some((r) => r.table_name === table && r.column_name === col);

  cachedCaps = {
    pageviewsFullUrl: has("pageviews", "full_url"),
    pageviewsLoadTimeMs: has("pageviews", "load_time_ms"),
    pageviewsMetadata: has("pageviews", "metadata"),
    eventsCategory: has("events", "category"),
    eventsPath: has("events", "path"),
    eventsValue: has("events", "event_value"),
    eventsConversion: has("events", "is_conversion"),
    webVitalsMetadata: has("web_vitals", "metadata"),
    sessionsLastSeenAt: has("sessions", "last_seen_at"),
    sessionsPageviewCount: has("sessions", "pageview_count"),
    sessionsEventCount: has("sessions", "event_count"),
    sessionsDurationSeconds: has("sessions", "duration_seconds"),
    sessionsIsBounce: has("sessions", "is_bounce"),
    sessionsRiskScore: has("sessions", "risk_score"),
  };
  return cachedCaps;
}

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function normalizeDeviceType(value: string | null | undefined): string {
  const v = (value ?? "unknown").toLowerCase();
  if (v === "mobile" || v === "tablet" || v === "desktop" || v === "unknown") {
    return v;
  }
  return "unknown";
}

function parseOccurredAt(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date();
  }
  return d;
}

function validatePayload(raw: unknown):
  | { ok: true; payload: IngestPayload }
  | { ok: false; status: number; error: string } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  const body = raw as Record<string, unknown>;

  const siteKey = typeof body.siteKey === "string" ? body.siteKey.trim() : "";
  const visitorKey =
    typeof body.visitorKey === "string" ? body.visitorKey.trim() : "";
  const sessionKey =
    typeof body.sessionKey === "string" ? body.sessionKey.trim() : "";

  if (!isUuid(siteKey)) {
    return { ok: false, status: 400, error: "invalid_site_key" };
  }
  if (!visitorKey || visitorKey.length > 200) {
    return { ok: false, status: 400, error: "invalid_visitor_key" };
  }
  if (!isUuid(sessionKey)) {
    return { ok: false, status: 400, error: "invalid_session_key" };
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return { ok: false, status: 400, error: "events_required" };
  }
  if (body.events.length > MAX_EVENTS) {
    return { ok: false, status: 400, error: "too_many_events" };
  }

  const events: IngestEvent[] = [];
  for (const item of body.events) {
    if (item === null || typeof item !== "object") {
      return { ok: false, status: 400, error: "invalid_event" };
    }
    const ev = item as Record<string, unknown>;
    const type = ev.type;
    const occurredAt =
      typeof ev.occurredAt === "string" ? ev.occurredAt : "";

    if (type === "pageview") {
      const path = typeof ev.path === "string" ? ev.path : "";
      if (!path || path.length > MAX_STRING) {
        return { ok: false, status: 400, error: "invalid_pageview_path" };
      }
      const pv: PageviewIngestEvent = {
        type: "pageview",
        occurredAt: occurredAt || new Date().toISOString(),
        path,
        query: typeof ev.query === "string" ? ev.query : null,
        title: typeof ev.title === "string" ? ev.title.slice(0, 512) : null,
        referrerUrl:
          typeof ev.referrerUrl === "string" ? ev.referrerUrl : null,
        fullUrl: typeof ev.fullUrl === "string" ? ev.fullUrl : null,
        loadTimeMs:
          typeof ev.loadTimeMs === "number" && Number.isFinite(ev.loadTimeMs)
            ? Math.round(ev.loadTimeMs)
            : null,
        metadata:
          ev.metadata && typeof ev.metadata === "object"
            ? (ev.metadata as Record<string, unknown>)
            : null,
      };
      events.push(pv);
    } else if (type === "custom") {
      const name = typeof ev.name === "string" ? ev.name.trim() : "";
      if (!name || name.length > MAX_EVENT_NAME) {
        return { ok: false, status: 400, error: "invalid_custom_name" };
      }
      const props =
        ev.properties !== undefined && ev.properties !== null
          ? (ev.properties as Record<string, unknown>)
          : {};
      if (typeof props !== "object") {
        return { ok: false, status: 400, error: "invalid_custom_properties" };
      }
      const custom: CustomIngestEvent = {
        type: "custom",
        name,
        category:
          typeof ev.category === "string" ? ev.category.slice(0, 128) : null,
        path: typeof ev.path === "string" ? ev.path.slice(0, MAX_STRING) : null,
        value:
          typeof ev.value === "number" && Number.isFinite(ev.value)
            ? ev.value
            : null,
        isConversion: ev.isConversion === true,
        properties: props,
        occurredAt: occurredAt || new Date().toISOString(),
      };
      events.push(custom);
    } else if (type === "web_vital") {
      const name = typeof ev.name === "string" ? ev.name.trim() : "";
      if (!name || name.length > 32 || !/^[a-zA-Z0-9_]+$/.test(name)) {
        return { ok: false, status: 400, error: "invalid_web_vital_name" };
      }
      const value = typeof ev.value === "number" ? ev.value : Number.NaN;
      if (!Number.isFinite(value)) {
        return { ok: false, status: 400, error: "invalid_web_vital_value" };
      }
      const wv: WebVitalIngestEvent = {
        type: "web_vital",
        name,
        value,
        rating: typeof ev.rating === "string" ? ev.rating.slice(0, 32) : null,
        path: typeof ev.path === "string" ? ev.path.slice(0, MAX_STRING) : null,
        metadata:
          ev.metadata && typeof ev.metadata === "object"
            ? (ev.metadata as Record<string, unknown>)
            : null,
        occurredAt: occurredAt || new Date().toISOString(),
      };
      events.push(wv);
    } else {
      return { ok: false, status: 400, error: "unknown_event_type" };
    }
  }

  const payload: IngestPayload = {
    siteKey,
    visitorKey,
    sessionKey,
    context:
      body.context && typeof body.context === "object"
        ? (body.context as IngestPayload["context"])
        : undefined,
    attribution:
      body.attribution && typeof body.attribution === "object"
        ? (body.attribution as IngestPayload["attribution"])
        : undefined,
    events,
  };

  return { ok: true, payload };
}

async function getOrCreateTrafficSourceId(
  client: PoolClient,
  websiteId: string,
  channel: string,
  referrerHost: string | null,
  fp: ReturnType<typeof fingerprintFields>,
): Promise<string> {
  const select = await client.query<{ id: string }>(
    `SELECT id FROM traffic_sources
     WHERE website_id = $1
       AND channel = $2
       AND coalesce(referrer_host, '') = coalesce($3::text, '')
       AND coalesce(utm_source, '') = coalesce($4::text, '')
       AND coalesce(utm_medium, '') = coalesce($5::text, '')
       AND coalesce(utm_campaign, '') = coalesce($6::text, '')
       AND coalesce(utm_term, '') = coalesce($7::text, '')
       AND coalesce(utm_content, '') = coalesce($8::text, '')
     LIMIT 1`,
    [
      websiteId,
      channel,
      referrerHost,
      fp.utmSource,
      fp.utmMedium,
      fp.utmCampaign,
      fp.utmTerm,
      fp.utmContent,
    ],
  );

  if (select.rows[0]?.id) {
    return select.rows[0].id;
  }

  try {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO traffic_sources (
        website_id, channel, referrer_host, utm_source, utm_medium, utm_campaign, utm_term, utm_content
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [
        websiteId,
        channel,
        referrerHost,
        fp.utmSource,
        fp.utmMedium,
        fp.utmCampaign,
        fp.utmTerm,
        fp.utmContent,
      ],
    );
    return inserted.rows[0].id;
  } catch (err) {
    if (!isPgUniqueViolation(err)) throw err;
    const retry = await client.query<{ id: string }>(
      `SELECT id FROM traffic_sources
       WHERE website_id = $1
         AND channel = $2
         AND coalesce(referrer_host, '') = coalesce($3::text, '')
         AND coalesce(utm_source, '') = coalesce($4::text, '')
         AND coalesce(utm_medium, '') = coalesce($5::text, '')
         AND coalesce(utm_campaign, '') = coalesce($6::text, '')
         AND coalesce(utm_term, '') = coalesce($7::text, '')
         AND coalesce(utm_content, '') = coalesce($8::text, '')
       LIMIT 1`,
      [
        websiteId,
        channel,
        referrerHost,
        fp.utmSource,
        fp.utmMedium,
        fp.utmCampaign,
        fp.utmTerm,
        fp.utmContent,
      ],
    );
    if (!retry.rows[0]?.id) throw err;
    return retry.rows[0].id;
  }
}

function sortEvents(events: IngestEvent[]): IngestEvent[] {
  return [...events].sort(
    (a, b) =>
      parseOccurredAt(a.occurredAt).getTime() -
      parseOccurredAt(b.occurredAt).getTime(),
  );
}

function firstPageview(events: IngestEvent[]): PageviewIngestEvent | null {
  for (const e of events) {
    if (e.type === "pageview") return e;
  }
  return null;
}

/**
 * Persists a validated ingest batch. Caller supplies an active DB pool.
 */
export async function persistIngestBatch(
  pool: Pool,
  payload: IngestPayload,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const sorted = sortEvents(payload.events);
  const firstPv = firstPageview(sorted);
  const pageRef = firstPv?.referrerUrl ?? null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const caps = await getColumnCaps(client);

    const site = await client.query<{
      id: string;
      primary_domain: string;
    }>(
      `SELECT id, primary_domain
       FROM websites
       WHERE tracking_public_key = $1::uuid
         AND is_active = true
         AND deleted_at IS NULL`,
      [payload.siteKey],
    );

    if (!site.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, error: "unknown_site" };
    }

    const websiteId = site.rows[0].id;
    const primaryDomain = site.rows[0].primary_domain;

    const userAgent =
      typeof payload.context?.userAgent === "string"
        ? payload.context.userAgent.slice(0, 2000)
        : null;
    const deviceType = normalizeDeviceType(payload.context?.deviceType);

    let sessionId: string | null = null;
    let sessionReady = false;
    let attempts = 0;

    while (!sessionReady && attempts < 5) {
      attempts += 1;
      const sessionLock = await client.query<{ id: string }>(
        `SELECT id
         FROM sessions
         WHERE website_id = $1 AND session_key = $2
         FOR UPDATE`,
        [websiteId, payload.sessionKey],
      );

      if (sessionLock.rows[0]) {
        sessionId = sessionLock.rows[0].id;
        await client.query(
          `UPDATE sessions
           SET last_activity_at = now(),
               user_agent = COALESCE($2, user_agent)
           WHERE id = $1`,
          [sessionId, userAgent],
        );
        sessionReady = true;
        break;
      }

      try {
        const { channel, referrerHost } = classifyTrafficChannel(
          primaryDomain,
          payload.attribution,
          pageRef,
        );
        const fp = fingerprintFields(payload.attribution);
        const trafficSourceId = await getOrCreateTrafficSourceId(
          client,
          websiteId,
          channel,
          referrerHost,
          fp,
        );

        const referrerUrl =
          typeof payload.attribution?.referrerUrl === "string"
            ? payload.attribution.referrerUrl.slice(0, MAX_STRING)
            : null;

        const entryPath = firstPv?.path ?? null;
        const entryQuery =
          firstPv && typeof firstPv.query === "string" ? firstPv.query : null;

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO sessions (
            website_id, traffic_source_id, visitor_key, session_key,
            entry_path, entry_query, referrer_url, user_agent, device_type
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id`,
          [
            websiteId,
            trafficSourceId,
            payload.visitorKey,
            payload.sessionKey,
            entryPath,
            entryQuery,
            referrerUrl,
            userAgent,
            deviceType,
          ],
        );
        sessionId = inserted.rows[0].id;
        sessionReady = true;
      } catch (err) {
        if (isPgUniqueViolation(err)) {
          continue;
        }
        throw err;
      }
    }

    if (!sessionReady || !sessionId) {
      await client.query("ROLLBACK");
      return { ok: false, status: 409, error: "session_race" };
    }

    for (const ev of sorted) {
      const at = parseOccurredAt(ev.occurredAt);

      if (ev.type === "pageview") {
        const columns = [
          "website_id",
          "session_id",
          "occurred_at",
          "path",
          "query_string",
          "title",
          "referrer_url",
        ];
        const values: unknown[] = [
          websiteId,
          sessionId,
          at.toISOString(),
          ev.path.slice(0, MAX_STRING),
          ev.query != null ? String(ev.query).slice(0, MAX_STRING) : null,
          ev.title != null ? String(ev.title).slice(0, 512) : null,
          ev.referrerUrl != null
            ? String(ev.referrerUrl).slice(0, MAX_STRING)
            : null,
        ];
        if (caps.pageviewsFullUrl) {
          columns.push("full_url");
          values.push(
            ev.fullUrl != null ? String(ev.fullUrl).slice(0, MAX_STRING) : null,
          );
        }
        if (caps.pageviewsLoadTimeMs) {
          columns.push("load_time_ms");
          values.push(ev.loadTimeMs ?? null);
        }
        if (caps.pageviewsMetadata) {
          columns.push("metadata");
          values.push(JSON.stringify(ev.metadata ?? {}));
        }

        const placeholders = values.map((_, i) => {
          const col = columns[i];
          if (col === "occurred_at") return `$${i + 1}::timestamptz`;
          if (col === "metadata") return `$${i + 1}::jsonb`;
          return `$${i + 1}`;
        });

        await client.query(
          `INSERT INTO pageviews (${columns.join(", ")})
           VALUES (${placeholders.join(", ")})`,
          values,
        );
      } else if (ev.type === "custom") {
        const columns = ["website_id", "session_id", "name", "properties", "occurred_at"];
        const values: unknown[] = [
          websiteId,
          sessionId,
          ev.name,
          JSON.stringify(ev.properties ?? {}),
          at.toISOString(),
        ];
        if (caps.eventsCategory) {
          columns.splice(3, 0, "category");
          values.splice(3, 0, ev.category ?? null);
        }
        if (caps.eventsPath) {
          const idx = columns.indexOf("properties");
          columns.splice(idx, 0, "path");
          values.splice(idx, 0, ev.path ?? firstPv?.path ?? null);
        }
        if (caps.eventsValue) {
          const idx = columns.indexOf("properties");
          columns.splice(idx, 0, "event_value");
          values.splice(idx, 0, ev.value ?? null);
        }
        if (caps.eventsConversion) {
          const idx = columns.indexOf("properties");
          columns.splice(idx, 0, "is_conversion");
          values.splice(idx, 0, ev.isConversion === true);
        }

        const placeholders = values.map((_, i) => {
          const col = columns[i];
          if (col === "properties") return `$${i + 1}::jsonb`;
          if (col === "occurred_at") return `$${i + 1}::timestamptz`;
          return `$${i + 1}`;
        });

        await client.query(
          `INSERT INTO events (${columns.join(", ")})
           VALUES (${placeholders.join(", ")})`,
          values,
        );
      } else if (ev.type === "web_vital") {
        const columns = [
          "website_id",
          "session_id",
          "metric_name",
          "value",
          "rating",
          "path",
          "occurred_at",
        ];
        const values: unknown[] = [
          websiteId,
          sessionId,
          ev.name,
          ev.value,
          ev.rating,
          ev.path ?? firstPv?.path ?? null,
          at.toISOString(),
        ];
        if (caps.webVitalsMetadata) {
          columns.splice(columns.length - 1, 0, "metadata");
          values.splice(values.length - 1, 0, JSON.stringify(ev.metadata ?? {}));
        }

        const placeholders = values.map((_, i) => {
          const col = columns[i];
          if (col === "metadata") return `$${i + 1}::jsonb`;
          if (col === "occurred_at") return `$${i + 1}::timestamptz`;
          return `$${i + 1}`;
        });
        await client.query(
          `INSERT INTO web_vitals (${columns.join(", ")})
           VALUES (${placeholders.join(", ")})`,
          values,
        );
      }
    }

    const setClauses = ["last_activity_at = now()"];
    if (caps.sessionsLastSeenAt) {
      setClauses.push("last_seen_at = now()");
    }
    if (caps.sessionsPageviewCount) {
      setClauses.push(
        "pageview_count = (SELECT count(*) FROM pageviews p WHERE p.session_id = $1)",
      );
    }
    if (caps.sessionsEventCount) {
      setClauses.push(
        "event_count = (SELECT count(*) FROM events e WHERE e.session_id = $1)",
      );
    }
    if (caps.sessionsDurationSeconds) {
      setClauses.push(
        "duration_seconds = GREATEST(EXTRACT(EPOCH FROM (now() - started_at))::integer, 0)",
      );
    }
    if (caps.sessionsIsBounce) {
      setClauses.push(
        `is_bounce = (
          (SELECT count(*) FROM pageviews p WHERE p.session_id = $1) <= 1
          AND (SELECT count(*) FROM events e WHERE e.session_id = $1) = 0
          AND GREATEST(EXTRACT(EPOCH FROM (now() - started_at))::integer, 0) <= 15
        )`,
      );
    }
    if (caps.sessionsRiskScore) {
      setClauses.push(
        `risk_score = CASE
          WHEN (
            (SELECT count(*) FROM events e WHERE e.session_id = $1) >= 30
            AND GREATEST(EXTRACT(EPOCH FROM (now() - started_at))::integer, 0) <= 120
          )
          THEN 0.8
          ELSE 0.0
        END`,
      );
    }

    await client.query(
      `UPDATE sessions SET ${setClauses.join(", ")} WHERE id = $1`,
      [sessionId],
    );

    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[ingest] transaction failed", err);
    return { ok: false, status: 500, error: "ingest_failed" };
  } finally {
    client.release();
  }
}

export function parseIngestBody(raw: unknown) {
  return validatePayload(raw);
}
