export type Nutrients = { calories: number; protein: number; carbs: number; fat: number };

export type FoodSource = {
  name: string;
  id: string;
  url: string;
  description: string;
  dataType?: string;
};

export type NutritionFood = {
  id: string;
  name: string;
  per100g: Nutrients;
  source: FoodSource;
  cookingState?: string;
};

export type Ingredient = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  grams: number | null;
  cookingState: 'raw' | 'cooked' | 'as_sold' | 'unknown';
  preparation: string;
  brand?: string | null;
  query?: string;
  assumptions: string[];
  clarification?: string | null;
  food: NutritionFood | null;
};

export type Meal = {
  id: string;
  date: string;
  title: string;
  items: Ingredient[];
  checks: string[];
  createdAt: string;
};

export type UsualMeal = Omit<Meal, 'date'>;
export type LabelFood = NutritionFood;
export type AppData = {
  version: 1;
  meals: Meal[];
  usualMeals: UsualMeal[];
  labels: NutritionFood[];
  targets: Partial<Nutrients>;
};

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

export const STORAGE_KEY = 'calorie-count-v1';
export const RYANN_TARGETS: Readonly<Nutrients> = Object.freeze({ calories: 2600, protein: 180, carbs: 290, fat: 80 });
const nutrientKeys = ['calories', 'protein', 'carbs', 'fat'] as const;

export function freshData(): AppData {
  return { version: 1, meals: [], usualMeals: [], labels: [], targets: { ...RYANN_TARGETS } };
}

/** Friendly feedback uses sourced totals on this device, without another AI request. */
export function proteinFeedback(consumed: number, target: number | undefined, mealProtein?: number): string {
  if (!target) return '';
  const format = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  if (consumed >= target) return `Target ${format(target)} g protein sudah tercapai. Mantap, Ryann!`;
  const balance = `Masih ${format(target - consumed)} g menuju target ${format(target)} g protein.`;
  // ponytail: a simple <20 g meal nudge, not an individualized meal plan.
  if (mealProtein !== undefined && mealProtein < 20) return `Meal ini punya ${format(mealProtein)} g protein. ${balance} Kalau cocok, bisa tambah telur, tempe, dada ayam, atau whey; log juga tambahannya ya.`;
  return `${balance} Pelan-pelan, satu meal at a time.`;
}

/** Calendar date on the device; deliberately does not use UTC conversion. */
export function localDate(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date.');
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

/** Totals use the selected underlying database/label values, never parser guesses. */
export function mealTotals(items: Ingredient[]): Nutrients {
  const totals: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) {
    if (!item.food || item.grams === null || unresolvedIngredient(item)) continue;
    for (const key of nutrientKeys) totals[key] += item.food.per100g[key] * item.grams / 100;
  }
  return totals;
}

export function hasUnresolved(items: Ingredient[]): boolean {
  return items.length === 0 || items.some(unresolvedIngredient);
}

function unresolvedIngredient(item: Ingredient): boolean {
  const sourceState = item.food?.source.name === 'Package label' ? 'as_sold' : item.food?.cookingState;
  const weightMismatch = sourceState === 'as_sold' && item.cookingState !== 'as_sold'
    || sourceState === 'raw' && item.cookingState === 'cooked'
    || sourceState === 'cooked' && item.cookingState === 'raw';
  return !item.food || item.grams === null || !Number.isFinite(item.grams) || item.grams <= 0
    || Boolean(item.clarification?.trim()) || weightMismatch;
}

function invalid(path: string, reason: string): never {
  throw new Error(`Invalid backup: ${path} ${reason}.`);
}

function object(value: unknown, path: string, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'must be an object');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(path, 'must be a plain object');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) invalid(path, 'contains an unsupported field');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) invalid(path, 'contains an accessor');
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, empty = false, max = 2000): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) invalid(path, 'must be valid text');
  return value;
}

