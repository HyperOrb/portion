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
  source: FoodSource;
  cookingState?: string;
} & ({ per100g: Nutrients; per100ml?: never } | { per100ml: Nutrients; per100g?: never });

export type Ingredient = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  grams: number | null;
  milliliters?: number | null;
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

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type FitnessGoal = 'fat_loss' | 'maintain' | 'muscle_gain';

export type UserProfile = {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
};

export const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,    // Jarang / tidak pernah olahraga
  light: 1.375,      // Ringan: 1-2x per minggu
  moderate: 1.55,    // Sedang: 3-5x per minggu
  active: 1.725,     // Rutin / berat: 6-7x per minggu
};

/** Mifflin-St Jeor BMR (Basal Metabolic Rate in kcal) */
export function calculateBmr(profile: Pick<UserProfile, 'gender' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return Math.round(profile.gender === 'male' ? base + 5 : base - 161);
}

/** TDEE (Total Daily Energy Expenditure in kcal) */
export function calculateTdee(profile: Pick<UserProfile, 'gender' | 'age' | 'heightCm' | 'weightKg' | 'activityLevel'>): number {
  const bmr = calculateBmr(profile);
  const mult = activityMultipliers[profile.activityLevel] ?? 1.2;
  return Math.round(bmr * mult);
}

/**
 * Calculates daily calorie and macronutrient targets based on user profile and fitness goal.
 * - Fat loss: ~450 kcal deficit (minimum 1200 kcal), 2.0g protein/kg bodyweight
 * - Maintenance: TDEE, 1.6g protein/kg
 * - Muscle gain: ~300 kcal lean surplus, 1.8g protein/kg
 * - Healthy fats: ~25% total calories (minimum 30g)
 * - Carbs: Remaining calories
 */
export function calculateNutritionTargets(profile: UserProfile): Nutrients {
  const tdee = calculateTdee(profile);
  let calories = tdee;
  if (profile.goal === 'fat_loss') {
    calories = Math.max(1200, Math.round(tdee - 450));
  } else if (profile.goal === 'muscle_gain') {
    calories = Math.round(tdee + 300);
  }

  const proteinFactor = profile.goal === 'fat_loss' ? 2.0 : profile.goal === 'muscle_gain' ? 1.8 : 1.6;
  const protein = Math.round(profile.weightKg * proteinFactor);
  const fat = Math.max(30, Math.round((calories * 0.25) / 9));
  const remainingCalories = calories - (protein * 4) - (fat * 9);
  const carbs = Math.max(50, Math.round(remainingCalories / 4));

  return { calories, protein, carbs, fat };
}

export type AppData = {
  version: 1;
  meals: Meal[];
  usualMeals: UsualMeal[];
  labels: NutritionFood[];
  targets: Partial<Nutrients>;
  profile?: UserProfile | null;
};

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

export const STORAGE_KEY = 'calorie-count-v1';
const nutrientKeys = ['calories', 'protein', 'carbs', 'fat'] as const;

export function freshData(): AppData {
  return { version: 1, meals: [], usualMeals: [], labels: [], targets: { calories: 0, protein: 0, carbs: 0, fat: 0 }, profile: null };
}

