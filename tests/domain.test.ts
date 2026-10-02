import assert from 'node:assert/strict';
import test from 'node:test';
import { freshData, hasUnresolved, loadData, localDate, mealTotals, proteinFeedback, saveData, STORAGE_KEY, validateBackup, type Ingredient } from '../src/domain.ts';

const item: Ingredient = {
  id: 'chicken', name: 'Chicken breast', amount: 200, unit: 'g', grams: 200,
  cookingState: 'cooked', preparation: 'pan-fried', assumptions: [], clarification: null,
  food: {
    id: 'fdc-1', name: 'Chicken breast, cooked', cookingState: 'cooked',
    per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    source: { name: 'USDA FoodData Central', id: '1', url: 'https://fdc.nal.usda.gov/food-details/1/nutrients', description: 'Cooked chicken breast' },
  },
};

function backup() {
  return {
    ...freshData(),
    meals: [{ id: 'meal-1', date: '2026-10-01', title: 'Chicken and rice', items: [structuredClone(item)], checks: ['Check cooking oil.'], createdAt: '2026-10-01T08:00:00.000Z' }],
    targets: { calories: 2200, protein: 150 },
  };
}

test('calculates from stored per-100g nutrition and changes portions without parser guesses', () => {
  assert.deepEqual(mealTotals([item]), { calories: 330, protein: 62, carbs: 0, fat: 7.2 });
  const half = { ...item, amount: 100, grams: 100 };
  assert.deepEqual(mealTotals([half]), item.food!.per100g);
  assert.deepEqual(mealTotals([{ ...item, grams: null }, { ...item, food: null }]), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(hasUnresolved([item]), false);
  assert.equal(hasUnresolved([{ ...item, clarification: 'Was that raw or cooked weight?' }]), true);
  assert.deepEqual(mealTotals([{ ...item, clarification: 'Was that raw or cooked weight?' }]), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(hasUnresolved([{ ...item, grams: Number.NaN }]), true);
  assert.equal(hasUnresolved([]), true);
});

test('does not calculate or save mismatched raw, cooked, or as-sold weight states', () => {
  const packaged = {
    ...item.food!, cookingState: 'as_sold',
    source: { name: 'Package label', id: 'label-1', url: '', description: 'Package values', dataType: 'label' },
  };
  const mismatches: Ingredient[] = [
    { ...item, cookingState: 'raw' },
    { ...item, food: { ...item.food!, cookingState: 'raw' } },
    { ...item, food: packaged },
    { ...item, food: packaged, cookingState: 'unknown' },
    { ...item, food: packaged, cookingState: 'raw' },
  ];
  for (const mismatch of mismatches) {
    assert.equal(hasUnresolved([mismatch]), true);
    assert.deepEqual(mealTotals([mismatch]), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const data = backup();
    data.meals[0].items = [mismatch];
    assert.throws(() => validateBackup(data), /unresolved/);
  }
  const resolved: Ingredient = { ...item, food: packaged, cookingState: 'as_sold' };
  assert.equal(hasUnresolved([resolved]), false);
  assert.deepEqual(mealTotals([resolved]), mealTotals([item]));
  assert.deepEqual(mealTotals([item, ...mismatches]), mealTotals([item]));
});

test('uses the calendar date on the device, including midnight and leap day', () => {
  assert.equal(localDate(new Date(2026, 9, 1, 0, 1)), '2026-10-01');
  assert.equal(localDate(new Date(2024, 1, 29, 23, 59)), '2024-02-29');
  assert.throws(() => localDate(new Date('invalid')), /Invalid date/);
});

test('round-trips verified meals, templates, labels, and optional targets without aliasing', () => {
  const original = backup();
  const data = validateBackup({
    ...original,
    usualMeals: [{ id: 'usual-1', title: 'Usual chicken', items: [item], checks: [], createdAt: '2026-10-01T08:00:00.000Z' }],
    labels: [{ ...item.food!, id: 'label-1', source: { name: 'Package label', id: 'label-1', url: '', description: 'Per 100 g from my package', dataType: 'label' } }],
  });
  assert.equal(data.labels[0].source.dataType, 'label');
  assert.equal(data.usualMeals[0].items[0].grams, 200);
  data.meals[0].items[0].food!.per100g.protein = 10;
  assert.equal(original.meals[0].items[0].food!.per100g.protein, 31);
  assert.deepEqual(freshData(), { version: 1, meals: [], usualMeals: [], labels: [], targets: { calories: 0, protein: 0, carbs: 0, fat: 0 } });
});

test('personal targets remain editable and protein feedback follows sourced totals and actual targets', () => {
  const data = freshData();
  assert.deepEqual(data.targets, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  data.targets.protein = 150;
  assert.equal(freshData().targets.protein, 0);
  assert.deepEqual(validateBackup(freshData()), freshData());
  assert.equal(validateBackup(backup()).targets.protein, 150);
  assert.equal(validateBackup({ ...data, targets: {} }).targets.protein, undefined);
  const totals = mealTotals([item]);
  assert.match(proteinFeedback(totals.protein, 180), /118 g.*180 g/);
  assert.match(proteinFeedback(totals.protein, 150, 5), /5 g protein.*88 g.*150 g.*tempe/);
  assert.doesNotMatch(proteinFeedback(totals.protein, 150, totals.protein), /tambah/);
  assert.match(proteinFeedback(190, 180, 5), /tercapai/);
  assert.doesNotMatch(proteinFeedback(190, 180, 5), /tambah|-/);
  assert.doesNotMatch(proteinFeedback(190, 180, 5), /Ryann/);
  assert.equal(proteinFeedback(62, 0), '');
  assert.equal(proteinFeedback(62, undefined), '');
});

test('rejects invalid dates, amounts, unsourced values, unresolved items, and duplicate IDs', () => {
  const mutations: ((data: ReturnType<typeof backup>) => void)[] = [
    data => { data.meals[0].date = '2026-02-30'; },
    data => { data.meals[0].createdAt = '2026-10-01T24:00:00Z'; },
    data => { data.meals[0].items[0].grams = -1; },
    data => { data.meals[0].items[0].food!.per100g.calories = Number.POSITIVE_INFINITY; },
    data => { data.meals[0].items[0].food!.source.url = 'javascript:alert(1)'; },
    data => { data.meals[0].items[0].food!.source.url = ''; },
    data => { data.meals[0].items[0].food!.source.dataType = 'label'; },
    data => { data.meals[0].items[0].food!.cookingState = 'invented'; },
    data => { data.meals[0].items[0].food = null; },
    data => { data.meals[0].items.push(structuredClone(data.meals[0].items[0])); },
    data => { data.targets.protein = -1; },
  ];
  for (const mutate of mutations) {
    const data = backup();
    mutate(data);
    assert.throws(() => validateBackup(data), /Invalid backup/);
  }
});

test('refuses prototype pollution, accessors, and unknown fields such as raw descriptions', () => {
  const dangerous = JSON.parse(JSON.stringify(backup()));
  dangerous.meals[0].items[0].food.source.__proto__ = { polluted: true };
  assert.throws(() => validateBackup(dangerous), /plain object/);
  const injected = JSON.parse(JSON.stringify(backup()).replace('"version":1', '"version":1,"__proto__":{"polluted":true}'));
  assert.throws(() => validateBackup(injected), /unsupported field/);
  assert.throws(() => validateBackup({ ...backup(), rawDescription: 'I had chicken' }), /unsupported field/);
  const accessor = { ...backup() };
  Object.defineProperty(accessor, 'version', { get: () => 1 });
  assert.throws(() => validateBackup(accessor), /accessor/);
  const sparse = backup();
  sparse.meals[0].checks = Array(1);
  assert.throws(() => validateBackup(sparse), /complete entries/);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('storage validates before writing and preserves unreadable existing data', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.deepEqual(loadData(storage), freshData());
  saveData(backup(), storage);
  assert.deepEqual(loadData(storage), backup());
  assert.ok(values.has(STORAGE_KEY));
  values.set(STORAGE_KEY, '{broken');
  assert.throws(() => loadData(storage), /data has been preserved/);
  assert.equal(values.get(STORAGE_KEY), '{broken');
  const invalid = backup();
  invalid.meals[0].items[0].grams = null;
  assert.throws(() => saveData(invalid, storage), /Invalid backup/);
  assert.equal(values.get(STORAGE_KEY), '{broken');
  assert.throws(() => saveData(backup(), { setItem: () => { throw new Error('Quota exceeded'); } }), /export a backup/);
});
