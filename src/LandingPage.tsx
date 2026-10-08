import { useState, type ReactNode } from 'react';
import { Icon } from './ui';
import { sampleMeals, sampleTotals } from './demo';

const format = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);
const features = [
  { icon: 'spark', title: 'Write the way you eat.', text: 'Describe your meal in Indonesian, English, or both. AI suggests ingredients, portions, and estimates for you to review.' },
  { icon: 'search', title: 'Know where the numbers come from.', text: 'See AI estimates, USDA records, Open Food Facts products, and your own package labels as distinct sources.' },
  { icon: 'settings', title: 'Make the portion yours.', text: 'Adjust edible weight, drink volume, preparation, and raw or cooked state before saving. Grams and milliliters stay separate.' },
  { icon: 'journal', title: 'Keep a daily picture.', text: 'Track calories, protein, carbs, and fat against optional, editable targets. Revisit your meals by date.' },
  { icon: 'bookmark', title: 'Save the meals you repeat.', text: 'Keep usual meals and package labels for next time. Edit a saved meal before logging it again.' },
  { icon: 'lock', title: 'Take your journal with you.', text: 'Use an account for cloud sync, or device storage in local mode. Export a backup of your structured journal.' },
];

function Brand() {
  return <a className="brand" href="/" aria-label="Portion home"><span className="brand-mark"><Icon name="plate" size={24} /></span>portion<span className="brand-period">.</span></a>;
}

