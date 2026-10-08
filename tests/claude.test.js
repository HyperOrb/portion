import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseClaudeMeal, claudeSchema } from '../server/claude.js';
import { parserConfiguration } from '../server/parser.js';
import { createAppServer } from '../server/index.js';
import { freshData, validateBackup, mealTotals } from '../src/domain.ts';

const meal = () => ({ title: 'Oat latte', checks: ['Check milk and sugar.'], items: [{
  name: 'oat latte', amount: 240, unit: 'ml', grams: null, milliliters: 240,
  cookingState: 'as_sold', preparation: 'oat milk', brand: null, query: 'oat latte',
  assumptions: ['Assumed oat milk without added sugar.'], clarification: null,
  nutrition: { basis: 'ml', per100: { calories: 55, protein: 3, carbs: 4.5, fat: 3 } },
}] });
const options = { apiKey: 'test-private-key', model: 'claude-test', enabled: true };
const response = value => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(value) }] }));

test('Claude requires explicit enablement and a configured model before any request', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response(meal()); };
  await assert.rejects(parseClaudeMeal('latte', { ...options, enabled: false, fetchImpl }), { code: 'CLAUDE_DISABLED' });
  await assert.rejects(parseClaudeMeal('latte', { ...options, model: '', fetchImpl }), { code: 'CLAUDE_NOT_CONFIGURED' });
  assert.equal(calls, 0);
  assert.equal(parserConfiguration({ ANTHROPIC_API_KEY: 'key', ANTHROPIC_MODEL: 'test', CLAUDE_EVALUATION_ENABLED: 'true' }).provider, 'gemini');
  assert.equal(parserConfiguration({ AI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'key', ANTHROPIC_MODEL: 'test' }).configured, false);
  assert.throws(() => parserConfiguration({ AI_PROVIDER: 'anything' }), { code: 'INVALID_AI_PROVIDER' });
});

test('Claude transport uses structured outputs, shared nutrition validation, and honest provenance', async () => {
  let request;
  const result = await parseClaudeMeal('240 ml oat latte', { ...options, fetchImpl: async (url, opts) => { request = { url, ...opts }; return response(meal()); } });
  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(request.headers['x-api-key'], options.apiKey);
  assert.equal(request.headers['anthropic-version'], '2023-06-01');
  const body = JSON.parse(request.body);
  assert.equal(body.model, 'claude-test');
  assert.deepEqual(body.messages, [{ role: 'user', content: '240 ml oat latte' }]);
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.output_config.format.schema.properties.items.items.additionalProperties, false);
  assert.ok(!JSON.stringify(claudeSchema()).includes('"maximum":'));
  assert.equal(result.items[0].grams, null);
  assert.equal(result.items[0].milliliters, 240);
  assert.equal(result.items[0].food.source.name, 'Claude AI estimate');
  assert.equal(result.items[0].food.source.dataType, 'ai_estimate');
  assert.equal(result.items[0].food.source.url, '');
  const invalid = meal(); invalid.items[0].nutrition.per100.protein = -1;
  await assert.rejects(parseClaudeMeal('latte', { ...options, fetchImpl: async () => response(invalid) }), { code: 'INVALID_AI_RESPONSE' });
  const mismatch = meal(); mismatch.items[0].grams = 240;
  await assert.rejects(parseClaudeMeal('latte', { ...options, fetchImpl: async () => response(mismatch) }), { code: 'INVALID_AI_RESPONSE' });
});

test('Claude refusals, truncation, timeouts and provider failures are private and do not fall back', async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 529]) {
    let calls = 0;
    await assert.rejects(parseClaudeMeal('private meal', { ...options, fetchImpl: async () => { calls++; return new Response('private-key private meal', { status }); } }), error => !error.message.includes('private-key') && !error.message.includes('private meal'));
    assert.equal(calls, 1);
  }
  for (const stop_reason of ['refusal', 'max_tokens']) {
    await assert.rejects(parseClaudeMeal('latte', { ...options, fetchImpl: async () => new Response(JSON.stringify({ stop_reason, content: [{ type: 'text', text: JSON.stringify(meal()) }] })) }), { code: 'CLAUDE_INCOMPLETE' });
  }
  await assert.rejects(parseClaudeMeal('latte', { ...options, fetchImpl: async () => { throw new DOMException('private', 'TimeoutError'); } }), { code: 'CLAUDE_TIMEOUT' });
});

