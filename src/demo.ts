import { mealTotals, type Ingredient, type Nutrients } from './domain';

type SampleItem = { name: string; quantity: number; unit: 'g' | 'ml'; totals: Nutrients; assumption: string };
type SampleMeal = { title: string; description: string; items: SampleItem[] };

// Illustrative authored values only. These are neither database records nor AI results.
// Kept outside journal storage, authentication, and provider requests.
export const sampleMeals: SampleMeal[] = [
  { title: 'Mie ayam + telur', description: '1 mangkuk mie ayam jamur dan 1 butir telur rebus', items: [
    { name: 'Mie ayam jamur', quantity: 350, unit: 'g', totals: { calories: 420, protein: 18, carbs: 54, fat: 14 }, assumption: 'Sample assumes a cooked 350 g bowl, including chicken, sauce, and oil. Your recipe may differ.' },
    { name: 'Telur rebus', quantity: 55, unit: 'g', totals: { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 }, assumption: 'Sample assumes 55 g of edible boiled egg, without the shell.' },
  ] },
  { title: 'Gado-gado + lontong', description: '1 piring gado-gado lontong saus kacang dan 1 butir telur', items: [
    { name: 'Sayuran rebus', quantity: 120, unit: 'g', totals: { calories: 45, protein: 2.5, carbs: 8, fat: 0.5 }, assumption: 'Illustrative cooked vegetable mix.' },
    { name: 'Lontong', quantity: 100, unit: 'g', totals: { calories: 140, protein: 2.8, carbs: 31, fat: 0.3 }, assumption: 'Sample uses 100 g cooked lontong.' },
    { name: 'Saus kacang', quantity: 60, unit: 'g', totals: { calories: 190, protein: 7.5, carbs: 11, fat: 13.8 }, assumption: 'Sample uses 60 g peanut sauce. Sugar, oil, and recipe vary.' },
    { name: 'Telur rebus', quantity: 55, unit: 'g', totals: { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 }, assumption: 'Sample assumes one edible boiled egg.' },
  ] },
  { title: 'Oat milk latte', description: '1 gelas caffe latte oat milk tanpa gula tambahan', items: [
    { name: 'Oat milk latte', quantity: 240, unit: 'ml', totals: { calories: 130, protein: 3.5, carbs: 16, fat: 5.5 }, assumption: 'Sample assumes a 240 mL drink with oat milk and no added sugar. Milk brand and recipe vary. Volume stays in mL.' },
  ] },
];

export function sampleIngredients(meal: SampleMeal, quantities: number[]): Ingredient[] {
  return meal.items.map((item, index) => {
    const quantity = quantities[index];
    const per100 = Object.fromEntries(Object.entries(item.totals).map(([key, value]) => [key, value / item.quantity * 100])) as Nutrients;
    return {
      id: `sample-${index}`, name: item.name, amount: quantity, unit: item.unit,
      grams: item.unit === 'g' ? quantity : null, milliliters: item.unit === 'ml' ? quantity : null,
      cookingState: item.unit === 'ml' ? 'as_sold' : 'cooked', preparation: '', assumptions: [item.assumption], clarification: null,
      food: { id: `sample-food-${index}`, name: item.name, cookingState: item.unit === 'ml' ? 'as_sold' : 'cooked',
        ...(item.unit === 'ml' ? { per100ml: per100 } : { per100g: per100 }),
        source: { name: 'Illustrative sample', id: `sample-${index}`, url: '', dataType: 'sample', description: 'Authored demonstration values; not retrieved or AI-generated.' },
      },
    };
  });
}

export function sampleTotals(meal: SampleMeal, quantities: number[]) {
  return mealTotals(sampleIngredients(meal, quantities));
}
