const API_BASE = 'https://api.nal.usda.gov/fdc/v1';
const STATES = new Set(['raw', 'cooked', 'as_sold', 'unknown']);

class NutritionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, body) {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set('api_key', process.env.USDA_API_KEY?.trim() || 'DEMO_KEY');
  let response;
  try {
    response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new NutritionError(503, 'NUTRITION_UNAVAILABLE', 'FoodData Central could not be reached. Try again, or use a saved package label.');
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new NutritionError(429, 'NUTRITION_QUOTA', 'FoodData Central’s request limit has been reached. Try again later. Its shared DEMO_KEY allows only 30 requests/hour and 50/day; add your own free USDA_API_KEY for regular use.');
    }
    if ([401, 403].includes(response.status)) {
      throw new NutritionError(503, 'NUTRITION_KEY', 'FoodData Central rejected the API key. Check USDA_API_KEY in the server environment.');
    }
    if (response.status === 404) {
      throw new NutritionError(404, 'FOOD_NOT_FOUND', 'This FoodData Central record is no longer available. Search again or enter its package label.');
    }
    throw new NutritionError(503, 'NUTRITION_UNAVAILABLE', 'FoodData Central is temporarily unavailable. Try again, or use a saved package label.');
  }
  try {
    return await response.json();
  } catch {
    throw new NutritionError(502, 'NUTRITION_RESPONSE', 'FoodData Central returned an unreadable response. Please try again.');
  }
}

function inferCookingState(description, dataType) {
  if (/\b(raw|uncooked)\b/i.test(description)) return 'raw';
  if (/\b(cooked|baked|broiled|fried|boiled|roasted|grilled|stewed|poached|microwaved)\b/i.test(description)) return 'cooked';
  if (/\b(dry|dried|dehydrated)\b/i.test(description)) return 'raw';
  return dataType === 'Branded' ? 'as_sold' : 'unknown';
}

function nutrient(food, ids, unit) {
  for (const id of ids) {
    const entry = food.foodNutrients?.find(n => Number(n.nutrient?.id ?? n.nutrientId) === id
      && String(n.nutrient?.unitName ?? n.unitName).toLowerCase() === unit);
    const value = entry?.amount ?? entry?.value;
    // An explicitly reported zero is valid. Missing, null and string values are not zero.
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function normalizeFood(food) {
  if (!food || !Number.isSafeInteger(food.fdcId) || typeof food.description !== 'string') return null;
  if (!['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'].includes(food.dataType)) return null;
  // Branded entries can be standardized to 100 ml. Never apply those to a gram amount.
  if (food.dataType === 'Branded' && !['g', 'grm'].includes(String(food.servingSizeUnit).toLowerCase())) return null;
  const per100g = {
    calories: nutrient(food, [2048, 2047, 1008], 'kcal'),
    protein: nutrient(food, [1003], 'g'),
    carbs: nutrient(food, [1005], 'g'),
    fat: nutrient(food, [1004], 'g'),
  };
  if (Object.values(per100g).some(value => value === null)) return null;
  const portions = (food.foodPortions || []).flatMap(portion => {
    if (typeof portion.gramWeight !== 'number' || !Number.isFinite(portion.gramWeight) || portion.gramWeight <= 0) return [];
    const measure = portion.measureUnit?.name;
    const description = portion.portionDescription || [portion.amount, measure === 'undetermined' ? '' : measure, portion.modifier].filter(Boolean).join(' ');
    return description ? [{ description, grams: portion.gramWeight }] : [];
  });
  if (food.dataType === 'Branded' && typeof food.servingSize === 'number' && food.servingSize > 0) {
    portions.push({ description: food.householdServingFullText || '1 labeled serving', grams: food.servingSize });
  }
  const assumptions = ['Values apply to 100 g of the edible portion in the selected database preparation.'];
  const brand = food.brandName || food.brandOwner || null;
  if (food.dataType === 'Branded') assumptions.push('Manufacturer label data may be rounded. Confirm the brand and product match your package.');
  if (/\b(fried|sauteed|sautéed|with sauce|with oil|with butter)\b/i.test(food.description)) assumptions.push('This prepared-food record may already include cooking fat or sauce. Check before adding those separately.');
  return {
    id: String(food.fdcId),
    name: food.description,
    description: food.description,
    brand,
    cookingState: inferCookingState(food.description, food.dataType),
    per100g,
    portions,
    assumptions,
    source: {
      name: 'USDA FoodData Central',
      id: String(food.fdcId),
      url: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
      description: food.dataType === 'Branded' && brand ? `${food.description} — ${brand}` : food.description,
      dataType: food.dataType,
    },
  };
}

export async function searchFoods({ query, cookingState = 'unknown', brand = '' } = {}) {
  brand = brand ?? '';
  if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 200) {
    throw new NutritionError(400, 'INVALID_SEARCH', 'Enter a food name between 2 and 200 characters.');
  }
  if (typeof brand !== 'string' || brand.length > 100 || !STATES.has(cookingState)) {
    throw new NutritionError(400, 'INVALID_SEARCH', 'Choose a valid cooking state and a brand under 100 characters.');
  }
  const stateTerm = ['raw', 'cooked'].includes(cookingState) ? cookingState : '';
  const words = [brand.trim(), query.trim()].join(' ').match(/[\p{L}\p{N}]+/gu) || [];
  if (!words.length) throw new NutritionError(400, 'INVALID_SEARCH', 'Enter a food name.');
  const result = await request('foods/search', {
    // USDA otherwise treats unqualified words as OR, which can return unrelated foods.
    query: [...words.map(word => `+${word}`), stateTerm].filter(Boolean).join(' '),
    dataType: brand.trim() ? ['Branded'] : ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
    pageSize: 30,
  });
  if (!Array.isArray(result?.foods)) {
    throw new NutritionError(502, 'NUTRITION_RESPONSE', 'FoodData Central returned an unexpected response. Please try again.');
  }
  let records = result.foods;
  if (brand.trim() && records.length) {
    // Search results omit gram/ml basis; one batch details request verifies the basis.
    const ids = records.slice(0, 8).map(food => food.fdcId).filter(Number.isSafeInteger);
    records = ids.length ? await request('foods', { fdcIds: ids, format: 'full' }) : [];
    if (!Array.isArray(records)) throw new NutritionError(502, 'NUTRITION_RESPONSE', 'FoodData Central returned an unexpected response. Please try again.');
  }
  const candidates = records.map(normalizeFood).filter(Boolean).filter(food => {
    if (cookingState === 'cooked') return food.cookingState !== 'raw';
    if (cookingState === 'raw') return food.cookingState !== 'cooked';
    return true;
  });
  // USDA relevance is a shortlist, never proof of an exact food match. The user selects.
  return candidates.slice(0, 8);
}

export async function getFood(id) {
  if (!/^\d{1,10}$/.test(String(id))) {
    throw new NutritionError(400, 'INVALID_FOOD_ID', 'Choose a valid FoodData Central record.');
  }
  const food = normalizeFood(await request(`food/${id}`));
  if (!food) {
    throw new NutritionError(422, 'INCOMPLETE_NUTRITION', 'This record has incomplete calories or macros, or its gram basis is unconfirmed. Choose another record or enter the complete package label.');
  }
  return food;
}