/** Friendly feedback uses sourced totals on this device, without another AI request. */
export function proteinFeedback(consumed: number, target: number | undefined, mealProtein?: number): string {
  if (!target) return '';
  const format = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  if (consumed >= target) return `Target ${format(target)} g protein sudah tercapai. Mantap!`;
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

export function nutritionUnit(food: NutritionFood): 'g' | 'ml' { return food.per100ml ? 'ml' : 'g'; }
export function nutritionValues(food: NutritionFood): Nutrients { return food.per100ml ?? food.per100g!; }
export function ingredientQuantity(item: Ingredient): number | null {
  return item.food?.per100ml ? item.milliliters ?? null : item.grams;
}

/** Scale stored database, label, or explicitly identified AI values in their native basis. */
export function mealTotals(items: Ingredient[]): Nutrients {
  const totals: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) {
    if (!item.food || unresolvedIngredient(item)) continue;
    for (const key of nutrientKeys) totals[key] += nutritionValues(item.food)[key] * ingredientQuantity(item)! / 100;
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
  const quantity = ingredientQuantity(item);
  return !item.food || quantity === null || !Number.isFinite(quantity) || quantity <= 0
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
  const data = object(value, path, ['id', 'name', 'per100g', 'per100ml', 'source', 'cookingState']);
  const source = object(data.source, `${path}.source`, ['name', 'id', 'url', 'description', 'dataType']);
  const name = string(source.name, `${path}.source.name`);
  const url = string(source.url, `${path}.source.url`, true);
  const aiEstimate = name === 'Gemini AI estimate' || name === 'Claude AI estimate';
  if (name === 'Package label' && (url !== '' || source.dataType !== 'label')) invalid(`${path}.source`, 'must identify package-label data');
  if (source.dataType === 'label' && name !== 'Package label') invalid(`${path}.source`, 'must identify package-label data');
  if ((source.dataType === 'ai_estimate' || aiEstimate) && (!aiEstimate || source.dataType !== 'ai_estimate' || url !== '')) invalid(`${path}.source`, 'must identify an unverified AI estimate');
  if (url) {
    try {
      if (!['https:', 'http:'].includes(new URL(url).protocol)) invalid(`${path}.source.url`, 'must be an HTTP or HTTPS link');
    } catch {
      invalid(`${path}.source.url`, 'must be an HTTP or HTTPS link');
    }
  } else if (name !== 'Package label' && !aiEstimate) {
    invalid(`${path}.source.url`, 'must identify the nutrition source');
  }
  if (Object.hasOwn(data, 'per100g') === Object.hasOwn(data, 'per100ml')) invalid(path, 'must use exactly one nutrition basis');
  const basis = Object.hasOwn(data, 'per100ml') ? { per100ml: nutrients(data.per100ml, `${path}.per100ml`) } : { per100g: nutrients(data.per100g, `${path}.per100g`) };
  const result: NutritionFood = {
    id: string(data.id, `${path}.id`, false, 500),
    name: string(data.name, `${path}.name`),
    ...basis,
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
  const data = object(value, path, ['id', 'name', 'amount', 'unit', 'grams', 'milliliters', 'cookingState', 'preparation', 'brand', 'query', 'assumptions', 'clarification', 'food']);
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
  if (data.milliliters !== undefined) result.milliliters = data.milliliters === null ? null : number(data.milliliters, `${path}.milliliters`, true);
  if (result.grams !== null && result.milliliters != null) invalid(path, 'must not mix gram and mL portions');
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

function userProfile(value: unknown, path: string): UserProfile {
  const data = object(value, path, ['gender', 'age', 'heightCm', 'weightKg', 'activityLevel', 'goal']);
  const gender = string(data.gender, `${path}.gender`);
  if (gender !== 'male' && gender !== 'female') invalid(`${path}.gender`, 'must be male or female');
  const age = number(data.age, `${path}.age`, true, 120);
  if (age < 10) invalid(`${path}.age`, 'must be at least 10');
  const heightCm = number(data.heightCm, `${path}.heightCm`, true, 250);
  if (heightCm < 50) invalid(`${path}.heightCm`, 'must be at least 50 cm');
  const weightKg = number(data.weightKg, `${path}.weightKg`, true, 350);
  if (weightKg < 20) invalid(`${path}.weightKg`, 'must be at least 20 kg');
  const activityLevel = string(data.activityLevel, `${path}.activityLevel`);
  if (!['sedentary', 'light', 'moderate', 'active'].includes(activityLevel)) invalid(`${path}.activityLevel`, 'is invalid');
  const goal = string(data.goal, `${path}.goal`);
  if (!['fat_loss', 'maintain', 'muscle_gain'].includes(goal)) invalid(`${path}.goal`, 'is invalid');
  return {
    gender: gender as Gender,
    age: Math.round(age),
    heightCm: Math.round(heightCm * 10) / 10,
    weightKg: Math.round(weightKg * 10) / 10,
    activityLevel: activityLevel as ActivityLevel,
    goal: goal as FitnessGoal,
  };
}

/** Validates and copies every field. Unknown fields (including raw meal text) are refused. */
export function validateBackup(input: unknown): AppData {
  const data = object(input, 'backup', ['version', 'meals', 'usualMeals', 'labels', 'targets', 'profile']);
  if (data.version !== 1) invalid('version', 'is unsupported');
  const targetData = object(data.targets, 'targets', nutrientKeys);
  const targets: Partial<Nutrients> = {};
  for (const key of nutrientKeys) if (Object.hasOwn(targetData, key)) targets[key] = number(targetData[key], `targets.${key}`, false, 1_000_000);
  const labels = unique(array(data.labels, 'labels', food, 10_000), 'labels');
  for (const label of labels) {
    if (label.source.name !== 'Package label' || label.source.url !== '' || label.source.dataType !== 'label') invalid('labels', 'must contain package-label nutrition');
  }
  let profile: UserProfile | null = null;
  if (data.profile !== undefined && data.profile !== null) {
    profile = userProfile(data.profile, 'profile');
  }
  return {
    version: 1,
    meals: unique(array(data.meals, 'meals', (value, path) => usualMeal(value, path, true) as Meal), 'meals'),
    usualMeals: unique(array(data.usualMeals, 'usualMeals', (value, path) => usualMeal(value, path) as UsualMeal, 10_000), 'usualMeals'),
    labels,
    targets,
    profile,
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
