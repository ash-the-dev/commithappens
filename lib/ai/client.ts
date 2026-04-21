import "server-only";
import OpenAI from "openai";
import { getOpenAiApiKey } from "@/lib/ai/models";

let client: OpenAI | null = null;

export function isOpenAiConfigured(): boolean {
  return getOpenAiApiKey() !== null;
}

export function getOpenAiClient(): OpenAI {
  if (client) return client;
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  client = new OpenAI({ apiKey });
  return client;
}
