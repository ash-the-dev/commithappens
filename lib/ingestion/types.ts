export type IngestAttribution = {
  referrerUrl?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
};

export type IngestContext = {
  userAgent?: string | null;
  deviceType?: string | null;
};

export type PageviewIngestEvent = {
  type: "pageview";
  occurredAt: string;
  path: string;
  query?: string | null;
  title?: string | null;
  referrerUrl?: string | null;
  fullUrl?: string | null;
  loadTimeMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type CustomIngestEvent = {
  type: "custom";
  name: string;
  category?: string | null;
  path?: string | null;
  value?: number | null;
  isConversion?: boolean;
  properties?: Record<string, unknown> | null;
  occurredAt: string;
};

export type WebVitalIngestEvent = {
  type: "web_vital";
  name: string;
  value: number;
  rating?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: string;
};

export type IngestEvent = PageviewIngestEvent | CustomIngestEvent | WebVitalIngestEvent;

export type IngestPayload = {
  siteKey: string;
  visitorKey: string;
  sessionKey: string;
  context?: IngestContext;
  attribution?: IngestAttribution;
  events: IngestEvent[];
};
