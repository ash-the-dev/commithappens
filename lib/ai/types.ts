export type AiSummarySeverity = "low" | "medium" | "high";

export type WebsiteAiSummaryOutput = {
  headline: string;
  summary: string;
  bullets: string[];
  recommended_actions: string[];
  severity: AiSummarySeverity;
  confidence_note: string;
};

export type WebsiteAiSummaryResult = {
  source: "ai" | "fallback";
  model: string | null;
  data: WebsiteAiSummaryOutput;
  generated_at: string;
  error?: string;
};

export type SpikeExplanationOutput = {
  headline: string;
  summary: string;
  likely_factors: string[];
  supporting_evidence: string[];
  recommended_checks: string[];
  confidence_note: string;
  impact_label: "spike" | "drop";
  severity: "low" | "medium" | "high";
};

export type SpikeExplanationResult = {
  source: "ai" | "fallback";
  model: string | null;
  data: SpikeExplanationOutput;
  generated_at: string;
  error?: string;
};

export type SpikeExplanationInput = {
  website_name: string;
  target_date: string;
  anomaly_type: "spike" | "drop";
  metric_focus: "sessions" | "pageviews" | "events";
  current_metrics: {
    sessions: number;
    pageviews: number;
    events: number;
    conversions: number | null;
  };
  baseline_metrics: {
    sessions: number;
    pageviews: number;
    events: number;
    conversions: number | null;
  };
  metric_deltas: {
    sessions_pct: number;
    pageviews_pct: number;
    events_pct: number;
    conversions_pct: number | null;
  };
  top_page_deltas: Array<{
    path: string;
    current: number;
    baseline: number;
    percent_change: number;
  }>;
  top_event_deltas: Array<{
    event_name: string;
    current: number;
    baseline: number;
    percent_change: number;
  }>;
  uptime_signals: string[];
  threat_signals: string[];
  change_signals: string[];
  source_signals: string[];
  strongest_factors: string[];
};

export type ChangeImpactNarrativeOutput = {
  headline: string;
  summary: string;
  notable_changes: string[];
  supporting_evidence: string[];
  recommended_checks: string[];
  severity: "low" | "medium" | "high";
  confidence_note: string;
  direction_label: "positive" | "negative" | "mixed" | "neutral";
};

export type ChangeImpactNarrativeResult = {
  source: "ai" | "fallback";
  model: string | null;
  data: ChangeImpactNarrativeOutput;
  generated_at: string;
  error?: string;
  change_log_id: string;
};

export type ChangeImpactNarrativeInput = {
  website_name: string;
  change_log: {
    id: string;
    title: string;
    description: string | null;
    change_type: string | null;
    created_at: string;
    source: string | null;
    metadata: Record<string, unknown>;
  };
  impact_window: {
    baseline_start: string;
    baseline_end: string;
    post_start: string;
    post_end: string;
    window_hours: number;
  };
  metric_deltas: {
    sessions_before: number;
    sessions_after: number;
    sessions_percent_change: number;
    pageviews_before: number;
    pageviews_after: number;
    pageviews_percent_change: number;
    events_before: number;
    events_after: number;
    events_percent_change: number;
    conversions_before: number | null;
    conversions_after: number | null;
    conversions_percent_change: number | null;
  };
  top_page_deltas: string[];
  top_event_deltas: string[];
  uptime_signals: string[];
  threat_signals: string[];
  anomaly_signals: string[];
  strongest_factors: string[];
  impact_flags: string[];
};

export type RecommendationPriority = "critical" | "high" | "medium" | "low";
export type RecommendationCategory =
  | "performance"
  | "uptime"
  | "threat"
  | "conversion"
  | "change_review"
  | "traffic";

export type RecommendationCandidate = {
  kind: "issue" | "opportunity";
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  rationale: string;
  suggested_action: string;
};

export type WebsiteRecommendationsInput = {
  website_name: string;
  summary_signals: {
    sessions_24h: number;
    pageviews_24h: number;
    events_24h: number;
    unique_visitors_24h: number;
    anomalies_count: number;
  };
  performance_signals: {
    lcp_avg: number | null;
    cls_avg: number | null;
    inp_avg: number | null;
    problematic_metrics: string[];
    top_affected_pages: string[];
  };
  uptime_signals: {
    has_checks: boolean;
    uptime_pct_24h: number;
    failed_checks_24h: number;
  };
  threat_signals: {
    flagged_sessions: number;
    high_risk_sessions: number;
    top_reasons: string[];
    risky_paths: string[];
  };
  change_signals: {
    latest_change_title: string | null;
    latest_change_flags: string[];
    latest_change_summary: string | null;
  };
  conversion_signals: {
    has_conversion_data: boolean;
    conversion_change_pct: number | null;
  };
  strongest_issues: string[];
  strongest_opportunities: string[];
  recommended_priority_context: {
    highest_priority: RecommendationPriority;
    candidates: RecommendationCandidate[];
  };
};