test('Claude HTTP selection preserves auth, durable limits, input filtering and disabled gates', async t => {
  let calls = 0; let budget = 0;
  const cloud = { auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'owner' } : null } }) }, rpc: async name => {
    if (name === 'release_parse') return {};
    budget++; return { data: { allowed: budget === 1, reason: 'daily' } };
  } };
  const env = { SUPABASE_URL: 'https://test.supabase.co', AI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'private-key', ANTHROPIC_MODEL: 'claude-test', CLAUDE_EVALUATION_ENABLED: 'true', AI_DAILY_LIMIT: '1' };
  async function server(overrides = {}) {
    const app = createAppServer({ env: { ...env, ...overrides }, cloud, parse: async (description, opts) => { calls++; assert.equal(description, '240 ml latte'); assert.equal(opts.model, 'claude-test'); assert.equal(opts.enabled, true); return meal(); } });
    app.listen(0, '127.0.0.1'); await once(app, 'listening');
    t.after(() => { app.closeAllConnections(); app.close(); });
    return `http://127.0.0.1:${app.address().port}`;
  }
  const url = await server();
  const config = await (await fetch(`${url}/api/config`)).json();
  assert.equal(config.aiProvider, 'claude'); assert.equal(config.aiConfigured, true); assert.ok(!JSON.stringify(config).includes('private-key'));
  const send = (base, token = 'valid') => fetch(`${base}/api/parse`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ description: '240 ml latte', profile: 'never forwarded', provider: 'gemini' }) });
  assert.equal((await send(url, 'invalid')).status, 401);
  assert.equal((await send(url)).status, 200);
  assert.equal((await send(url)).status, 429);
  const disabled = await server({ CLAUDE_EVALUATION_ENABLED: 'false' });
  assert.equal((await (await send(disabled)).json()).code, 'CLAUDE_DISABLED');
  assert.equal(calls, 1); assert.equal(budget, 2);
});

test('www production origins must match the configured protocol and port', async t => {
  const app = createAppServer({ env: { APP_ORIGIN: 'https://portion.my.id' } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const url = `http://127.0.0.1:${app.address().port}/api/config`;
  for (const origin of ['http://www.portion.my.id', 'https://www.portion.my.id:444']) assert.equal((await fetch(url, { headers: { Origin: origin } })).status, 403);
  assert.equal((await fetch(url, { headers: { Origin: 'https://www.portion.my.id' } })).status, 200);
});

test('Claude estimates survive journal and backup validation without losing provenance', async () => {
  const parsed = await parseClaudeMeal('240 ml oat latte', { ...options, fetchImpl: async () => response(meal()) });
  const backup = { ...freshData(), meals: [{ id: 'meal-one', date: '2026-10-08', title: parsed.title, items: parsed.items.map((item, index) => ({ ...item, id: `item-${index}` })), checks: parsed.checks, createdAt: '2026-10-08T00:00:00.000Z' }] };
  const restored = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(restored.meals[0].items[0].food.source.name, 'Claude AI estimate');
  assert.equal(restored.meals[0].items[0].food.source.id, 'claude-test');
  assert.equal(mealTotals(restored.meals[0].items).calories, 132);
  for (const changes of [{ name: 'USDA FoodData Central' }, { url: 'https://fdc.nal.usda.gov/food-details/123/nutrients' }, { dataType: 'verified' }]) {
    const forged = structuredClone(backup);
    Object.assign(forged.meals[0].items[0].food.source, changes);
    assert.throws(() => validateBackup(forged), /unverified AI estimate/);
  }
});
