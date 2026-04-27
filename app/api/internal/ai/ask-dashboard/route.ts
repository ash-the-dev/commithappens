import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { requireIntelligenceForUser } from "@/lib/billing/intelligence-guard";
import { getWebsiteForUser } from "@/lib/db/websites";
import { answerWebsiteQuestion } from "@/lib/ai/dashboard-qa";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

type Body = {
  website_id?: string;
  question?: string;
  current_tab?: string | null;
};

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
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!websiteId) return json({ ok: false, error: "website_id_required" }, 400);
  if (!question) return json({ ok: false, error: "question_required" }, 400);
  if (question.length > 400) return json({ ok: false, error: "question_too_long" }, 400);

  const site = await getWebsiteForUser(websiteId, userId);
  if (!site) return json({ ok: false, error: "website_not_found" }, 404);

  try {
    const result = await answerWebsiteQuestion(websiteId, question, {
      currentTab: typeof body.current_tab === "string" ? body.current_tab.trim() : null,
    });
    return json({ ok: true, answer: result }, 200);
  } catch (err) {
    console.error("[ai.ask-dashboard] failed", err);
    return json({ ok: false, error: "ask_failed" }, 500);
  }
}

