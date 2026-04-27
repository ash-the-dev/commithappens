import type { DashboardAnswerOutput, DashboardQuestionEvidence } from "@/lib/ai/types";
import type { SeoRecommendationPageInput } from "@/lib/seo/aiRecommendations";
import type { SeoKeywordContext } from "@/lib/seo/keyword-context";

export type AiResponsePatternKey =
  | "issue_detected"
  | "multiple_issues"
  | "critical_issue"
  | "improvement_opportunity"
  | "positive_trend"
  | "negative_trend"
  | "no_data"
  | "crawl_missing"
  | "crawl_failed"
  | "all_clear";

export type AiResponseSection = {
  title: "What I’m seeing" | "Why it matters" | "What to do next" | "Suggested wording";
  body: string;
};

export type SuggestedWording = {
  title?: string;
  metaDescription?: string;
  h1?: string;
};

export type PatternResponse = {
  intro: string;
  sections: AiResponseSection[];
  checklist: string[];
  suggestedWording?: SuggestedWording;
  priority: "critical" | "high" | "medium" | "low" | "none";
  confidence: "stored data" | "early signal" | "needs more data";
  basedOn: string[];
};

type PatternTone = "urgent" | "helpful" | "encouraging" | "empty";

const PATTERNS: Record<AiResponsePatternKey, { tone: PatternTone; intros: string[] }> = {
  issue_detected: {
    tone: "helpful",
    intros: [
      "Tiny website gremlin spotted.",
      "Quick win sitting right here.",
      "This one’s not dramatic, but it does add up.",
      "A small leak showed up in the receipts.",
    ],
  },
  multiple_issues: {
    tone: "helpful",
    intros: [
      "A few gremlins are sharing office space.",
      "There are multiple cleanup jobs, but we can rank them like adults.",
      "Several signals are waving tiny suspicious flags.",
      "The dashboard found a short punch list, not a panic parade.",
    ],
  },
  critical_issue: {
    tone: "urgent",
    intros: [
      "Fix this before anything else.",
      "This one gets the front of the line.",
      "Tiny website gremlin? No. This one brought a clipboard.",
      "This is the thing wearing the suspicious little hat.",
    ],
  },
  improvement_opportunity: {
    tone: "helpful",
    intros: [
      "There’s a useful improvement hiding in plain sight.",
      "This is a tidy little upgrade opportunity.",
      "Not a five-alarm fire, but worth fixing.",
      "This can make the site feel sharper without a heroic rebuild.",
    ],
  },
  positive_trend: {
    tone: "encouraging",
    intros: [
      "This is moving in the right direction.",
      "Good news with receipts.",
      "Tiny parade, still a parade.",
      "This part is behaving. Suspiciously mature.",
    ],
  },
  negative_trend: {
    tone: "helpful",
    intros: [
      "Something dipped, and it deserves a look.",
      "The trend is leaning the wrong way.",
      "This is not panic territory, but it is tapping the glass.",
      "The numbers are doing that little frown thing.",
    ],
  },
  no_data: {
    tone: "empty",
    intros: [
      "I need more receipts before I start making claims.",
      "The dashboard is not guessing today. Growth.",
      "Not enough signal yet, and I refuse to throw glitter at guesses.",
      "The data is having a very private little party.",
    ],
  },
  crawl_missing: {
    tone: "empty",
    intros: [
      "I don’t have a clean crawl for this site yet.",
      "The SEO robot has not brought back usable receipts yet.",
      "No clean crawl, no page-level sermon.",
      "The crawl cabinet is empty right now.",
    ],
  },
  crawl_failed: {
    tone: "urgent",
    intros: [
      "The last crawl tripped before it saved useful data.",
      "The crawl did not bring back clean receipts.",
      "The robot went out and came back with a shrug.",
      "This crawl needs a retry before we trust it.",
    ],
  },
  all_clear: {
    tone: "encouraging",
    intros: [
      "No obvious fire right now.",
      "This looks calmer than usual. Weird, but welcome.",
      "Nothing is screaming today.",
      "The dashboard is not side-eyeing anything major right now.",
    ],
  },
};

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function choosePatternIntro(pattern: AiResponsePatternKey, seed: string): string {
  const intros = PATTERNS[pattern].intros;
  return intros[hash(`${pattern}:${seed}`) % intros.length] ?? intros[0]!;
}

function normalizePath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? "Homepage" : parsed.pathname;
  } catch {
    return url === "/" ? "Homepage" : url;
  }
}

function pageKind(page: SeoRecommendationPageInput): "homepage" | "service" | "about" | "contact" | "generic" {
  const path = normalizePath(page.path || page.url).toLowerCase();
  if (path === "homepage" || path === "/") return "homepage";
  if (path.includes("service") || path.includes("pricing") || path.includes("solution")) return "service";
  if (path.includes("about")) return "about";
  if (path.includes("contact")) return "contact";
  return "generic";
}

