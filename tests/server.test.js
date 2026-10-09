import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer, createRequestHandler } from '../server/index.js';
import { createServer, request as httpRequest } from 'node:http';
import { GEMINI_MODEL, mealSchema, parseMeal, validateMeal } from '../server/gemini.js';

const validMeal = () => ({ title: 'Chicken and rice', items: [{ name: 'chicken breast', amount: 200, unit: 'g', grams: 200, milliliters: null, nutrition: null, cookingState: 'unknown', preparation: 'pan fried', brand: null, query: 'chicken breast', assumptions: [], clarification: null }], checks: ['Check cooking oil.'] });

test('one glass of latte receives an editable volume and an honest AI estimate without a gram question', () => {
  const response = { title: 'Caffe latte', checks: ['Check sugar or syrup.'], items: [{
    name: 'caffe latte', amount: 1, unit: 'serving', grams: null, milliliters: 240,
    cookingState: 'as_sold', preparation: 'whole milk, no syrup', brand: null, query: 'caffe latte',
    assumptions: ['1 gelas diasumsikan 240 mL, susu full cream, tanpa gula tambahan.'], clarification: null,
    nutrition: { basis: 'ml', per100: { calories: 55, protein: 3, carbs: 4.5, fat: 3 } },
  }] };
  const result = validateMeal(response, 'Aku minum caffe latte 1 gelas', 'gemini-test');
  assert.equal(result.items[0].milliliters, 240);
  assert.equal(result.items[0].grams, null);
  assert.equal(result.items[0].clarification, null);
  assert.deepEqual(result.items[0].food.per100ml, response.items[0].nutrition.per100);
  assert.equal(result.items[0].food.source.dataType, 'ai_estimate');
  assert.equal(result.items[0].food.source.id, 'gemini-test');
  assert.equal(result.items[0].food.source.url, '');
  for (const invalid of [
    { ...response.items[0], grams: 240 },
    { ...response.items[0], milliliters: -1 },
    { ...response.items[0], nutrition: { basis: 'g', per100: response.items[0].nutrition.per100 } },
    { ...response.items[0], nutrition: { basis: 'ml', per100: { calories: 55, protein: -1, carbs: 4.5, fat: 3 } } },
    { ...response.items[0], nutrition: { basis: 'ml', per100: { calories: 55, protein: 3, fat: 3 } } },
    { ...response.items[0], nutrition: { basis: 'ml', per100: { ...response.items[0].nutrition.per100, calories: Infinity } } },
    { ...response.items[0], nutrition: { ...response.items[0].nutrition, source: 'USDA' } },
  ]) assert.throws(() => validateMeal({ ...response, items: [invalid] }), { code: 'INVALID_AI_RESPONSE' });
  const unidentifiable = validateMeal({ ...response, items: [{ ...response.items[0], nutrition: null }] });
  assert.equal(unidentifiable.items[0].food, null);
  const explicitVolume = validateMeal({ ...response, items: [{ ...response.items[0], unit: 'ml', amount: 350 }] });
  assert.equal(explicitVolume.items[0].milliliters, 350);
  const unwantedPortionQuestion = validateMeal({ ...response, items: [{ ...response.items[0], clarification: 'Berapa gram?' }] });
  assert.equal(unwantedPortionQuestion.items[0].clarification, null);
});

test('hosted APIs fail closed without cloud configuration or a verified signed-in user', async t => {
  let calls = 0;
  const parse = async () => { calls++; return validMeal(); };
  const missing = await app(t, { env: { VERCEL: '1', GEMINI_API_KEY: 'private-test-key' }, cloud: null, parse });
  const config = await (await missing.request('/api/config')).json();
  assert.equal(config.authRequired, true); assert.equal(config.cloudConfigured, false);
  assert.equal((await missing.request('/api/parse', { description: '200 g chicken' }, { Origin: missing.origin.replace('http:', 'https:') })).status, 503);
  const verified = [];
  const cloud = { auth: { getUser: async token => { verified.push(token); return token === 'valid-user-token' ? { data: { user: { id: 'user-one' } } } : { data: { user: null }, error: { message: 'private provider detail' } }; } } };
  const hosted = await app(t, { env: { SUPABASE_URL: 'https://test.supabase.co', GEMINI_API_KEY: 'private-test-key' }, cloud, parse });
  for (const [path, body] of [['/api/parse', { description: '200 g chicken' }], ['/api/foods/search', { query: 'rice' }], ['/api/foods/123', undefined], ['/api/foods/off-1234567890123', undefined]]) {
    assert.equal((await hosted.request(path, body)).status, 401);
    const invalid = await hosted.request(path, body, { Authorization: 'Bearer forged-token' });
    assert.equal(invalid.status, 401); assert.ok(!JSON.stringify(await invalid.json()).includes('private provider detail'));
  }
  assert.equal(calls, 0); assert.equal(verified.length, 4);
});

