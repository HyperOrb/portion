import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppData, Ingredient, Meal, NutritionFood, Nutrients } from './domain';
import { hasUnresolved, mealTotals } from './domain';
import { api, Icon, MacroLine, Modal, newId, number, nutrientKeys, nutrientNames, ProteinNote } from './ui';

type RichFood = NutritionFood & { portions?: { description: string; grams: number }[]; assumptions?: string[] };
const newItem = (): Ingredient => ({ id: newId(), name: '', amount: 100, unit: 'g', grams: 100, cookingState: 'unknown', preparation: '', brand: null, query: '', assumptions: [], clarification: null, food: null });

export function LabelForm({ initialName = '', onSave, onClose }: { initialName?: string; onSave: (food: NutritionFood) => Promise<boolean>; onClose: () => void }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return <Modal title="Save a package label" onClose={onClose}>
    <p className="muted">Enter the values exactly as printed on your package. This food will be available next time.</p>
    <form onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name')).trim();
      const servingGrams = Number(form.get('servingGrams'));
      const values = Object.fromEntries(nutrientKeys.map(key => [key, Number(form.get(key))]));
      if (!name || !Number.isFinite(servingGrams) || servingGrams <= 0 || servingGrams > 10000 || nutrientKeys.some(key => !Number.isFinite(values[key]) || values[key] < 0 || values[key] > 100000)) { setError('Enter a food name, a positive serving weight, and all four nutrition values.'); return; }
      if (values.calories / servingGrams * 100 > 10000 || ['protein', 'carbs', 'fat'].some(key => values[key] / servingGrams * 100 > 1000)) { setError('Check the serving weight and label values; the values per 100 g are too large.'); return; }
      const label: NutritionFood = {
        id: `label-${newId()}`, name,
        per100g: { calories: values.calories / servingGrams * 100, protein: values.protein / servingGrams * 100, carbs: values.carbs / servingGrams * 100, fat: values.fat / servingGrams * 100 },
        cookingState: 'as_sold',
        source: { name: 'Package label', id: newId(), url: '', description: `Your package: per ${servingGrams} g — ${values.calories} kcal, ${values.protein} g protein, ${values.carbs} g carbs, ${values.fat} g fat.`, dataType: 'label' },
      };
      setSaving(true);
      try { if (await onSave(label)) onClose(); else setError('The label could not be saved. Check the journal connection and try again.'); }
      catch { setError('The label could not be saved. Try again.'); }
      finally { setSaving(false); }
    }}>
      <label>Food and brand<input name="name" defaultValue={initialName} placeholder="e.g. My brand chocolate whey" required maxLength={160} /></label>
      <label>Serving weight on label (g)<input name="servingGrams" type="number" inputMode="decimal" min="0.01" max="10000" step="any" defaultValue="100" required /></label>
      <div className="form-grid">{nutrientKeys.map(key => <label key={key}>{nutrientNames[key]} ({key === 'calories' ? 'kcal' : 'g'})<input name={key} type="number" inputMode="decimal" min="0" max="100000" step="any" required /></label>)}</div>
      <p className="small muted">A volume-only label needs a measured serving weight in grams. We won’t assume that 1 ml equals 1 g.</p>
      {error && <p role="alert" className="error-message">{error}</p>}
      <button disabled={saving} className="button primary full" type="submit"><Icon name="bookmark" />{saving ? 'Saving…' : 'Save label'}</button>
    </form>
  </Modal>;
}

