import { ApiError, GEMINI_MODEL, parseMeal } from './gemini.js';
import { parseClaudeMeal } from './claude.js';

export function parserConfiguration(env) {
  const provider = env.AI_PROVIDER?.trim() || 'gemini';
  if (!['gemini', 'claude'].includes(provider)) throw new ApiError(503, 'INVALID_AI_PROVIDER', 'The server has an unsupported meal provider. Ask the owner to select Gemini or Claude.');
  const claude = provider === 'claude';
  const model = claude ? env.ANTHROPIC_MODEL?.trim() || '' : env.GEMINI_MODEL?.trim() || GEMINI_MODEL;
  const apiKey = claude ? env.ANTHROPIC_API_KEY : env.GEMINI_API_KEY;
  const enabled = !claude || env.CLAUDE_EVALUATION_ENABLED === 'true';
  return { provider, model, configured: Boolean(enabled && model && apiKey?.trim()), options: {
    apiKey, model, ...(claude ? { enabled } : { fallbackModel: env.GEMINI_FALLBACK_MODEL?.trim() || undefined }),
  }, parse: claude ? parseClaudeMeal : parseMeal };
}