test('separate hosted handlers share a durable budget, count failed attempts, and never bypass a failed safeguard', async t => {
  let attempts = 0; let parses = 0; const leases = [];
  const cloud = {
    auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } } }) },
    rpc: async (name, values) => {
      if (name === 'release_parse') { assert.ok(leases.includes(values.p_lease)); return { error: null }; }
      assert.equal(name, 'reserve_parse'); assert.equal(values.p_daily_limit, 1); assert.equal(values.p_interval_seconds, 3);
      leases.push(values.p_lease); attempts++;
      return { data: { allowed: attempts === 1, reason: 'daily' }, error: null };
    },
  };
  const options = { env: { SUPABASE_URL: 'https://test.supabase.co', GEMINI_API_KEY: 'private-test-key', GEMINI_MODEL: 'gemini-2.5-flash-lite', GEMINI_DAILY_LIMIT: '1' }, cloud, parse: async (_text, options) => { parses++; assert.equal(options.model, 'gemini-2.5-flash-lite'); throw new Error('private description upstream'); } };
  const first = await app(t, options); const second = await app(t, options);
  const headers = { Authorization: 'Bearer valid-user-token' };
  const failed = await first.request('/api/parse', { description: '200 g chicken' }, headers);
  assert.equal(failed.status, 500); assert.ok(!(await failed.text()).includes('private description'));
  const capped = await second.request('/api/parse', { description: '200 g chicken' }, headers);
  assert.equal(capped.status, 429); assert.equal((await capped.json()).code, 'DAILY_SAFEGUARD'); assert.equal(parses, 1);
  const unavailable = await app(t, { ...options, cloud: { ...cloud, rpc: async () => ({ error: { message: 'secret backend detail' } }) } });
  assert.equal((await unavailable.request('/api/parse', { description: '200 g chicken' }, headers)).status, 503);
  assert.equal(parses, 1);
});

test('Vercel HTTPS origins and pre-parsed bodies use the same validated handler without trusting arbitrary hosts', async t => {
  let calls = 0;
  const handler = createRequestHandler({ env: { VERCEL: '1', VERCEL_URL: 'portion-test.vercel.app', GEMINI_API_KEY: 'private-test-key' }, cloud: {
    auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } } }) }, rpc: async () => ({ data: { allowed: true } }),
  }, parse: async () => { calls++; return validMeal(); }, apiOnly: true });
  const server = createServer((req, res) => {
    if (req.headers['x-test-body'] === 'invalid') Object.defineProperty(req, 'body', { get() { throw new Error('malformed JSON echoes private meal'); } });
    else req.body = { description: req.headers['x-test-body'] || '200 g chicken' };
    void handler(req, res);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); });
  const url = `http://127.0.0.1:${server.address().port}/api/parse`;
  const send = (headers) => new Promise((resolve, reject) => {
    const req = httpRequest(url, { method: 'POST', headers }, res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode })); });
    req.on('error', reject); req.end('{}');
  });
  const headers = { Host: 'portion-test.vercel.app', Origin: 'https://portion-test.vercel.app', 'Content-Type': 'application/json', Authorization: 'Bearer valid-user-token' };
  assert.equal((await send(headers)).status, 200);
  assert.equal((await send({ ...headers, 'x-test-body': 'invalid' })).status, 400);
  assert.equal((await send({ ...headers, Host: 'foreign.vercel.app', Origin: 'https://foreign.vercel.app' })).status, 403);
  assert.equal((await send({ ...headers, Origin: 'https://foreign.example' })).status, 403);
  assert.equal(calls, 1);
});

async function app(t, options = {}) {
  const server = createAppServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((done) => server.close(done)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, headers = {}) => fetch(origin + path, body === undefined ? { headers } : { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) });
  return { request, origin };
}