export default function LandingPage({ onSignIn, onSignUp, authModal }: {
  onSignIn: () => void; onSignUp: () => void; authModal?: ReactNode;
}) {
  const [selected, setSelected] = useState(0);
  const meal = sampleMeals[selected];
  const [quantities, setQuantities] = useState(sampleMeals[0].items.map(item => item.quantity));
  const [reviewed, setReviewed] = useState(false);
  const totals = sampleTotals(meal, quantities);
  const valid = quantities.every(quantity => Number.isFinite(quantity) && quantity >= 1 && quantity <= 10000);

  function chooseMeal(index: number) {
    setSelected(index); setQuantities(sampleMeals[index].items.map(item => item.quantity)); setReviewed(false);
  }

  return <div className="landing-page">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Brand />
        <nav aria-label="Product navigation" className="landing-nav">
          <a href="#demo">Try the demo</a><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#about">About</a>
        </nav>
        <div className="landing-actions"><button className="text-button" onClick={onSignIn}>Sign in</button><button className="button primary" onClick={onSignUp}>Get started <Icon name="arrow" size={16} /></button></div>
      </div>
    </header>

    <main id="main-content">
      <section className="landing-container landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="landing-kicker"><span className="status-dot" /> An everyday food journal · Early beta</span>
          <h1 id="hero-title">Your meals,<br />in your words.</h1>
          <p className="hero-description">From mie ayam to your morning latte. Describe what you ate, review the portions and nutrition, and keep your day in view.</p>
          <div className="hero-cta"><button className="button primary" onClick={onSignUp}>Start your journal <Icon name="arrow" size={18} /></button><a className="button secondary" href="#demo">Explore a sample</a></div>
          <p className="hero-caption">Indonesian & English · Editable portions · Visible sources</p>
        </div>
        <div className="hero-preview" aria-label="Illustrative product workflow">
          <div className="preview-top"><span><Icon name="journal" size={17} /> A meal, ready for review</span><span className="sample-badge">Sample</span></div>
          <div className="preview-description"><span className="preview-label">You describe</span><p>“1 mangkuk mie ayam jamur dan 1 butir telur rebus”</p></div>
          <div className="preview-flow"><span className="preview-label">You review</span><div><Icon name="check" size={16} /> Ingredients & preparation</div><div><Icon name="check" size={16} /> Portion assumptions & nutrition sources</div><div><Icon name="check" size={16} /> Calories, protein, carbs & fat</div></div>
          <a href="#demo" className="preview-next">Make the portion yours <Icon name="arrow" size={17} /></a>
          <p className="preview-footnote">Illustrative walkthrough. Your actual meal needs its own review.</p>
        </div>
      </section>
      <div className="source-strip"><div className="landing-container"><span>Nutrition sources you can inspect</span><a href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer">USDA FoodData Central <Icon name="arrow" size={14} /></a><a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer">Open Food Facts <Icon name="arrow" size={14} /></a><span>Your package labels</span></div></div>

      <section id="demo" className="landing-container landing-section demo-section" aria-labelledby="demo-title">
        <div className="section-intro"><span className="eyebrow">A little less guesswork</span><h2 id="demo-title">Try the review.<br />Keep control of the details.</h2><p>Choose a sample meal and change a portion. See how the totals follow your edits, just as they do in the journal.</p></div>
        <div className="demo-disclosure"><Icon name="info" size={18} /><p><strong>Illustrative sample data.</strong> This walkthrough uses fixed example recipes and values. It does not call AI, search a nutrition database, or save to an account. These numbers are not nutritional advice for your meal.</p></div>
        <div className="sample-picker" role="group" aria-label="Choose a sample meal">{sampleMeals.map((preset, index) => <button key={preset.title} type="button" aria-pressed={selected === index} className={`sample-choice ${selected === index ? 'selected' : ''}`} onClick={() => chooseMeal(index)}>{preset.title}</button>)}</div>
        <div className="walkthrough">
          <div className="walkthrough-editor">
            <div className="walkthrough-title"><span className="step-index">01</span><h3>Review the meal</h3><span className="sample-badge">Sample values</span></div>
            <div className="sample-input"><span className="preview-label">Meal description</span><p>{meal.description}</p></div>
            {meal.items.map((item, index) => <div className="sample-ingredient" key={`${selected}-${index}`}>
              <div className="sample-ingredient-heading"><strong>{item.name}</strong><span className="sample-source">Illustrative sample</span></div>
              <div className="sample-ingredient-body"><p>{item.assumption}</p><label htmlFor={`sample-portion-${index}`}>Portion ({item.unit === 'ml' ? 'mL' : 'g'})<input id={`sample-portion-${index}`} type="number" inputMode="decimal" min="1" max="10000" step="any" value={quantities[index] || ''} onChange={event => { const quantity = Number(event.target.value); setQuantities(current => current.map((value, i) => i === index ? quantity : value)); setReviewed(false); }} /></label></div>
            </div>)}
            {!valid && <p role="alert" className="error-message">Enter each portion between 1 and 10,000 {meal.items[0].unit === 'ml' ? 'mL' : 'g'}.</p>}
          </div>
          <aside className="sample-summary" aria-label="Sample meal totals">
            <div className="walkthrough-title"><span className="step-index">02</span><h3>Your sample totals</h3></div>
            <div className="sample-energy"><span className="preview-label">Meal energy · sample</span><div>{valid ? format(totals.calories) : '—'} <span>kcal</span></div></div>
            <dl className="sample-macros">{(['protein', 'carbs', 'fat'] as const).map(key => <div key={key}><dt><i className={`dot ${key}`} />{key === 'carbs' ? 'Carbs' : key === 'protein' ? 'Protein' : 'Fat'}</dt><dd>{valid ? format(totals[key]) : '—'} g</dd></div>)}</dl>
            <div className="sample-review-note"><Icon name="info" size={17} /><p>In your journal, check each source and assumption before saving. Drink volumes stay in mL; food weights stay in g.</p></div>
            <button className="button primary full" disabled={!valid} onClick={() => setReviewed(true)}><Icon name="check" size={17} />Finish sample review</button>
            <div className="sample-completion" role="status">{reviewed ? <><strong>Sample review complete.</strong><span>Nothing was saved. Create an account to log your own meal.</span><button className="text-button" onClick={onSignUp}>Start a real journal <Icon name="arrow" size={15} /></button></> : <span>No account needed. Nothing is stored.</span>}</div>
          </aside>
        </div>
      </section>

      <section id="how-it-works" className="workflow-section">
        <div className="landing-container landing-section"><div className="section-intro"><span className="eyebrow">Describe → review → save</span><h2>A routine that fits<br />the food you actually eat.</h2><p>A bowl, a plate, a glass. Start with the words you know, then check the details that matter.</p></div>
          <ol className="workflow-steps"><li><span className="step-index">01</span><h3>Describe your meal</h3><p>Type foods and amounts in Indonesian or English. Include a brand, cooking method, or exact weight when you know it.</p></li><li><span className="step-index">02</span><h3>Review the assumptions</h3><p>AI proposes a portion and nutrition estimate. Adjust it, select a matching database record, or use your package label.</p></li><li><span className="step-index">03</span><h3>Save and see your day</h3><p>Keep the confirmed meal in your journal. View daily totals, edit past meals, and reuse your usuals.</p></li></ol>
        </div>
      </section>

      <section id="features" className="landing-container landing-section" aria-labelledby="features-title"><div className="section-intro"><span className="eyebrow">Made for everyday use</span><h2 id="features-title">A focused journal.<br />Useful details.</h2></div><div className="landing-features">{features.map(feature => <article key={feature.title}><div className="landing-feature-icon"><Icon name={feature.icon} size={22} /></div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>

      <section id="sources" className="landing-container landing-section source-section" aria-labelledby="sources-title"><div className="section-intro"><span className="eyebrow">Numbers with context</span><h2 id="sources-title">Every source has a story.<br />You should be able to see it.</h2><p>Mixed dishes and local recipes vary. Portion keeps the source visible so you can decide what matches your meal.</p></div><div className="source-explanations"><article><span className="source-number">01 / AI estimate</span><h3>A useful starting point</h3><p>Gemini currently suggests nutrition and household portions from model knowledge. Estimates include assumptions and are not verified database or manufacturer values.</p></article><article><span className="source-number">02 / Database record</span><h3>A match you choose</h3><p>Search USDA for ingredients or Open Food Facts for packaged foods. Check preparation, exact product, and nutrition units; coverage and data quality vary.</p></article><article><span className="source-number">03 / Package label</span><h3>The label in your hands</h3><p>Enter the four nutrition values and serving size printed on your product. Portion preserves your entry as a package label for reuse.</p></article></div></section>

      <section id="about" className="about-section"><div className="landing-container about-layout"><div><span className="eyebrow">About Portion</span><h2>A small product for<br />a daily habit.</h2></div><div><p>Portion is an early-stage nutrition journal developed by Ryann Chandiari. The focus is practical food logging for people who eat Indonesian meals and want to understand their calories and macros.</p><p>The beta includes meal review, daily totals, usual meals, package labels, editable targets, and account sync. We are improving the product through testing and feedback.</p><p>Claude is being considered for meal interpretation and clearer handling of uncertainty. It is not the default provider, and no improvement over Gemini has been demonstrated yet.</p><div className="about-links"><a href="https://github.com/HyperOrb/portion" target="_blank" rel="noreferrer">Explore the source <Icon name="arrow" size={16} /></a><a href="mailto:contact@portion.my.id">Contact Portion <Icon name="arrow" size={16} /></a></div></div></div></section>

      <section className="landing-container landing-section beta-section"><div><span className="eyebrow">Start with your next meal</span><h2>A little clarity,<br />one meal at a time.</h2><p>Early beta access is currently free. AI requests are limited by the shared app safeguard and provider availability. Future plans and pricing are not finalized.</p></div><div className="beta-actions"><button className="button primary" onClick={onSignUp}>Create your account <Icon name="arrow" size={18} /></button><button className="text-button" onClick={onSignIn}>Already have a journal? Sign in</button></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-container"><div className="landing-footer-top"><div><Brand /><p>Your everyday food journal.</p></div><nav aria-label="Footer navigation"><a href="#demo">Sample demo</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Beta terms</a><a href="mailto:contact@portion.my.id">contact@portion.my.id</a></nav></div><div className="landing-footer-bottom"><span>© {new Date().getFullYear()} Portion</span><span>Estimates need review. Portion does not provide medical advice.</span></div></div></footer>
    {authModal}
  </div>;
}