export type WebsiteRecommendationsOutput = {
  headline: string;
  summary: string;
  urgent_actions: string[];
  next_actions: string[];
  opportunities: string[];
  priority_label: RecommendationPriority;
  confidence_note: string;
};

export type WebsiteRecommendationsResult = {
  source: "ai" | "fallback";
  model: string | null;
  generated_at: string;
  data: WebsiteRecommendationsOutput;
  error?: string;
};

export type DashboardQuestionIntent =
  | "summary"
  | "spike_explanation"
  | "threat_analysis"
  | "change_impact"
  | "recommendations"
  | "performance_analysis"
  | "uptime_analysis"
  | "insufficient_scope";

export type DashboardQuestionEvidence = {
  website_name: string;
  website_domain?: string;
  question: string;
  normalized_question: string;
  intent: DashboardQuestionIntent;
  time_scope: "today" | "yesterday" | "recent" | "latest" | "unknown";
  current_tab?: string | null;
  scans?: {
    seo_status: "ready" | "missing" | "running" | "failed";
    seo_error: string | null;
    uptime_status: "ready" | "missing" | "running" | "failed";
    analytics_status: "ready" | "missing" | "running" | "failed";
    reputation_status: "ready" | "missing" | "running" | "failed";
  };
  seo?: {
    top_issues: Array<{
      issue_type: string;
      issue_severity: string;
      url: string;
      status: number | null;
      title: string | null;
    }>;
  };
  summary: WebsiteAiSummaryInput;
  anomalies: Array<{
    date: string;
    metric_type: "sessions" | "pageviews" | "events";
    anomaly_type: "spike" | "drop";
    percent_change: number;
  }>;
  latest_spike: SpikeExplanationInput | null;
  latest_change: ChangeImpactNarrativeInput | null;
  threat: {
    total_flagged_sessions: number;
    high_risk_sessions: number;
    top_risk_reasons: string[];
    risky_paths: string[];
    risky_events: string[];
  };
  recommendations: WebsiteRecommendationsInput;
  uptime: {
    has_checks: boolean;
    checks_24h: number;
    checks_up_24h: number;
    uptime_pct_24h: number;
    failures_24h: number;
  };
  performance: {
    vitals: Array<{ metric: string; average: number; samples: number }>;
    problematic_metrics: string[];
    top_pages: Array<{ path: string; views: number }>;
  };
};

export type DashboardAnswerOutput = {
  answer: string;
  evidence_points: string[];
  recommended_followups: string[];
  confidence_note: string;
  intent: DashboardQuestionIntent;
  source_label: "ai" | "fallback";
  limitation_note?: string;
  time_scope?: string;
  sections?: Array<{
    title: string;
    body: string;
  }>;
  checklist?: string[];
  suggestedWording?: {
    title?: string;
    metaDescription?: string;
    h1?: string;
  };
  priority?: "critical" | "high" | "medium" | "low" | "none";
  confidence?: "stored data" | "early signal" | "needs more data";
  basedOn?: string[];
};

export type DashboardAnswerResult = {
  source: "ai" | "fallback";
  model: string | null;
  generated_at: string;
  data: DashboardAnswerOutput;
  error?: string;
};

export type WebsiteAiSummaryInput = {
  website_name: string;
  summary_24h: {
    sessions: number;
    pageviews: number;
    events: number;
    unique_visitors: number;
    uptime_pct: number;
    uptime_checks: number;
  };
  anomalies: Array<{
    date: string;
    metric: "sessions" | "pageviews" | "events";
    type: "spike" | "drop";
    percent_change: number;
  }>;
  vitals: Array<{
    metric: string;
    average: number;
    samples: number;
  }>;
  threats: {
    total_flagged_sessions: number;
    high_risk_sessions: number;
    medium_risk_sessions: number;
    top_risk_reasons: string[];
  };
  uptime: {
    has_checks: boolean;
    checks_24h: number;
    checks_up_24h: number;
    uptime_pct_24h: number;
  };
  top_pages: Array<{
    path: string;
    views: number;
  }>;
  recent_changes: Array<{
    title: string;
    created_at: string;
    summary: string;
    flags: string[];
  }>;
  deterministic_signals: {
    insight_summary: string;
    key_points: string[];
    detected_flags: string[];
  };
};