test('missing Gemini configuration is actionable and no fake parser result is returned', async (t) => {
  let calls = 0;
  const { request } = await app(t, { env: {}, parse: async () => { calls += 1; return validMeal(); } });
  const config = await (await request('/api/config')).json();
  assert.equal(config.geminiConfigured, false);
  assert.equal(config.model, GEMINI_MODEL);
  assert.equal(config.nutritionMode, 'shared-demo-key');
  const result = await request('/api/parse', { description: '200 g chicken' });
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /GEMINI_API_KEY.*server/);
  assert.equal(calls, 0);
});

test('one global in-flight request, pacing, daily cap, and UTC reset guard real API calls', async (t) => {
  let time = Date.UTC(2026, 9, 1, 9);
  let finish;
  let calls = 0;
  const { request } = await app(t, { env: { GEMINI_API_KEY: 'server-only-secret', GEMINI_DAILY_LIMIT: '2', GEMINI_MIN_INTERVAL_SECONDS: '3' }, now: () => time, parse: async () => { calls += 1; if (calls === 1) await new Promise((resolve) => { finish = resolve; }); return validMeal(); } });
  const first = request('/api/parse', { description: '200 g chicken' });
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  const concurrent = await request('/api/parse', { description: '200 g chicken' });
  assert.equal(concurrent.status, 429);
  assert.equal((await concurrent.json()).code, 'REQUEST_PACING');
  finish();
  assert.equal((await first).status, 200);
  const paced = await request('/api/parse', { description: '200 g chicken' });
  assert.equal(paced.status, 429);
  time += 3000;
  assert.equal((await request('/api/parse', { description: '200 g chicken' })).status, 200);
  const cap = await request('/api/parse', { description: '200 g chicken' });
  assert.equal((await cap.json()).code, 'DAILY_SAFEGUARD');
  assert.equal(calls, 2);
  const config = await (await request('/api/config')).json();
  assert.equal(config.remainingToday, 0);
  assert.ok(!JSON.stringify(config).includes('server-only-secret'));
  time = Date.UTC(2026, 9, 2, 0);
  assert.equal((await request('/api/parse', { description: '200 g chicken' })).status, 200);
});

