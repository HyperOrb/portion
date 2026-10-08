import { ApiError, SYSTEM_INSTRUCTION, mealSchema, validateMeal } from './gemini.js';

// Claude's raw structured-output schema omits unsupported numerical constraints.
// Keep them in descriptions and enforce the original limits in validateMeal.
export function claudeSchema(value = mealSchema) {
  if (Array.isArray(value)) return value.map(entry => claudeSchema(entry));
  if (!value || typeof value !== 'object') return value;
  const limits = ['minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength'];
  const schema = Object.fromEntries(Object.entries(value).filter(([key]) => !limits.includes(key)).map(([key, entry]) => [key, claudeSchema(entry)]));
  const constraints = limits.filter(key => Object.hasOwn(value, key)).map(key => `${key}: ${value[key]}`);
  if (constraints.length) schema.description = [schema.description, ...constraints].filter(Boolean).join('; ');
  return schema;
}

export async function parseClaudeMeal(description, {
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.ANTHROPIC_MODEL?.trim(),
  enabled = process.env.CLAUDE_EVALUATION_ENABLED === 'true',
  fetchImpl = fetch,
  timeoutMs = 25000,
} = {}) {
  if (!enabled) throw new ApiError(503, 'CLAUDE_DISABLED', 'Claude evaluation is disabled. The server owner must explicitly enable it and approve API costs first.');
  if (!apiKey?.trim() || !model) throw new ApiError(503, 'CLAUDE_NOT_CONFIGURED', 'Claude evaluation needs a server-only API key and an explicitly selected supported model. Manual entry remains available.');
  try {
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 8192, system: SYSTEM_INSTRUCTION,
        messages: [{ role: 'user', content: description }],
        output_config: { format: { type: 'json_schema', schema: claudeSchema() } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      // Never forward provider bodies: they can contain keys, meal text, or account details.
      if (response.status === 429) {
        const retry = Number(response.headers.get('retry-after'));
        throw new ApiError(429, 'CLAUDE_QUOTA', 'Claude is rate limited. Wait and retry or use manual entry.', Number.isFinite(retry) && retry > 0 ? Math.min(retry, 86400) : 60);
      }
      if ([401, 403, 404].includes(response.status)) throw new ApiError(503, 'CLAUDE_ACCESS_REJECTED', 'Claude evaluation access or model configuration was rejected. Ask the server owner to check it.');
      if (response.status === 400) throw new ApiError(502, 'CLAUDE_REQUEST_REJECTED', 'Claude rejected the evaluation request. Check model and structured-output support.');
      throw new ApiError(503, 'CLAUDE_UNAVAILABLE', 'Claude evaluation is unavailable. Try later or enter foods manually.');
    }
    const payload = await response.json();
    if (payload.stop_reason !== 'end_turn') throw new ApiError(502, 'CLAUDE_INCOMPLETE', 'Claude did not complete the meal estimate. Try a shorter description or use manual entry.');
    const result = payload.content?.filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('');
    if (!result || result.length > 50000) throw new Error('Invalid response');
    return validateMeal(JSON.parse(result), description, model, 'Claude');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new ApiError(504, 'CLAUDE_TIMEOUT', 'Claude took too long. Retry later or enter foods manually.');
    throw new ApiError(502, 'CLAUDE_INVALID_RESPONSE', 'Claude could not return a valid meal. Try later or enter foods manually.');
  }
}
