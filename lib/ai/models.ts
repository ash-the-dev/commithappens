export const DEFAULT_PRIMARY_MODEL = "gpt-5.4";
export const DEFAULT_FAST_MODEL = "gpt-5.4-mini";

export function getPrimaryAiModel(): string {
  return process.env.OPENAI_MODEL_PRIMARY?.trim() || DEFAULT_PRIMARY_MODEL;
}

export function getFastAiModel(): string {
  return process.env.OPENAI_MODEL_FAST?.trim() || DEFAULT_FAST_MODEL;
}

export function getOpenAiApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}