test('JSON, input limits, and foreign origins are rejected before reaching Google', async (t) => {
  let calls = 0;
  const { request, origin } = await app(t, { env: { GEMINI_API_KEY: 'secret' }, parse: async () => { calls += 1; return validMeal(); } });
  assert.equal((await request('/api/parse', { description: 'aa' })).status, 400);
  assert.equal((await request('/api/parse', { description: 'x'.repeat(4001) })).status, 400);
  assert.equal((await request('/api/parse', { description: 'x'.repeat(21000) })).status, 413);
  assert.equal((await request('/api/parse', { description: '200 g chicken' }, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await request('/api/parse', { description: '200 g chicken' }, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await fetch(origin + '/api/parse', { method: 'POST', body: 'description=chicken', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).status, 415);
  const malformed = await fetch(origin + '/api/parse', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } });
  assert.equal(malformed.status, 400);
  assert.equal(calls, 0);
});

test('USDA search and detail are exposed without Gemini or a cloud food log', async (t) => {
  const record = { id: '123', per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } };
  const { request } = await app(t, { env: {}, search: async (input) => { assert.deepEqual(input, { query: 'chicken', name: '', cookingState: 'cooked', brand: '', source: 'auto' }); return [record]; }, food: async (id) => { assert.equal(id, '123'); return record; } });
  assert.deepEqual(await (await request('/api/foods/search', { query: 'chicken', cookingState: 'cooked', brand: null })).json(), { foods: [record] });
  assert.deepEqual(await (await request('/api/foods/123')).json(), { food: record });
});

test('package search keeps the local name and source choice, and routes OFF product IDs', async t => {
  const record = { id: 'off-1234567890123', name: 'Test pilus' };
  const { request } = await app(t, { env: {}, search: async input => {
    assert.deepEqual(input, { query: 'pilus', name: 'kacang pilus', brand: 'Test', cookingState: 'as_sold', source: 'openfoodfacts' });
    return [record];
  }, food: async id => { assert.equal(id, record.id); return record; } });
  assert.deepEqual(await (await request('/api/foods/search', { query: 'pilus', name: 'kacang pilus', brand: 'Test', cookingState: 'as_sold', source: 'openfoodfacts' })).json(), { foods: [record] });
  assert.deepEqual(await (await request(`/api/foods/${record.id}`)).json(), { food: record });
});

test('built client is served while files outside dist stay inaccessible', async (t) => {
  const distPath = await mkdtemp(join(tmpdir(), 'portion-static-'));
  t.after(() => rm(distPath, { recursive: true, force: true }));
  await writeFile(join(distPath, 'index.html'), '<h1>Portion</h1>');
  const { request } = await app(t, { distPath });
  assert.equal(await (await request('/')).text(), '<h1>Portion</h1>');
  assert.equal((await request('/.env')).status, 404);
  assert.equal((await request('/%2e%2e%2fpackage.json')).status, 404);
});

test('Gemini response validation accepts household estimates and still asks material weighing questions', () => {
  const meal = validateMeal(validMeal());
  assert.match(meal.items[0].clarification, /raw\/dry or cooked/);
  const household = validMeal();
  Object.assign(household.items[0], { unit: 'tsp', amount: 1, grams: 5 });
  assert.equal(validateMeal(household).items[0].grams, 5);
  assert.match(validateMeal(household).items[0].clarification, /raw\/dry or cooked/);
  const withNutrition = validMeal();
  withNutrition.items[0].calories = 330;
  assert.throws(() => validateMeal(withNutrition), { code: 'INVALID_AI_RESPONSE' });
  const negative = validMeal();
  negative.items[0].amount = -1;
  assert.throws(() => validateMeal(negative), { code: 'INVALID_AI_RESPONSE' });
  assert.throws(() => validateMeal({ title: 'No meal', items: [], checks: [] }), { code: 'NO_FOODS_FOUND', status: 422 });
});

test('weighing-state fallbacks follow Indonesian or English without changing preparation or food identity', () => {
  const meal = validMeal();
  Object.assign(meal, { title: 'Ayam bakar', checks: ['Kalau pakai minyak, tambahkan jumlahnya.'] });
  Object.assign(meal.items[0], { name: 'dada ayam', query: 'chicken breast', preparation: 'bakar', grams: 999 });
  const indonesian = validateMeal(meal, 'Saya makan dada ayam bakar 200 g');
  assert.match(indonesian.items[0].clarification, /mentah\/kering atau matang/);
  assert.equal(indonesian.items[0].grams, 200);
  assert.equal(indonesian.items[0].cookingState, 'unknown');
  assert.equal(indonesian.items[0].preparation, 'bakar');
  assert.equal(indonesian.items[0].query, 'chicken breast');
  assert.deepEqual(indonesian.checks, meal.checks);
  assert.match(validateMeal(meal, 'I ate 200 g of grilled dada ayam').items[0].clarification, /raw\/dry or cooked/);
  const translatedName = validMeal();
  translatedName.items[0].name = 'makanan';
  assert.match(validateMeal(translatedName, 'Aku makan chicken breast 200 g').items[0].clarification, /mentah\/kering atau matang/);
  meal.items[0].cookingState = 'cooked';
  assert.equal(validateMeal(meal, 'Dada ayam ditimbang matang 200 g').items[0].clarification, null);
});

test('household portions use visible gram assumptions without a portion clarification', () => {
  const meal = validMeal();
  Object.assign(meal.items[0], { name: 'tempe', query: 'tempeh', amount: 1, unit: 'piece', grams: 80, cookingState: 'cooked', preparation: 'goreng', assumptions: ['Tempe ukuran sedang; berapa gram yang dimakan?'] });
  const result = validateMeal(meal, 'Tempe goreng 1 potong ukuran sedang');
  assert.equal(result.items[0].grams, 80);
  assert.equal(result.items[0].clarification, null);
  assert.deepEqual(result.items[0].assumptions, meal.items[0].assumptions);
  assert.equal(result.items.length, 1);
  for (const [target, field] of [[meal, 'reply'], [meal, 'calories'], [meal.items[0], 'protein']]) {
    target[field] = 1;
    assert.throws(() => validateMeal(meal), { code: 'INVALID_AI_RESPONSE' });
    delete target[field];
  }
});

test('Gemini REST transport pins the model, honest estimation schema, and LOW thinking', async () => {
  const result = await parseMeal('200 g chicken', { apiKey: 'server-only-secret', model: 'gemini-3.8-flash', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'server-only-secret');
    assert.ok(!url.includes('server-only-secret'));
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseJsonSchema, mealSchema);
    assert.equal(mealSchema.additionalProperties, false);
    assert.equal(mealSchema.properties.items.items.additionalProperties, false);
    assert.equal(body.generationConfig.responseFormat, undefined);
    // Raw REST expects the reference's enum, rather than the guide's lowercase example.
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'LOW');
    assert.equal(body.contents[0].parts[0].text, '200 g chicken');
    const instruction = body.systemInstruction.parts[0].text;
    assert.match(instruction, /NutriTrack ID/);
    assert.match(instruction, /warteg or anak-kost.*tempe, tahu, sambal, dada ayam, nasi liwet, and mie ayam/);
    assert.match(instruction, /user's primary language.*casual Indonesian.*English/s);
    assert.match(instruction, /English USDA database search query/);
    assert.match(instruction, /Keep named composite dishes as single items/);
    assert.match(instruction, /typical size.*assumed total grams or mL/s);
    assert.match(instruction, /Never assume 1 mL equals 1 g/);
    assert.match(instruction, /Do not ask the user for grams just because they gave a household measure/);
    assert.match(instruction, /bakar\/grilled, goreng\/fried, kukus\/steamed, and rebus\/boiled/);
    assert.match(instruction, /minyak\/oil, mentega\/butter, santan\/coconut milk, tepung\/flour/);
    assert.match(instruction, /Never claim that an assumed ingredient was definitely consumed/);
    assert.match(instruction, /basreng stays basreng, and kacang pilus uses pilus/);
    assert.match(instruction, /never replace it with plain peanuts/);
    assert.match(instruction, /explicitly AI estimates, NOT retrieved or verified data/);
    assert.match(instruction, /Never invent a database ID, citation, web search, exact package label/);
    assert.equal(body.tools, undefined);
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'internal reasoning is not JSON' }, { text: JSON.stringify(validMeal()) }] } }] }));
  } });
  assert.equal(result.items[0].grams, 200);

  // Models without thinking (such as gemini-2.5-flash-lite) omit thinkingConfig
  await parseMeal('200 g chicken', { apiKey: 'server-only-secret', model: 'gemini-2.5-flash-lite', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.thinkingConfig, undefined);
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(validMeal()) }] } }] }));
  } });
});

