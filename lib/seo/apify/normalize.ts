/**
 * Map Apify dataset items into a single internal row shape for reporting and storage.
 */
export type NormalizedCrawlRow = {
  url: string;
  status: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  links: string[];
};

function toNonEmptyString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t ? t : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function toStatus(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number.parseInt(value.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toLinkArray(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
    } else if (item && typeof item === "object" && "href" in item && typeof (item as { href?: unknown }).href === "string") {
      const h = (item as { href: string }).href.trim();
      if (h) out.push(h);
    }
  }
  return out;
}

/**
 * Best-effort normalization from a raw Apify (or similar) item.
 * Rows without a usable url are returned as null and should be dropped or counted as invalid upstream.
 */
export function normalizeApifyDatasetItem(
  item: unknown,
  rowIndex: number,
): { row: NormalizedCrawlRow } | { error: string } {
  if (!item || typeof item !== "object") {
    return { error: `Row ${rowIndex + 1}: not an object` };
  }
  const rec = item as Record<string, unknown>;
  const url = toNonEmptyString(rec.url);
  if (!url) {
    return { error: `Row ${rowIndex + 1}: missing url` };
  }
  return {
    row: {
      url,
      // DB column is `status` (HTTP code). Apify may send status, statusCode, status_code, etc.
      status: firstHttpStatusFromRecord(rec),
      title: toNonEmptyString(rec.title),
      metaDescription: toNonEmptyString(
        (rec as Record<string, unknown>).metaDescription ?? (rec as Record<string, unknown>).meta_description,
      ),
      h1: toNonEmptyString(rec.h1),
      links: toLinkArray(rec.links),
    },
  };
}

function firstHttpStatusFromRecord(rec: Record<string, unknown>): number | null {
  const keys = [
    "status",
    "statusCode",
    "status_code",
    "httpStatus",
    "httpStatusCode",
    "httpstatus",
  ] as const;
  for (const k of keys) {
    if (k in rec) {
      const n = toStatus(rec[k]);
      if (n != null) return n;
    }
  }
  return null;
}

export function normalizeApifyDatasetItems(
  items: unknown[],
  onError: (message: string) => void,
): NormalizedCrawlRow[] {
  const rows: NormalizedCrawlRow[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const result = normalizeApifyDatasetItem(items[i], i);
    if ("error" in result) {
      onError(result.error);
      continue;
    }
    rows.push(result.row);
  }
  return rows;
}