function number(value: unknown, path: string, positive = false, max = 1_000_000_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0) || value > max) invalid(path, 'must be a finite valid amount');
  return value;
}

function array<T>(value: unknown, path: string, read: (value: unknown, path: string) => T, max = 100_000): T[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) invalid(path, 'must be a valid list');
  const result: T[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) invalid(path, 'must contain plain, complete entries');
    result.push(read(descriptor.value, `${path}[${index}]`));
  }
  return result;
}

function texts(value: unknown, path: string): string[] {
  return array(value, path, (text, location) => string(text, location), 100);
}

function nutrients(value: unknown, path: string): Nutrients {
  const data = object(value, path, nutrientKeys);
  return {
    calories: number(data.calories, `${path}.calories`, false, 10_000),
    protein: number(data.protein, `${path}.protein`, false, 1_000),
    carbs: number(data.carbs, `${path}.carbs`, false, 1_000),
    fat: number(data.fat, `${path}.fat`, false, 1_000),
  };
}

function food(value: unknown, path: string): NutritionFood {
  const data = object(value, path, ['id', 'name', 'per100g', 'source', 'cookingState']);
  const source = object(data.source, `${path}.source`, ['name', 'id', 'url', 'description', 'dataType']);
  const name = string(source.name, `${path}.source.name`);
  const url = string(source.url, `${path}.source.url`, true);
  if (name === 'Package label' && (url !== '' || source.dataType !== 'label')) invalid(`${path}.source`, 'must identify package-label data');
  if (source.dataType === 'label' && name !== 'Package label') invalid(`${path}.source`, 'must identify package-label data');
  if (url) {
    try {
      if (!['https:', 'http:'].includes(new URL(url).protocol)) invalid(`${path}.source.url`, 'must be an HTTP or HTTPS link');
    } catch {
      invalid(`${path}.source.url`, 'must be an HTTP or HTTPS link');
    }
  } else if (name !== 'Package label') {
    invalid(`${path}.source.url`, 'must identify the nutrition source');
  }
  const result: NutritionFood = {
    id: string(data.id, `${path}.id`, false, 500),
    name: string(data.name, `${path}.name`),
    per100g: nutrients(data.per100g, `${path}.per100g`),
    source: { name, id: string(source.id, `${path}.source.id`, false, 500), url, description: string(source.description, `${path}.source.description`, true) },
  };
  if (source.dataType !== undefined) result.source.dataType = string(source.dataType, `${path}.source.dataType`);
  if (data.cookingState !== undefined) {
    if (!['raw', 'cooked', 'as_sold', 'unknown'].includes(data.cookingState as string)) invalid(`${path}.cookingState`, 'is unsupported');
    result.cookingState = data.cookingState as string;
  }
  return result;
}

function ingredient(value: unknown, path: string): Ingredient {
  const data = object(value, path, ['id', 'name', 'amount', 'unit', 'grams', 'cookingState', 'preparation', 'brand', 'query', 'assumptions', 'clarification', 'food']);
  if (!['raw', 'cooked', 'as_sold', 'unknown'].includes(data.cookingState as string)) invalid(`${path}.cookingState`, 'is unsupported');
  const result: Ingredient = {
    id: string(data.id, `${path}.id`, false, 500),
    name: string(data.name, `${path}.name`),
    amount: number(data.amount, `${path}.amount`, true),
    unit: string(data.unit, `${path}.unit`),
    grams: data.grams === null ? null : number(data.grams, `${path}.grams`, true),
    cookingState: data.cookingState as Ingredient['cookingState'],
    preparation: string(data.preparation, `${path}.preparation`, true),
    assumptions: texts(data.assumptions, `${path}.assumptions`),
    food: data.food === null ? null : food(data.food, `${path}.food`),
  };
  if (data.brand !== undefined) result.brand = data.brand === null ? null : string(data.brand, `${path}.brand`, true);
  if (data.query !== undefined) result.query = string(data.query, `${path}.query`, true);
  if (data.clarification !== undefined) result.clarification = data.clarification === null ? null : string(data.clarification, `${path}.clarification`, true);
  return result;
}