test('profile, nutrition targets, and photos in a parse request never enter Gemini transport', async (t) => {
  let calls = 0;
  const description = 'Aku makan 1 centong nasi liwet dan mie ayam';
  const responseMeal = validMeal();
  responseMeal.title = 'Nasi liwet dan mie ayam';
  responseMeal.items = ['nasi liwet', 'mie ayam'].map((name) => ({ ...validMeal().items[0], name, amount: 1, unit: 'serving', grams: null, query: name === 'nasi liwet' ? 'nasi liwet Indonesian rice dish' : 'mie ayam Indonesian noodle dish', assumptions: ['Berapa gram yang dimakan?'], clarification: 'Berat ini ditimbang mentah/kering atau matang?' }));
  const { request } = await app(t, { env: { GEMINI_API_KEY: 'server-only-secret' }, parse: (text, options) => parseMeal(text, { ...options, fetchImpl: async (_url, options) => {
    calls += 1;
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ['contents', 'generationConfig', 'systemInstruction']);
    assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: description }] }]);
    assert.doesNotMatch(options.body, /private-age|private-body|private-location|private-target|private-photo/);
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(responseMeal) }] } }] }));
  } }) });
  const result = await request('/api/parse', { description, profile: { age: 'private-age', body: 'private-body', location: 'private-location' }, nutritionTargets: 'private-target', photo: 'private-photo' });
  assert.equal(result.status, 200);
  const parsed = await result.json();
  assert.deepEqual(parsed.items.map(({ name }) => name), ['nasi liwet', 'mie ayam']);
  assert.ok(parsed.items.every(({ grams }) => grams === null));
  assert.equal(calls, 1);
});