function IngredientEditor({ item, labels, onChange, onRemove, onLabel }: { item: Ingredient; labels: NutritionFood[]; onChange: (item: Ingredient) => void; onRemove: () => void; onLabel: (label: NutritionFood) => Promise<boolean> }) {
  const [query, setQuery] = useState(item.query || item.name);
  const [searchSource, setSearchSource] = useState<'auto' | 'usda' | 'openfoodfacts'>('auto');
  const [foods, setFoods] = useState<RichFood[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showLabel, setShowLabel] = useState(false);
  const [details, setDetails] = useState<RichFood | null>(item.food);
  const [showSearch, setShowSearch] = useState(!item.food);

  async function search() {
    if (!query.trim()) { setError('Enter a food or brand to search.'); return; }
    setBusy(true); setError(''); setShowSearch(true);
    try {
      const result = await api<{ foods: RichFood[] }>('/api/foods/search', { query: query.trim(), name: query === (item.query || item.name) ? item.name : query.trim(), cookingState: item.cookingState, brand: item.brand, source: searchSource });
      setFoods(result.foods); setSearched(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  // One initial lookup; edits only search when requested to conserve provider quotas.
  useEffect(() => { if (!item.food && !item.clarification && item.name) void search(); }, []);

  async function selectFood(food: RichFood) {
    setBusy(true); setError('');
    try {
      const chosen = food.source.dataType === 'label' ? food : (await api<{ food: RichFood }>(`/api/foods/${encodeURIComponent(food.id)}`)).food;
      if ((item.cookingState === 'raw' && chosen.cookingState === 'cooked') || (item.cookingState === 'cooked' && chosen.cookingState === 'raw')) {
        throw new Error('This record uses a different cooking state. Choose a matching record or correct the weight state first.');
      }
      if (chosen.cookingState === 'as_sold' && item.cookingState !== 'as_sold') throw new Error('Package nutrition applies to food as sold. Choose “As packaged” only if this gram weight was measured in that state; otherwise use a matching cooked record.');
      setDetails(chosen);
      const persisted: NutritionFood = { id: chosen.id, name: chosen.name, per100g: chosen.per100g, source: chosen.source, cookingState: chosen.cookingState };
      onChange({ ...item, name: item.name.trim() || chosen.name, food: persisted, assumptions: [...new Set([...item.assumptions, ...(chosen.assumptions || [])])], cookingState: item.cookingState === 'unknown' && ['raw', 'cooked', 'as_sold'].includes(chosen.cookingState || '') ? chosen.cookingState as Ingredient['cookingState'] : item.cookingState });
      setShowSearch(false);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  const totals = mealTotals([item]);
  return <article className="ingredient-card"><fieldset disabled={busy} className="ingredient-fieldset">
    <div className="ingredient-top"><label className="food-name">Food<input aria-label="Food name" value={item.name} maxLength={160} onChange={event => {
      const name = event.target.value; setQuery(name); setFoods([]); setSearched(false); setShowSearch(true); setDetails(null);
      onChange({ ...item, name, query: name, brand: null, food: null, clarification: item.cookingState === 'unknown' && /chicken|beef|pork|turkey|meat|fish|salmon|rice|pasta|lentil|bean/i.test(name) ? `Was the ${name} weighed raw/dry or cooked?` : null });
    }} /></label><button className="icon-button" onClick={onRemove} aria-label={`Remove ${item.name || 'ingredient'}`}><Icon name="close" /></button></div>
    {item.clarification && <div className="notice"><Icon name="info" /><p>{item.clarification} <strong>Choose the weight state below.</strong></p></div>}
    <div className="form-grid ingredient-fields">
      <label>Edible weight (g)<input type="number" inputMode="decimal" min="0.01" max="100000" step="any" value={item.grams ?? ''} placeholder="Enter grams" onChange={event => {
        const grams = event.target.value === '' ? null : Number(event.target.value);
        onChange({ ...item, grams, amount: grams ?? item.amount, unit: grams === null ? item.unit : 'g' });
      }} /></label>
      <label>Weight state<select value={item.cookingState} onChange={event => {
        setFoods([]); setSearched(false); setShowSearch(true); setDetails(null);
        const state = event.target.value as Ingredient['cookingState'];
        onChange({ ...item, cookingState: state, clarification: state === 'unknown' ? item.clarification || (/chicken|beef|pork|turkey|meat|fish|salmon|rice|pasta|lentil|bean/i.test(item.name) ? `Was the ${item.name} weighed raw/dry or cooked?` : null) : null, food: null, assumptions: item.assumptions.filter(text => !/raw|cooked/i.test(text)) });
      }}><option value="unknown">Not specified</option><option value="raw">Weighed raw</option><option value="cooked">Weighed cooked</option><option value="as_sold">As packaged</option></select></label>
    </div>
    {item.grams === null && <p className="small warning-text">Described as {number(item.amount)} {item.unit}. We need grams or a database serving weight to calculate nutrition.</p>}
    <label>Brand (optional)<input value={item.brand || ''} placeholder="Leave blank for a generic food" maxLength={100} onChange={event => { onChange({ ...item, brand: event.target.value || null, food: null }); setShowSearch(true); setFoods([]); setSearched(false); setDetails(null); }} /></label>
    <label>Preparation or cooking details<input value={item.preparation} placeholder="e.g. pan-fried, skin removed" maxLength={300} onChange={event => { onChange({ ...item, preparation: event.target.value, food: null }); setShowSearch(true); setDetails(null); }} /></label>
    {item.food && <div className="source-block">
      <div className="source-title"><span className="badge"><Icon name="check" size={13} />Source selected</span><button className="text-button" onClick={() => setShowSearch(!showSearch)}>Change</button></div>
      <p><strong>{item.food.name}</strong></p>
      <p className="small muted">{item.food.source.url ? <a href={item.food.source.url} target="_blank" rel="noreferrer">{item.food.source.name} · {item.food.source.id}</a> : item.food.source.name} · {item.food.source.dataType}</p>
      <p className="small muted">Per 100 g: {number(item.food.per100g.calories)} kcal · P {number(item.food.per100g.protein)} g · C {number(item.food.per100g.carbs)} g · F {number(item.food.per100g.fat)} g</p>
      <details><summary>Source details & assumptions</summary><p className="small muted">{item.food.source.description}</p>{details?.assumptions?.map((text, index) => <p className="small muted" key={index}>{text}</p>)}</details>
      {!!details?.portions?.length && <label className="portion-select">Or use a source serving weight<select value="" onChange={event => {
        const portion = details.portions?.[Number(event.target.value)];
        if (portion) onChange({ ...item, grams: portion.grams, amount: portion.grams, unit: 'g', assumptions: [...item.assumptions.filter(a => !a.startsWith('USDA serving:') && !a.startsWith('Source serving:')), `Source serving: ${portion.description} = ${portion.grams} g.`] });
      }}><option value="">Choose one serving…</option>{details.portions.map((portion, index) => <option value={index} key={index}>{portion.description} ({portion.grams} g)</option>)}</select></label>}
      {item.grams !== null && <div className="ingredient-total"><strong>{number(totals.calories)} <span className="small">kcal</span></strong><MacroLine totals={totals} /></div>}
    </div>}
    {showSearch && <div className="food-search">
      <p className="small"><strong>{item.food ? 'Choose another source' : 'Choose a nutrition match'}</strong> <span className="muted">Check the food, brand, and preparation.</span></p>
      <label>Nutrition database<select value={searchSource} onChange={event => { setSearchSource(event.target.value as typeof searchSource); setFoods([]); setSearched(false); setError(''); }}><option value="auto">Automatic — everyday or packaged foods</option><option value="usda">USDA — everyday ingredients</option><option value="openfoodfacts">Open Food Facts — packaged & local snacks</option></select></label>
      <form className="search-row" onSubmit={event => { event.preventDefault(); void search(); }}><input aria-label={`Search nutrition for ${item.name}`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Food name or exact product…" maxLength={160} /><button className="button secondary" disabled={busy || !!item.clarification} title={item.clarification ? 'Answer the weight question first' : undefined}><Icon name="search" />{busy ? 'Searching…' : 'Search'}</button></form>
      {labels.length > 0 && <label>Saved package label<select value="" onChange={event => { const food = labels.find(label => label.id === event.target.value); if (food) void selectFood(food); }}><option value="">Choose your saved food…</option>{labels.map(food => <option value={food.id} key={food.id}>{food.name}</option>)}</select></label>}
      {foods.length > 0 && <div className="candidates">{foods.map(food => <button className="candidate" key={food.id} disabled={busy} onClick={() => void selectFood(food)}><span><strong>{food.name}</strong><small>{food.source.name} · {food.source.description !== food.name ? `${food.source.description} · ` : ''}{number(food.per100g.calories)} kcal / 100 g · {food.cookingState === 'unknown' ? 'check preparation' : food.cookingState?.replace('_', ' ')}</small></span><Icon name="plus" size={18} /></button>)}</div>}
      {searched && foods.length === 0 && <p className="small warning-text">No complete nutrition match for “{item.name || query}” yet. Try the exact brand or flavor, choose another database, or save its package label once for reuse.</p>}
      <button className="text-button label-action" onClick={() => setShowLabel(true)}>No reliable match? Enter a package label <Icon name="plus" size={14} /></button>
    </div>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {item.assumptions.length > 0 && <div className="assumptions"><span className="small muted">Assumptions to check</span>{item.assumptions.map((text, index) => <p className="small" key={index}>{text}</p>)}</div>}
    </fieldset>{showLabel && <LabelForm initialName={item.name} onClose={() => setShowLabel(false)} onSave={async food => {
      if (!await onLabel(food)) return false;
      if (item.cookingState !== 'as_sold') { setError('Label saved. Confirm “As packaged” and the corresponding measured gram weight, then select it from your saved labels.'); return true; }
      setDetails(food); setShowSearch(false); onChange({ ...item, name: item.name.trim() || food.name, food, clarification: null }); return true;
    }} />}
  </article>;
}

export default function MealEditor({ cloudMode, draft, labels, mode, targets, dayTotals, onChange, onCancel, onSave, onLabel }: { cloudMode: boolean; draft: Meal; labels: NutritionFood[]; mode: 'meal' | 'usual'; targets: AppData['targets']; dayTotals: Nutrients; onChange: Dispatch<SetStateAction<Meal | null>>; onCancel: () => void; onSave: () => Promise<void>; onLabel: (food: NutritionFood) => Promise<boolean> }) {
  const totals = mealTotals(draft.items);
  const unresolved = hasUnresolved(draft.items);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, []);
  return <div className="review-layout">
    <div><button className="text-button back-button" onClick={onCancel}><Icon name="left" size={16} />Back to journal</button><p className="eyebrow">A quick check before you save</p><h1>{mode === 'usual' ? 'Edit your usual meal.' : 'Review your meal.'}</h1><p className="muted">Choose the food records that fit. Every total comes from your selected sources.</p></div>
    <div className="review-grid"><div className="review-items">
      <section className="panel meal-details"><label>Meal name<input value={draft.title} maxLength={160} onChange={event => { const title = event.target.value; onChange(current => current ? { ...current, title } : null); }} /></label>{mode === 'meal' && <label>Log date<input type="date" value={draft.date} onChange={event => { const date = event.target.value; if (date) onChange(current => current ? { ...current, date } : null); }} /></label>}</section>
      {draft.items.map(item => <IngredientEditor key={item.id} item={item} labels={labels} onChange={updated => onChange(current => current ? { ...current, items: current.items.map(existing => existing.id === item.id ? updated : existing) } : null)} onRemove={() => onChange(current => current ? { ...current, items: current.items.filter(existing => existing.id !== item.id) } : null)} onLabel={onLabel} />)}
      <button className="button secondary full" onClick={() => { const item = newItem(); onChange(current => current ? { ...current, items: [...current.items, item] } : null); }}><Icon name="plus" />Add a food or extra</button>
    </div><aside className="review-sidebar">
      <section className="panel review-summary"><p className="eyebrow">{unresolved ? 'Sourced subtotal' : 'Meal estimate'}</p><div className="review-calories">{number(totals.calories)}<span>kcal</span></div><div className="review-macros">{(['protein', 'carbs', 'fat'] as const).map(key => <div key={key}><span><i className={`dot ${key}`} />{nutrientNames[key]}</span><strong>{number(totals[key])} g</strong></div>)}</div>
        {unresolved && <p className="small warning-text">Complete each food’s source, edible weight, and clarification before saving. This subtotal excludes unresolved foods.</p>}
        <button className="button primary full" disabled={unresolved || !draft.title.trim()} onClick={onSave}><Icon name="check" />{mode === 'usual' ? 'Save template' : 'Save meal'}</button>
        <p className="small muted center">{cloudMode ? 'Saved to your account after confirmation.' : 'Saved on this device.'}</p>
      </section>
      {mode === 'meal' && nutrientKeys.some(key => targets[key]) && <section className="panel checks review-remaining" aria-label="Remaining targets after saving"><h3>After saving this meal</h3><p className="small muted">For {draft.date} · belum masuk log sampai kamu save.</p>{unresolved ? <p className="small warning-text">Lengkapi sumber, gram, dan pertanyaan dulu ya. Remaining targets belum bisa dihitung untuk meal ini.</p> : <><div className="remaining-list">{nutrientKeys.map(key => {
        const target = targets[key];
        if (!target) return null;
        const consumed = dayTotals[key] + totals[key];
        return <div key={key}><span>{nutrientNames[key]}</span><strong>{number(Math.abs(target - consumed))} {key === 'calories' ? 'kcal' : 'g'} {consumed > target ? 'above target' : 'left'}</strong></div>;
      })}</div><ProteinNote protein={dayTotals.protein + totals.protein} target={targets.protein} mealProtein={totals.protein} /></>}</section>}
      <section className="panel checks"><div className="section-heading"><h3>Ada tambahan yang belum dicatat?</h3><Icon name="info" size={18} /></div><p className="small muted">Check minyak, butter, santan, tepung, sambal, and sauces. Add only what you ate, and check whether your chosen prepared-food record already includes it.</p>{draft.checks.map((check, index) => <p className="small check-line" key={index}>{check}</p>)}</section>
    </aside></div>
  </div>;
}
