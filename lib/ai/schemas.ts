import type {
  ChangeImpactNarrativeOutput,
  DashboardAnswerOutput,
  WebsiteRecommendationsOutput,
  SpikeExplanationOutput,
  WebsiteAiSummaryOutput,
} from "@/lib/ai/types";

export const WEBSITE_AI_SUMMARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", minLength: 5, maxLength: 120 },
    summary: { type: "string", minLength: 15, maxLength: 500 },
    bullets: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 2,
      maxItems: 5,
    },
    recommended_actions: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 1,
      maxItems: 4,
    },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    confidence_note: { type: "string", minLength: 5, maxLength: 180 },
  },
  required: [
    "headline",
    "summary",
    "bullets",
    "recommended_actions",
    "severity",
    "confidence_note",
  ],
} as const;

function isStringArray(value: unknown, min: number, max: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= min &&
    value.length <= max &&
    value.every(
      (v) => typeof v === "string" && v.trim().length >= 5 && v.trim().length <= 180,
    )
  );
}

export function validateWebsiteAiSummaryOutput(
  value: unknown,
): { ok: true; data: WebsiteAiSummaryOutput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "output_not_object" };
  }
  const v = value as Record<string, unknown>;
  const headline = typeof v.headline === "string" ? v.headline.trim() : "";
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  const confidence = typeof v.confidence_note === "string" ? v.confidence_note.trim() : "";
  const severity = v.severity;

  if (headline.length < 5 || headline.length > 120) {
    return { ok: false, error: "invalid_headline" };
  }
  if (summary.length < 15 || summary.length > 500) {
    return { ok: false, error: "invalid_summary" };
  }
  if (!isStringArray(v.bullets, 2, 5)) {
    return { ok: false, error: "invalid_bullets" };
  }
  if (!isStringArray(v.recommended_actions, 1, 4)) {
    return { ok: false, error: "invalid_recommended_actions" };
  }
  if (severity !== "low" && severity !== "medium" && severity !== "high") {
    return { ok: false, error: "invalid_severity" };
  }
  if (confidence.length < 5 || confidence.length > 180) {
    return { ok: false, error: "invalid_confidence_note" };
  }

  return {
    ok: true,
    data: {
      headline,
      summary,
      bullets: v.bullets as string[],
      recommended_actions: v.recommended_actions as string[],
      severity,
      confidence_note: confidence,
    },
  };
}

export const SPIKE_EXPLANATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", minLength: 5, maxLength: 140 },
    summary: { type: "string", minLength: 20, maxLength: 600 },
    likely_factors: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 1,
      maxItems: 5,
    },
    supporting_evidence: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 1,
      maxItems: 6,
    },
    recommended_checks: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 1,
      maxItems: 4,
    },
    confidence_note: { type: "string", minLength: 5, maxLength: 180 },
    impact_label: { type: "string", enum: ["spike", "drop"] },
    severity: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: [
    "headline",
    "summary",
    "likely_factors",
    "supporting_evidence",
    "recommended_checks",
    "confidence_note",
    "impact_label",
    "severity",
  ],
} as const;

export function validateSpikeExplanationOutput(
  value: unknown,
): { ok: true; data: SpikeExplanationOutput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "output_not_object" };
  }
  const v = value as Record<string, unknown>;
  const headline = typeof v.headline === "string" ? v.headline.trim() : "";
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  const confidence = typeof v.confidence_note === "string" ? v.confidence_note.trim() : "";
  if (headline.length < 5 || headline.length > 140) return { ok: false, error: "invalid_headline" };
  if (summary.length < 20 || summary.length > 600) return { ok: false, error: "invalid_summary" };
  if (!isStringArray(v.likely_factors, 1, 5)) return { ok: false, error: "invalid_likely_factors" };
  if (!isStringArray(v.supporting_evidence, 1, 6)) return { ok: false, error: "invalid_supporting_evidence" };
  if (!isStringArray(v.recommended_checks, 1, 4)) return { ok: false, error: "invalid_recommended_checks" };
  if (confidence.length < 5 || confidence.length > 180) return { ok: false, error: "invalid_confidence_note" };
  if (v.impact_label !== "spike" && v.impact_label !== "drop") return { ok: false, error: "invalid_impact_label" };
  if (v.severity !== "low" && v.severity !== "medium" && v.severity !== "high") return { ok: false, error: "invalid_severity" };
  return {
    ok: true,
    data: {
      headline,
      summary,
      likely_factors: v.likely_factors as string[],
      supporting_evidence: v.supporting_evidence as string[],
      recommended_checks: v.recommended_checks as string[],
      confidence_note: confidence,
      impact_label: v.impact_label,
      severity: v.severity,
    },
  };
}