test('Google HTTP 400 distinguishes invalid keys and project prerequisites without exposing upstream details', async t => {
  for (const [providerError, code, status] of [
    [{ status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] }, 'GEMINI_KEY_REJECTED', 503],
    [{ status: 'FAILED_PRECONDITION' }, 'GEMINI_PROJECT_REJECTED', 503],
    [{ status: 'INVALID_ARGUMENT' }, 'GEMINI_REQUEST_REJECTED', 502],
  ]) {
    const { request } = await app(t, {
      env: { GEMINI_API_KEY: 'server-only-secret', GEMINI_MIN_INTERVAL_SECONDS: '0' },
      parse: (text, options) => parseMeal(text, { ...options, fetchImpl: async () => new Response(JSON.stringify({
        error: { ...providerError, message: 'private description and server-only-secret', details: [...(providerError.details || []), { message: 'private description and server-only-secret', metadata: { key: 'server-only-secret' } }] },
      }), { status: 400 }) }),
    });
    const response = await request('/api/parse', { description: 'private description' });
    const body = await response.json();
    assert.equal(body.code, code);
    assert.equal(response.status, status);
    assert.doesNotMatch(JSON.stringify(body), /private description|server-only-secret|metadata/);
  }
});

test('Gemini request failures, free-tier access, rate limits and overload stay distinct and private', async () => {
  for (const [status, code] of [[400, 'GEMINI_REQUEST_REJECTED'], [402, 'GEMINI_BILLING_REJECTED'], [429, 'GEMINI_QUOTA'], [403, 'GEMINI_KEY_REJECTED'], [404, 'GEMINI_MODEL_UNAVAILABLE'], [500, 'GEMINI_UNAVAILABLE'], [503, 'GEMINI_BUSY']]) {
    await assert.rejects(parseMeal('private description', { apiKey: 'secret', fetchImpl: async () => new Response('private description and secret', { status, headers: { 'retry-after': '17' } }) }), (error) => {
      assert.equal(error.code, code);
      assert.ok(!error.message.includes('private description'));
      assert.ok(!error.message.includes('secret'));
      if (status === 429) assert.equal(error.retryAfterSeconds, 17);
      if (status === 400) assert.doesNotMatch(error.message, /try again later/i);
      if (status === 402) assert.match(error.message, /billing or credit.*Free Tier.*not enable billing/i);
      if (status === 503) {
        assert.equal(error.status, 503);
        assert.match(error.message, /temporarily overloaded or unavailable/);
        assert.equal(error.retryAfterSeconds, 60);
      }
      return true;
    });
  }
  await assert.rejects(parseMeal('private description', { apiKey: 'secret', fetchImpl: async () => { throw new DOMException('private description', 'TimeoutError'); } }), { code: 'GEMINI_TIMEOUT' });
  await assert.rejects(parseMeal('private description', { apiKey: 'secret', fetchImpl: async () => new Response('{') }), { code: 'GEMINI_UNAVAILABLE' });
});

test('failed API attempts consume the app safeguard and unexpected errors are sanitized', async (t) => {
  const { request } = await app(t, { env: { GEMINI_API_KEY: 'secret', GEMINI_DAILY_LIMIT: '1', GEMINI_MIN_INTERVAL_SECONDS: '0' }, parse: async () => { throw new Error('raw meal description and key'); } });
  const failed = await request('/api/parse', { description: '200 g chicken' });
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes('raw meal description'));
  assert.equal((await (await request('/api/parse', { description: '200 g chicken' })).json()).code, 'DAILY_SAFEGUARD');
});

test('automatically falls back to fallback model when primary model hits rate limit or quota', async () => {
  const calls = [];
  const signals = [];
  const responseMeal = validMeal();
  responseMeal.items[0].nutrition = { basis: 'g', per100: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } };
  const result = await parseMeal('200 g chicken', {
    apiKey: 'secret',
    model: 'gemini-3.5-flash-lite',
    fallbackModel: 'gemini-3.1-flash-lite',
    fetchImpl: async (url, options) => {
      signals.push(options.signal);
      calls.push(url);
      if (url.includes('gemini-3.5-flash-lite')) {
        return new Response('quota reached', { status: 429, headers: { 'retry-after': '60' } });
      }
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(responseMeal) }] } }] }));
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(signals[0], signals[1], 'Fallback must share the primary request deadline');
  assert.ok(calls[0].includes('gemini-3.5-flash-lite'));
  assert.ok(calls[1].includes('gemini-3.1-flash-lite'));
  assert.equal(result.title, responseMeal.title);
  assert.equal(result.items[0].food.source.id, 'gemini-3.1-flash-lite');
});