function pageTopic(page: SeoRecommendationPageInput, keywordContext?: SeoKeywordContext | null): string {
  const title = page.title?.replace(/\s+/g, " ").trim();
  if (title) return title.replace(/\s*[|·-]\s*.*$/, "").slice(0, 70);
  const primary = keywordContext?.primaryKeywords?.[0]?.trim();
  if (primary) return primary.slice(0, 70);
  const path = normalizePath(page.path || page.url).replace(/[/-]+/g, " ").trim();
  return path && path !== "Homepage" ? path : "your business";
}

export function buildSuggestedWording(
  page: SeoRecommendationPageInput,
  keywordContext?: SeoKeywordContext | null,
): SuggestedWording | undefined {
  const topic = pageTopic(page, keywordContext);
  const kind = pageKind(page);
  const business = keywordContext?.primaryKeywords?.[0] ?? topic;
  const hasContext = topic.trim().length > 2 || Boolean(keywordContext?.primaryKeywords?.length);
  if (!hasContext) return undefined;

  if (kind === "homepage") {
    return {
      title: `${business} | Website Help That Makes the Next Step Obvious`,
      metaDescription: `See what ${business} offers, who it helps, and the fastest next step to get started. Clear details, no mystery maze.`,
      h1: `${business}: Clear Help for Your Website`,
    };
  }
  if (kind === "service") {
    return {
      title: `${topic} Services | ${business}`,
      metaDescription: `Explore ${topic.toLowerCase()} services from ${business}. See what is included, who it is for, and how to take the next step.`,
      h1: `${topic} Services That Are Easy to Understand`,
    };
  }
  if (kind === "about") {
    return {
      title: `About ${business}`,
      metaDescription: `Learn who ${business} is, what it does, and why customers trust it. Tiny trust-building machine, basically.`,
      h1: `About ${business}`,
    };
  }
  if (kind === "contact") {
    return {
      title: `Contact ${business}`,
      metaDescription: `Contact ${business} with questions, project details, or next-step requests. Make it easy for humans to say hello.`,
      h1: `Contact ${business}`,
    };
  }
  return {
    title: `${topic} | ${business}`,
    metaDescription: `Learn about ${topic.toLowerCase()} from ${business}, including what matters, what to do next, and how to get started.`,
    h1: topic,
  };
}

export function formatSuggestedWording(wording?: SuggestedWording): string | null {
  if (!wording) return null;
  return [
    "Suggested wording:",
    wording.title ? `Title: ${wording.title}` : null,
    wording.metaDescription ? `Meta description: ${wording.metaDescription}` : null,
    wording.h1 ? `H1: ${wording.h1}` : null,
  ].filter(Boolean).join("\n");
}

export function buildPatternResponse(input: {
  pattern: AiResponsePatternKey;
  seed: string;
  what: string;
  why: string;
  next: string;
  checklist: string[];
  suggestedWording?: SuggestedWording;
  priority?: PatternResponse["priority"];
  confidence?: PatternResponse["confidence"];
  basedOn?: string[];
}): PatternResponse {
  const wordingText = formatSuggestedWording(input.suggestedWording);
  return {
    intro: choosePatternIntro(input.pattern, input.seed),
    sections: [
      { title: "What I’m seeing", body: input.what },
      { title: "Why it matters", body: input.why },
      { title: "What to do next", body: input.next },
      ...(wordingText ? [{ title: "Suggested wording" as const, body: wordingText }] : []),
    ],
    checklist: input.checklist.slice(0, 5),
    suggestedWording: input.suggestedWording,
    priority: input.priority ?? "medium",
    confidence: input.confidence ?? "stored data",
    basedOn: input.basedOn ?? ["stored dashboard data"],
  };
}

export function patternToDashboardAnswer(input: {
  pattern: PatternResponse;
  evidence: DashboardQuestionEvidence;
  intent: DashboardAnswerOutput["intent"];
  sourceLabel: DashboardAnswerOutput["source_label"];
  limitationNote?: string;
}): DashboardAnswerOutput {
  const answer = `${input.pattern.intro}\n\n${input.pattern.sections
    .map((section) => `${section.title}: ${section.body}`)
    .join("\n\n")}`;
  return {
    answer,
    evidence_points: input.pattern.basedOn.slice(0, 6),
    recommended_followups: input.pattern.checklist.slice(0, 5),
    confidence_note: `Based on ${input.pattern.confidence}; no live checks or secret sauce invented.`,
    intent: input.intent,
    source_label: input.sourceLabel,
    limitation_note: input.limitationNote,
    time_scope: input.evidence.time_scope,
    sections: input.pattern.sections,
    checklist: input.pattern.checklist,
    suggestedWording: input.pattern.suggestedWording,
    priority: input.pattern.priority,
    confidence: input.pattern.confidence,
    basedOn: input.pattern.basedOn,
  };
}