export const CHANGE_IMPACT_NARRATIVE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", minLength: 5, maxLength: 140 },
    summary: { type: "string", minLength: 20, maxLength: 600 },
    notable_changes: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 1,
      maxItems: 6,
    },
    supporting_evidence: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 1,
      maxItems: 6,
    },
    recommended_checks: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 1,
      maxItems: 4,
    },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    confidence_note: { type: "string", minLength: 5, maxLength: 180 },
    direction_label: {
      type: "string",
      enum: ["positive", "negative", "mixed", "neutral"],
    },
  },
  required: [
    "headline",
    "summary",
    "notable_changes",
    "supporting_evidence",
    "recommended_checks",
    "severity",
    "confidence_note",
    "direction_label",
  ],
} as const;

export function validateChangeImpactNarrativeOutput(
  value: unknown,
): { ok: true; data: ChangeImpactNarrativeOutput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "output_not_object" };
  }
  const v = value as Record<string, unknown>;
  const headline = typeof v.headline === "string" ? v.headline.trim() : "";
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  const confidence = typeof v.confidence_note === "string" ? v.confidence_note.trim() : "";
  if (headline.length < 5 || headline.length > 140) return { ok: false, error: "invalid_headline" };
  if (summary.length < 20 || summary.length > 600) return { ok: false, error: "invalid_summary" };
  if (!isStringArray(v.notable_changes, 1, 6)) return { ok: false, error: "invalid_notable_changes" };
  if (!isStringArray(v.supporting_evidence, 1, 6)) return { ok: false, error: "invalid_supporting_evidence" };
  if (!isStringArray(v.recommended_checks, 1, 4)) return { ok: false, error: "invalid_recommended_checks" };
  if (v.severity !== "low" && v.severity !== "medium" && v.severity !== "high") return { ok: false, error: "invalid_severity" };
  if (
    v.direction_label !== "positive" &&
    v.direction_label !== "negative" &&
    v.direction_label !== "mixed" &&
    v.direction_label !== "neutral"
  ) {
    return { ok: false, error: "invalid_direction_label" };
  }
  if (confidence.length < 5 || confidence.length > 180) return { ok: false, error: "invalid_confidence_note" };

  return {
    ok: true,
    data: {
      headline,
      summary,
      notable_changes: v.notable_changes as string[],
      supporting_evidence: v.supporting_evidence as string[],
      recommended_checks: v.recommended_checks as string[],
      severity: v.severity,
      confidence_note: confidence,
      direction_label: v.direction_label,
    },
  };
}

export const WEBSITE_RECOMMENDATIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", minLength: 5, maxLength: 140 },
    summary: { type: "string", minLength: 20, maxLength: 600 },
    urgent_actions: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 0,
      maxItems: 5,
    },
    next_actions: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 1,
      maxItems: 6,
    },
    opportunities: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 180 },
      minItems: 0,
      maxItems: 5,
    },
    priority_label: { type: "string", enum: ["critical", "high", "medium", "low"] },
    confidence_note: { type: "string", minLength: 5, maxLength: 180 },
  },
  required: [
    "headline",
    "summary",
    "urgent_actions",
    "next_actions",
    "opportunities",
    "priority_label",
    "confidence_note",
  ],
} as const;

