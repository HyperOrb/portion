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
  const foods = await searchFoods({ query: 'yogurt', brand: 'Example', cookingState: 'as_sold', source: 'usda' });
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
  await assert.rejects(searchFoods({ query: 'rice', source: 'https://untrusted.example' }), error => error.status === 400);
  await assert.rejects(searchFoods({ query: 'rice', name: {} }), error => error.status === 400);
});

// Models the public OFF product schema; these are test data, never runtime foods.
function packageRecord(overrides = {}) {
  return { code: '1234567890123', product_name: 'Test pilus', brands: 'Test brand', nutrition_data_per: '100g',
    serving_size: '1 portion (20 g)', product_quantity_unit: 'g', data_quality_errors_tags: [],
    nutriments: { 'energy-kcal_100g': 500, 'energy-kcal_unit': 'kcal', proteins_100g: 0, proteins_unit: 'g', carbohydrates_100g: 65, carbohydrates_unit: 'g', fat_100g: 30, fat_unit: 'g' }, ...overrides };
}

test('local snack names search OFF and verify complete gram-based package details', async () => {
  const calls = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(String(url));
    assert.match(options.headers['User-Agent'], /^Portion\//);
    if (String(url).includes('search.openfoodfacts.org')) {
      const body = JSON.parse(options.body);
      assert.equal(body.q, 'pilus');
      assert.doesNotMatch(body.q, /kacang|peanut/);
      assert.deepEqual(body.langs, ['id', 'en']);
      return Response.json({ hits: [{ code: '1234567890123' }, { code: '1234567890124' }] });
    }
    const product = packageRecord(String(url).includes('1234567890124') ? { code: '1234567890124', nutriments: {} } : {});
    return Response.json({ status: 1, product });
  });
  const foods = await searchFoods({ query: 'pilus tapioca snack', name: 'kacang pilus', cookingState: 'as_sold' });
  assert.equal(foods.length, 1);
  assert.equal(foods[0].id, 'off-1234567890123');
  assert.equal(foods[0].source.name, 'Open Food Facts');
  assert.equal(foods[0].cookingState, 'as_sold');
  assert.deepEqual(foods[0].per100g, { calories: 500, protein: 0, carbs: 65, fat: 30 });
  assert.deepEqual(foods[0].portions, [{ description: '1 portion (20 g)', grams: 20 }]);
  assert.match(foods[0].source.description, /Test brand/);
  assert.match(foods[0].source.url, /\/product\/1234567890123$/);
  assert.ok(calls.every(url => !url.includes('usda')));
  assert.equal((await getFood('off-1234567890123')).source.name, 'Open Food Facts');
});

test('OFF never supplies missing macros, guessed density, prepared-only data or invalid units', async () => {
  const valid = packageRecord();
  for (const overrides of [
    { nutrition_data_per: '100ml' }, { nutrition_data_per: undefined }, { product_quantity_unit: 'ml' },
    { nutrition_data_per: 'serving', serving_size: '1 cup (100 ml)' },
    { product_quantity_unit: undefined, serving_size: '' },
    { nutriments: { ...valid.nutriments, proteins_100g: null } },
    { nutriments: { ...valid.nutriments, proteins_100g: '0' } },
    { nutriments: { ...valid.nutriments, proteins_unit: 'mg' } },
    { nutriments: { ...valid.nutriments, 'energy-kcal_100g': undefined, 'energy-kcal_prepared_100g': 500 } },
    { data_quality_errors_tags: ['en:nutrition-value-over-1000'] },
  ]) {
    mock.method(globalThis, 'fetch', async () => Response.json({ status: 1, product: packageRecord(overrides) }));
    await assert.rejects(getFood('off-1234567890123'), error => error.status === 422);
  }
});

test('OFF empty coverage remains unresolved and errors do not expose provider details', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ hits: [] }));
  assert.deepEqual(await searchFoods({ query: 'basreng', source: 'openfoodfacts' }), []);
  mock.method(globalThis, 'fetch', async () => new Response('private provider body', { status: 429 }));
  await assert.rejects(searchFoods({ query: 'pilus', source: 'openfoodfacts' }), error => error.status === 429 && /Open Food Facts/.test(error.message) && !error.message.includes('private'));
});
