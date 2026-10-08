import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleIngredients, sampleMeals, sampleTotals } from '../src/demo';

test('sample edits use journal nutrition math and preserve drinks in mL without database claims', () => {
  assert.equal(sampleTotals(sampleMeals[0], [350, 55]).calories, 498);
  assert.equal(sampleTotals(sampleMeals[0], [175, 55]).calories, 288);
  const latte = sampleMeals[2];
  assert.equal(sampleTotals(latte, [480]).calories, 260);
  const item = sampleIngredients(latte, [480])[0];
  assert.equal(item.grams, null); assert.equal(item.milliliters, 480);
  assert.ok(item.food?.per100ml); assert.equal(item.food?.source.dataType, 'sample');
  assert.equal(item.food?.source.url, '');
  assert.equal(latte.items[0].quantity, 240);
});