export function validateWebsiteRecommendationsOutput(
  value: unknown,
): { ok: true; data: WebsiteRecommendationsOutput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "output_not_object" };
  }
  const v = value as Record<string, unknown>;
  const headline = typeof v.headline === "string" ? v.headline.trim() : "";
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  const confidence = typeof v.confidence_note === "string" ? v.confidence_note.trim() : "";
  if (headline.length < 5 || headline.length > 140) return { ok: false, error: "invalid_headline" };
  if (summary.length < 20 || summary.length > 600) return { ok: false, error: "invalid_summary" };
  if (!Array.isArray(v.urgent_actions) || !isStringArray(v.urgent_actions, 0, 5)) return { ok: false, error: "invalid_urgent_actions" };
  if (!isStringArray(v.next_actions, 1, 6)) return { ok: false, error: "invalid_next_actions" };
  if (!Array.isArray(v.opportunities) || !isStringArray(v.opportunities, 0, 5)) return { ok: false, error: "invalid_opportunities" };
  if (
    v.priority_label !== "critical" &&
    v.priority_label !== "high" &&
    v.priority_label !== "medium" &&
    v.priority_label !== "low"
  ) {
    return { ok: false, error: "invalid_priority_label" };
  }
  if (confidence.length < 5 || confidence.length > 180) return { ok: false, error: "invalid_confidence_note" };
  return {
    ok: true,
    data: {
      headline,
      summary,
      urgent_actions: v.urgent_actions as string[],
      next_actions: v.next_actions as string[],
      opportunities: v.opportunities as string[],
      priority_label: v.priority_label,
      confidence_note: confidence,
    },
  };
}

export const DASHBOARD_ANSWER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string", minLength: 20, maxLength: 800 },
    evidence_points: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 220 },
      minItems: 1,
      maxItems: 6,
    },
    recommended_followups: {
      type: "array",
      items: { type: "string", minLength: 5, maxLength: 220 },
      minItems: 1,
      maxItems: 5,
    },
    confidence_note: { type: "string", minLength: 5, maxLength: 180 },
    intent: {
      type: "string",
      enum: [
        "summary",
        "spike_explanation",
        "threat_analysis",
        "change_impact",
        "recommendations",
        "performance_analysis",
        "uptime_analysis",
        "insufficient_scope",
      ],
    },
    source_label: { type: "string", enum: ["ai", "fallback"] },
    limitation_note: { type: "string", minLength: 0, maxLength: 180 },
    time_scope: { type: "string", minLength: 0, maxLength: 80 },
  },
  required: [
    "answer",
    "evidence_points",
    "recommended_followups",
    "confidence_note",
    "intent",
    "source_label",
  ],
} as const;

export function validateDashboardAnswerOutput(
  value: unknown,
): { ok: true; data: DashboardAnswerOutput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "output_not_object" };
  const v = value as Record<string, unknown>;
  const answer = typeof v.answer === "string" ? v.answer.trim() : "";
  const confidence = typeof v.confidence_note === "string" ? v.confidence_note.trim() : "";
  const limitation = typeof v.limitation_note === "string" ? v.limitation_note.trim() : undefined;
  const timeScope = typeof v.time_scope === "string" ? v.time_scope.trim() : undefined;
  if (answer.length < 20 || answer.length > 800) return { ok: false, error: "invalid_answer" };
  if (!isStringArray(v.evidence_points, 1, 6)) return { ok: false, error: "invalid_evidence_points" };
  if (!isStringArray(v.recommended_followups, 1, 5)) {
    return { ok: false, error: "invalid_recommended_followups" };
  }
  if (confidence.length < 5 || confidence.length > 180) {
    return { ok: false, error: "invalid_confidence_note" };
  }
  const isValidIntent =
    v.intent === "summary" ||
    v.intent === "spike_explanation" ||
    v.intent === "threat_analysis" ||
    v.intent === "change_impact" ||
    v.intent === "recommendations" ||
    v.intent === "performance_analysis" ||
    v.intent === "uptime_analysis" ||
    v.intent === "insufficient_scope";
  if (!isValidIntent) return { ok: false, error: "invalid_intent" };
  if (v.source_label !== "ai" && v.source_label !== "fallback") {
    return { ok: false, error: "invalid_source_label" };
  }
  const intent = v.intent as DashboardAnswerOutput["intent"];
  const sourceLabel = v.source_label as DashboardAnswerOutput["source_label"];
  return {
    ok: true,
    data: {
      answer,
      evidence_points: v.evidence_points as string[],
      recommended_followups: v.recommended_followups as string[],
      confidence_note: confidence,
      intent,
      source_label: sourceLabel,
      limitation_note: limitation && limitation.length > 0 ? limitation : undefined,
      time_scope: timeScope && timeScope.length > 0 ? timeScope : undefined,
    },
  };
}
