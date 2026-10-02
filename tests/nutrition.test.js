import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { getFood, searchFoods } from '../server/nutrition.js';

afterEach(() => mock.restoreAll());

// Fixtures model the actual USDA detail schema; no fixture is available at runtime.
function record(overrides = {}) {
  return {
    fdcId: 171077,
    dataType: 'SR Legacy',
    description: 'Chicken breast, skinless, raw',
    foodNutrients: [[1008, 'kcal', 120], [1003, 'g', 22.5], [1004, 'g', 2.62], [1005, 'g', 0]].map(([id, unitName, amount]) => ({ nutrient: { id, unitName }, amount })),
    foodPortions: [{ amount: 4, modifier: 'oz', measureUnit: { name: 'undetermined' }, gramWeight: 113 }],
    ...overrides,
  };
}

test('uses database calories, preserves reported zero and returns source-backed portions', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json(record()));
  const food = await getFood(171077);
  assert.deepEqual(food.per100g, { calories: 120, protein: 22.5, carbs: 0, fat: 2.62 });
  assert.deepEqual(food.portions, [{ description: '4 oz', grams: 113 }]);
  assert.equal(food.cookingState, 'raw');
  assert.equal(food.source.url, 'https://fdc.nal.usda.gov/food-details/171077/nutrients');
});

test('missing or null macros are rejected rather than changed to zero', async () => {
  for (const amount of [undefined, null, '0']) {
    const food = record();
    food.foodNutrients[3].amount = amount;
    mock.method(globalThis, 'fetch', async () => Response.json(food));
    await assert.rejects(getFood(171077), error => error.status === 422 && error.code === 'INCOMPLETE_NUTRITION');
  }
});

test('supports USDA Atwater energy, and rejects a wrong nutrient unit', async () => {
  const food = record();
  food.foodNutrients[0] = { nutrient: { id: 2048, unitName: 'kcal' }, amount: 119 };
  mock.method(globalThis, 'fetch', async () => Response.json(food));
  assert.equal((await getFood(171077)).per100g.calories, 119);
  food.foodNutrients[0].nutrient.unitName = 'kJ';
  await assert.rejects(getFood(171077), error => error.status === 422);
});

test('branded milliliter or missing basis is never applied to grams', async () => {
  for (const servingSizeUnit of ['ml', undefined]) {
    mock.method(globalThis, 'fetch', async () => Response.json(record({ dataType: 'Branded', servingSizeUnit })));
    await assert.rejects(getFood(171077), error => error.status === 422);
  }
});

test('branded source preserves manufacturer identity for review and backup', async () => {
  for (const brandFields of [{ brandName: 'Example Brand', brandOwner: 'Example Owner' }, { brandOwner: 'Example Owner' }]) {
    mock.method(globalThis, 'fetch', async () => Response.json(record({ dataType: 'Branded', servingSizeUnit: 'g', description: 'Plain yogurt', ...brandFields })));
    const food = await getFood(171077);
    assert.equal(food.source.description, `Plain yogurt — ${brandFields.brandName || brandFields.brandOwner}`);
    assert.equal(food.name, 'Plain yogurt');
  }
});

test('generic search excludes cooked/raw mismatch and incomplete records', async () => {
  let sent;
  mock.method(globalThis, 'fetch', async (_url, options) => {
    sent = JSON.parse(options.body);
    return Response.json({ foods: [record(), record({ fdcId: 123, description: 'Chicken breast, roasted', foodPortions: [] }), record({ fdcId: 124, foodNutrients: [] })] });
  });
  const foods = await searchFoods({ query: 'chicken breast', cookingState: 'cooked', brand: null });
  assert.equal(foods.length, 1);
  assert.equal(foods[0].id, '123');
  assert.deepEqual(sent.dataType, ['Foundation', 'SR Legacy', 'Survey (FNDDS)']);
});

test('branded search batch-verifies gram basis and does not silently accept ml', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    if (calls === 1) return Response.json({ foods: [record({ fdcId: 1 }), record({ fdcId: 2 })] });
    assert.deepEqual(JSON.parse(options.body).fdcIds, [1, 2]);
    return Response.json([record({ fdcId: 1, dataType: 'Branded', servingSizeUnit: 'g' }), record({ fdcId: 2, dataType: 'Branded', servingSizeUnit: 'ml' })]);
  });
  const foods = await searchFoods({ query: 'yogurt', brand: 'Example', cookingState: 'as_sold' });
  assert.deepEqual(foods.map(food => food.id), ['1']);
  assert.equal(calls, 2);
});

test('quota and network errors have actionable sanitized messages', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('upstream secret details', { status: 429 }));
  await assert.rejects(getFood(171077), error => error.status === 429 && !error.message.includes('upstream'));
  mock.method(globalThis, 'fetch', async () => { throw new Error('URL containing a secret'); });
  await assert.rejects(getFood(171077), error => error.status === 503 && !error.message.includes('secret'));
});

test('invalid searches and IDs never reach upstream', async () => {
  mock.method(globalThis, 'fetch', async () => assert.fail('fetch must not run'));
  await assert.rejects(getFood('../not-a-food'), error => error.status === 400);
  await assert.rejects(searchFoods({ query: '' }), error => error.status === 400);
  await assert.rejects(searchFoods({ query: 'rice', cookingState: 'fiction' }), error => error.status === 400);
});