function unique<T extends { id: string }>(items: T[], path: string): T[] {
  if (new Set(items.map(item => item.id)).size !== items.length) invalid(path, 'contains duplicate IDs');
  return items;
}

function calendarDate(value: unknown, path: string): string {
  const text = string(value, path, false, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) invalid(path, 'must be a calendar date');
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(`${text}T12:00:00Z`);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) invalid(path, 'must be a calendar date');
  return text;
}

function usualMeal(value: unknown, path: string, dated = false): UsualMeal | Meal {
  const data = object(value, path, ['id', 'title', 'items', 'checks', 'createdAt', ...(dated ? ['date'] : [])]);
  const items = unique(array(data.items, `${path}.items`, ingredient, 500), `${path}.items`);
  if (!items.length || hasUnresolved(items)) invalid(`${path}.items`, 'contains an unresolved food, weight, or clarification');
  const createdAt = string(data.createdAt, `${path}.createdAt`, false, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(createdAt) || !Number.isFinite(Date.parse(createdAt))) invalid(`${path}.createdAt`, 'must be an ISO timestamp');
  const [hour, minute, second] = createdAt.slice(11, 19).split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59) invalid(`${path}.createdAt`, 'must be an ISO timestamp');
  calendarDate(createdAt.slice(0, 10), `${path}.createdAt`);
  const result: UsualMeal = {
    id: string(data.id, `${path}.id`, false, 500),
    title: string(data.title, `${path}.title`),
    items,
    checks: texts(data.checks, `${path}.checks`),
    createdAt,
  };
  return dated ? { ...result, date: calendarDate(data.date, `${path}.date`) } : result;
}

/** Validates and copies every field. Unknown fields (including raw meal text) are refused. */
export function validateBackup(input: unknown): AppData {
  const data = object(input, 'backup', ['version', 'meals', 'usualMeals', 'labels', 'targets']);
  if (data.version !== 1) invalid('version', 'is unsupported');
  const targetData = object(data.targets, 'targets', nutrientKeys);
  const targets: Partial<Nutrients> = {};
  for (const key of nutrientKeys) if (Object.hasOwn(targetData, key)) targets[key] = number(targetData[key], `targets.${key}`, true, 1_000_000);
  const labels = unique(array(data.labels, 'labels', food, 10_000), 'labels');
  for (const label of labels) {
    if (label.source.name !== 'Package label' || label.source.url !== '' || label.source.dataType !== 'label') invalid('labels', 'must contain package-label nutrition');
  }
  return {
    version: 1,
    meals: unique(array(data.meals, 'meals', (value, path) => usualMeal(value, path, true) as Meal), 'meals'),
    usualMeals: unique(array(data.usualMeals, 'usualMeals', (value, path) => usualMeal(value, path) as UsualMeal, 10_000), 'usualMeals'),
    labels,
    targets,
  };
}

function deviceStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    throw new Error('Device storage is unavailable. Allow browser storage to save your food log.');
  }
}

export function loadData(storage: StorageReader | undefined = deviceStorage()): AppData {
  if (!storage) return freshData();
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    throw new Error('Your food log could not be read from this device.');
  }
  if (text === null) return freshData();
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    // Preserve the original bytes; never overwrite a corrupt log with an empty one.
    throw new Error('The food log on this device could not be read. Its data has been preserved; restore a valid backup to recover.');
  }
}

export function saveData(data: AppData, storage: StorageWriter | undefined = deviceStorage()): void {
  const validated = validateBackup(data);
  if (!storage) throw new Error('Device storage is unavailable. Your food log was not saved.');
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(validated));
  } catch {
    throw new Error('Your food log could not be saved. Browser storage may be full or unavailable; export a backup before closing the app.');
  }
}
