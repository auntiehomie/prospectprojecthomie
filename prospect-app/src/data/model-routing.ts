export const DEFAULT_OPENROUTER_MODEL_CHAIN = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'openai/gpt-5.6-sol',
  'deepseek/deepseek-v4-pro',
] as const;

/**
 * Mirrors the cost-first OpenClaw TUI chain by default. A comma-separated
 * endpoint-specific chain overrides it without requiring a code change.
 */
export function resolveOpenRouterModelChain(endpointOverride?: string): string[] {
  const configured = endpointOverride || process.env.OPENROUTER_MODEL_CHAIN || '';
  const parsed = configured
    .split(',')
    .map((model) => normalizeOpenRouterModelId(model))
    .filter(Boolean);
  return parsed.length > 0 ? [...new Set(parsed)] : [...DEFAULT_OPENROUTER_MODEL_CHAIN];
}

export function normalizeOpenRouterModelId(model: string): string {
  const trimmed = model.trim();
  return trimmed.startsWith('openrouter/') ? trimmed.slice('openrouter/'.length) : trimmed;
}
