import { useState, useEffect, type ReactNode } from 'react';
import { Icon, MacroLine, number } from './ui';

type Preset = {
  label: string;
  tag: string;
  query: string;
  items: { name: string; qty: string; cals: number; p: number; c: number; f: number }[];
};

type AddOn = {
  id: string;
  name: string;
  emoji: string;
  cals: number;
  p: number;
  c: number;
  f: number;
};

const PRESETS: Preset[] = [
  {
    label: '🍜 Mie Ayam + Telur',
    tag: 'Street Food',
    query: '1 mangkuk mie ayam jamur dan 1 butir telur rebus',
    items: [
      { name: 'Mie ayam jamur (1 porsi mangkuk)', qty: '350 g', cals: 420, p: 18, c: 54, f: 14 },
      { name: 'Telur ayam rebus matang', qty: '55 g (1 butir)', cals: 78, p: 6.3, c: 0.6, f: 5.3 },
    ],
  },
  {
    label: '🍗 Nasi Padang Gulai',
    tag: 'Regional Dish',
    query: '1 porsi nasi putih, 1 potong ayam gulai, dan daun singkong rebus',
    items: [
      { name: 'Nasi putih pulen', qty: '150 g (1 centong)', cals: 195, p: 3.8, c: 43.2, f: 0.4 },
      { name: 'Ayam gulai bumbu padang', qty: '120 g (1 potong paha)', cals: 260, p: 21, c: 4.5, f: 17.5 },
      { name: 'Daun singkong rebus', qty: '60 g', cals: 35, p: 2.2, c: 5.8, f: 0.6 },
    ],
  },
  {
    label: '🍢 Sate Ayam + Lontong',
    tag: 'Indonesian Staple',
    query: '10 tusuk sate ayam bumbu kacang dan 1 lontong potong',
    items: [
      { name: 'Sate ayam dada panggang', qty: '150 g (10 tusuk)', cals: 280, p: 32, c: 2, f: 15 },
      { name: 'Bumbu kacang sate kental', qty: '50 g (2.5 sdm)', cals: 165, p: 6.5, c: 9.5, f: 12 },
      { name: 'Lontong potong', qty: '100 g', cals: 140, p: 2.8, c: 31, f: 0.3 },
    ],
  },
  {
    label: '☕ Latte & Avocado Toast',
    tag: 'Cafe Breakfast',
    query: '1 gelas caffe latte oat milk dan 2 lembar roti gandum alpukat telur',
    items: [
      { name: 'Caffe latte with oat milk (unsweetened)', qty: '240 mL (1 glass)', cals: 130, p: 3.5, c: 16, f: 5.5 },
      { name: 'Roti gandum dengan alpukat lumat', qty: '90 g', cals: 185, p: 5.5, c: 26, f: 7.8 },
      { name: 'Telur ceplok mata sapi', qty: '50 g (1 butir)', cals: 92, p: 6.2, c: 0.4, f: 7.1 },
    ],
  },
  {
    label: '🥗 Gado-Gado Lontong',
    tag: 'Traditional Salad',
    query: '1 piring gado-gado lontong saus kacang dan 1 butir telur',
    items: [
      { name: 'Sayuran rebus & tauge', qty: '120 g', cals: 45, p: 2.5, c: 8, f: 0.5 },
      { name: 'Lontong / ketupat potong', qty: '100 g', cals: 140, p: 2.8, c: 31, f: 0.3 },
      { name: 'Bumbu kacang gado-gado', qty: '60 g (3 sdm)', cals: 190, p: 7.5, c: 11, f: 13.8 },
      { name: 'Telur rebus separuh', qty: '55 g (1 butir)', cals: 78, p: 6.3, c: 0.6, f: 5.3 },
    ],
  },
  {
    label: '🍣 Salmon Teriyaki Bowl',
    tag: 'Healthy Protein',
    query: '1 mangkuk nasi merah, 1 potong salmon panggang 150g, dan brokoli kukus',
    items: [
      { name: 'Nasi merah pulen', qty: '140 g (1 centong)', cals: 155, p: 3.5, c: 32, f: 1.2 },
      { name: 'Fillet salmon panggang teriyaki', qty: '150 g', cals: 310, p: 34, c: 5, f: 17 },
      { name: 'Brokoli kukus', qty: '100 g', cals: 35, p: 2.8, c: 7, f: 0.4 },
    ],
  },
];

const ADD_ONS: AddOn[] = [
  { id: 'sambal', name: 'Sambal Terasi', emoji: '🌶️', cals: 20, p: 0.5, c: 2.2, f: 1.0 },
  { id: 'kerupuk', name: 'Kerupuk Kaleng', emoji: '🍘', cals: 65, p: 0.8, c: 8.5, f: 3.2 },
  { id: 'telur', name: 'Telur Dadar', emoji: '🍳', cals: 95, p: 6.5, c: 0.8, f: 7.2 },
  { id: 'esteh', name: 'Es Teh Manis', emoji: '🧊', cals: 85, p: 0.1, c: 21.0, f: 0.0 },
];

function useAnimatedNumber(target: number, durationMs = 320): number {
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startVal = current;
    const diff = target - startVal;

    if (diff === 0) return;

    let frameId: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startVal + diff * ease));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target]);

  return current;
}

export default function LandingPage({
  onSignIn,
  onSignUp,
  authModal,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
  authModal?: ReactNode;
}) {
  const [activePreset, setActivePreset] = useState<number>(0);
  const [activeAddOns, setActiveAddOns] = useState<string[]>([]);
  const [animKey, setAnimKey] = useState<number>(0);

  const currentPreset = PRESETS[activePreset];

  // Combine preset items and selected add-ons
  const selectedAddOnItems = ADD_ONS.filter(a => activeAddOns.includes(a.id)).map(a => ({
    name: `${a.emoji} ${a.name} (Extra)`,
    qty: '1 porsi tambahan',
    cals: a.cals,
    p: a.p,
    c: a.c,
    f: a.f,
  }));

  const allItems = [...currentPreset.items, ...selectedAddOnItems];

  const rawTotalCals = allItems.reduce((sum, item) => sum + item.cals, 0);
  const rawTotalP = allItems.reduce((sum, item) => sum + item.p, 0);
  const rawTotalC = allItems.reduce((sum, item) => sum + item.c, 0);
  const rawTotalF = allItems.reduce((sum, item) => sum + item.f, 0);

  // Animated numbers
  const animatedCals = useAnimatedNumber(rawTotalCals);
  const animatedP = useAnimatedNumber(Math.round(rawTotalP));
  const animatedC = useAnimatedNumber(Math.round(rawTotalC));
  const animatedF = useAnimatedNumber(Math.round(rawTotalF));

  // Macro percentages for distribution bar
  const totalGrams = rawTotalP + rawTotalC + rawTotalF || 1;
  const pPct = Math.round((rawTotalP / totalGrams) * 100);
  const cPct = Math.round((rawTotalC / totalGrams) * 100);
  const fPct = Math.max(0, 100 - pPct - cPct);

  // Daily budget reference (2,000 kcal standard target)
  const DAILY_BUDGET = 2000;
  const budgetPct = Math.min(100, Math.round((rawTotalCals / DAILY_BUDGET) * 100));
  const remainingBudget = Math.max(0, DAILY_BUDGET - rawTotalCals);

  const handleSelectPreset = (idx: number) => {
    setActivePreset(idx);
    setActiveAddOns([]);
    setAnimKey(prev => prev + 1);
  };

  const handleSurpriseMe = () => {
    let nextIdx = Math.floor(Math.random() * PRESETS.length);
    if (nextIdx === activePreset) {
      nextIdx = (nextIdx + 1) % PRESETS.length;
    }
    handleSelectPreset(nextIdx);
  };

  const toggleAddOn = (id: string) => {
    setActiveAddOns(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setAnimKey(prev => prev + 1);
  };

  return (
    <div className="landing-page">
      {/* Background Ambient Glow Elements */}
      <div className="ambient-blob blob-1" aria-hidden="true" />
      <div className="ambient-blob blob-2" aria-hidden="true" />

      {/* Navigation Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <a className="brand" href="/" aria-label="Portion Home">
            <span className="brand-mark">
              <Icon name="plate" size={24} />
            </span>
            portion<span className="brand-period">.</span>
          </a>

          <nav className="landing-nav" aria-label="Main Navigation">
            <a href="#features">Features</a>
            <a href="#demo">Live Demo</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#pricing">Pricing</a>
            <a href="#academic">Research</a>
          </nav>

          <div className="landing-header-actions">
            <button className="button secondary small-btn hover-lift" onClick={onSignIn}>
              Sign In
            </button>
            <button className="button primary small-btn shine-btn" onClick={onSignUp}>
              Get Started Free <Icon name="arrow" size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero" id="hero">
        <div className="landing-hero-content">
          <div className="landing-pill pulse-badge">
            <span className="sparkle-icon"><Icon name="spark" size={14} /></span>
            <span>AI-Powered Food Journal · Built for Real Everyday Meals</span>
          </div>

          <h1 className="landing-title">
            Track calories and macros <br className="hero-break" />
            <span className="landing-highlight animate-gradient">in plain words.</span>
          </h1>

          <p className="landing-subtitle">
            No more searching massive, frustrating databases for every single ingredient.
            Describe what you ate in everyday Indonesian or English—Portion breaks down ingredients,
            estimates portion weights, and calculates verified macros in seconds.
          </p>

          <div className="landing-cta-group">
            <button className="button primary cta-large shine-btn shadow-pulse" onClick={onSignUp}>
              Start Free in Beta <Icon name="arrow" size={18} />
            </button>
            <a href="#demo" className="button secondary cta-large hover-lift">
              <Icon name="spark" size={16} /> Try Interactive Demo
            </a>
          </div>

          {/* Floating Delights / Floating Badges with Fun Food Stickers */}
          <div className="floating-stickers-container" aria-hidden="true">
            <div className="floating-sticker sticker-left">
              <span className="sticker-emoji">🥑</span>
              <div>
                <strong>+24g Protein</strong>
                <small>Logged in 1 tap</small>
              </div>
            </div>

            <div className="floating-sticker sticker-right">
              <span className="sticker-emoji">⚡</span>
              <div>
                <strong>Parsed in 0.4s</strong>
                <small>Natural Indonesian</small>
              </div>
            </div>

            <div className="floating-sticker sticker-bottom-left">
              <span className="sticker-emoji">🍜</span>
              <div>
                <strong>Mie Ayam & Bakso</strong>
                <small>Auto-weighed</small>
              </div>
            </div>

            <div className="floating-sticker sticker-bottom-right">
              <span className="sticker-emoji">🎯</span>
              <div>
                <strong>Early Access</strong>
                <small>Free during Beta</small>
              </div>
            </div>
          </div>

          <div className="landing-trust-bar">
            <span><Icon name="check" size={15} /> USDA FoodData Central Verified</span>
            <span><Icon name="check" size={15} /> Open Food Facts Package Barcode</span>
            <span><Icon name="check" size={15} /> Mifflin-St Jeor TDEE Calculator</span>
            <span><Icon name="check" size={15} /> Free During Public Beta</span>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="landing-section demo-section" id="demo">
        <div className="section-head-center">
          <span className="eyebrow">Interactive Food Sandbox</span>
          <h2>See How Portion Understands Your Food</h2>
          <p className="muted">
            Click any meal below or add fun extras to watch Portion calculate calories, portion assumptions, and macro balance in real time!
          </p>
        </div>

        <div className="demo-card-container interactive-glow">
          {/* Preset Buttons + Surprise Me */}
          <div className="preset-bar-header">
            <div className="preset-tabs" role="tablist" aria-label="Sample Meals">
              {PRESETS.map((p, idx) => (
                <button
                  key={p.label}
                  role="tab"
                  aria-selected={activePreset === idx}
                  className={`preset-tab ${activePreset === idx ? 'active' : ''}`}
                  onClick={() => handleSelectPreset(idx)}
                >
                  <span>{p.label}</span>
                  <span className="preset-subtag">{p.tag}</span>
                </button>
              ))}
            </div>

            <button
              className="surprise-button hover-lift"
              onClick={handleSurpriseMe}
              title="Pick a random meal!"
              type="button"
            >
              🎲 Surprise Me!
            </button>
          </div>

          {/* Interactive Extras / Add-on Condiments */}
          <div className="addons-container">
            <span className="addons-title">
              <span className="sparkle-icon">✨</span> Add playful extras:
            </span>
            <div className="addons-list">
              {ADD_ONS.map(addon => {
                const isSelected = activeAddOns.includes(addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    className={`addon-pill ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleAddOn(addon.id)}
                  >
                    <span>{addon.emoji}</span>
                    <span>{addon.name}</span>
                    <span className="addon-cals">+{addon.cals} kcal</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simulated Natural Language Input */}
          <div className="demo-input-box" key={`input-${animKey}`}>
            <span className="demo-input-icon spin-on-change"><Icon name="spark" size={18} /></span>
            <div className="demo-input-text">
              {currentPreset.query}
              {activeAddOns.length > 0 && (
                <span className="demo-addons-suffix">
                  {' '}
                  + {ADD_ONS.filter(a => activeAddOns.includes(a.id)).map(a => a.name).join(', ')}
                </span>
              )}
            </div>
            <span className="demo-tag pulse-subtle">Interpreted Live</span>
          </div>

          {/* Breakdown Result */}
          <div className="demo-result-panel" key={`panel-${animKey}`}>
            <div className="demo-result-header">
              <div className="demo-cals-block">
                <span className="small muted">Total Energy Breakdown</span>
                <div className="demo-calorie-big bounce-text">
                  {animatedCals} <span>kcal</span>
                </div>
              </div>

              <div className="demo-macro-pills">
                <div className="demo-macro-pill protein pill-hover" title="Protein: 4 kcal per gram">
                  <i className="dot protein" />
                  <div>
                    <b>{animatedP}g</b> <small>Protein ({pPct}%)</small>
                  </div>
                </div>
                <div className="demo-macro-pill carbs pill-hover" title="Carbohydrates: 4 kcal per gram">
                  <i className="dot carbs" />
                  <div>
                    <b>{animatedC}g</b> <small>Carbs ({cPct}%)</small>
                  </div>
                </div>
                <div className="demo-macro-pill fat pill-hover" title="Dietary Fat: 9 kcal per gram">
                  <i className="dot fat" />
                  <div>
                    <b>{animatedF}g</b> <small>Fat ({fPct}%)</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Macro Distribution Stacked Bar */}
            <div className="macro-bar-container" aria-label="Macro breakdown percentage">
              <div className="macro-bar-track">
                <div className="bar-segment protein" style={{ width: `${pPct}%` }} title={`Protein: ${pPct}%`} />
                <div className="bar-segment carbs" style={{ width: `${cPct}%` }} title={`Carbs: ${cPct}%`} />
                <div className="bar-segment fat" style={{ width: `${fPct}%` }} title={`Fat: ${fPct}%`} />
              </div>
              <div className="macro-bar-legend">
                <span className="legend-item protein"><i className="dot protein" /> Protein {pPct}%</span>
                <span className="legend-item carbs"><i className="dot carbs" /> Carbs {cPct}%</span>
                <span className="legend-item fat"><i className="dot fat" /> Fat {fPct}%</span>
              </div>
            </div>

            {/* Interactive Daily Target Budget Meter */}
            <div className="budget-meter-box">
              <div className="budget-meter-header">
                <div className="budget-label">
                  <span className="budget-icon">🎯</span>
                  <strong>Daily Budget Fit</strong>
                  <span className="budget-target-pill">{budgetPct}% of 2,000 kcal target</span>
                </div>
                <span className="budget-remaining">{remainingBudget} kcal left today</span>
              </div>
              <div className="budget-track">
                <div
                  className="budget-fill"
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>

            {/* Identified Ingredients List */}
            <div className="demo-items-list">
              <div className="demo-items-header">
                <span className="small muted-label">Identified Ingredients ({allItems.length})</span>
                <span className="badge subtle">Verified Nutrition Data</span>
              </div>
              {allItems.map((item, i) => (
                <div
                  className="demo-item-row item-fade-in"
                  key={`${item.name}-${i}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="demo-item-info">
                    <strong>{item.name}</strong>
                    <span className="small muted">{item.qty}</span>
                  </div>
                  <div className="demo-item-macros">
                    <span className="demo-item-cal">{item.cals} kcal</span>
                    <MacroLine totals={{ calories: item.cals, protein: item.p, carbs: item.c, fat: item.f }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="demo-footer-note">
              <span className="check-badge"><Icon name="check" size={14} /></span>
              <span>All assumptions are transparent and fully editable before saving to your journal.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why Traditional Apps Fail vs Portion */}
      <section className="landing-section comparison-section">
        <div className="section-head-center">
          <span className="eyebrow">The Portion Difference</span>
          <h2>Why 80% of People Quit Calorie Counting</h2>
          <p className="muted">Logging food shouldn't feel like doing your annual taxes.</p>
        </div>

        <div className="comparison-grid">
          <div className="comp-card negative hover-lift">
            <div className="comp-header">
              <span className="comp-icon red-icon">✕</span>
              <h3>Traditional Calorie Trackers</h3>
            </div>
            <ul>
              <li>Forces you to weigh raw ingredients and search 20 ambiguous entries for one dish.</li>
              <li>Fails completely on localized and mixed dishes (Nasi Padang, Soto, Mie Ayam).</li>
              <li>Takes 5–10 minutes per entry, causing high friction and day-3 drop-offs.</li>
              <li>Cluttered with ads, paywalls, and unverified duplicate entries.</li>
            </ul>
          </div>

          <div className="comp-card positive hover-lift">
            <div className="positive-badge floating-badge">The Portion Way</div>
            <div className="comp-header">
              <span className="comp-icon green-icon">✓</span>
              <h3>The Portion Experience</h3>
            </div>
            <ul>
              <li>Type or speak naturally in plain words: bowls, glasses, spoons, or pieces.</li>
              <li>Native intelligence for regional culinary vocabulary and Indonesian dishes.</li>
              <li>Takes 5 seconds to log, review transparent assumptions, and save to your journal.</li>
              <li>Clean, calm interface powered by verified USDA and Open Food Facts data.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="landing-section features-section" id="features">
        <div className="section-head-center">
          <span className="eyebrow">Built for Consistency</span>
          <h2>Everything You Need to Reach Your Health Goals</h2>
        </div>

        <div className="features-grid">
          <div className="feature-card interactive-card">
            <div className="feature-icon icon-bounce"><Icon name="spark" size={24} /></div>
            <h3>Natural Language Parsing</h3>
            <p className="small muted">
              Just write what’s on your plate. Our models estimate portions, calculate calories, and separate macro balances with zero friction.
            </p>
          </div>

          <div className="feature-card interactive-card">
            <div className="feature-icon icon-bounce"><Icon name="plate" size={24} /></div>
            <h3>Regional & Local Dishes</h3>
            <p className="small muted">
              Designed specifically to handle Indonesian and Southeast Asian meal formats, from street food snacks to rich coconut-milk curries.
            </p>
          </div>

          <div className="feature-card interactive-card">
            <div className="feature-icon icon-bounce"><Icon name="journal" size={24} /></div>
            <h3>Verified Nutritional Data</h3>
            <p className="small muted">
              Cross-checked with USDA FoodData Central and Open Food Facts package records. Accurate macros without wild guessing.
            </p>
          </div>

          <div className="feature-card interactive-card">
            <div className="feature-icon icon-bounce"><Icon name="settings" size={24} /></div>
            <h3>Smart BMR & TDEE Targets</h3>
            <p className="small muted">
              Automatic calorie and protein target calculation powered by the clinical Mifflin-St Jeor equation, personalized to your body and goal.
            </p>
          </div>

          <div className="feature-card interactive-card">
            <div className="feature-icon icon-bounce"><Icon name="bookmark" size={24} /></div>
            <h3>Repeat Meals in One Tap</h3>
            <p className="small muted">
              Save your frequent breakfasts and staple lunches as Usuals. Re-log them anytime with a single tap.
            </p>
          </div>

          <div className="feature-card interactive-card">
            <div className="feature-icon icon-bounce"><Icon name="lock" size={24} /></div>
            <h3>Private & Cloud Synced</h3>
            <p className="small muted">
              Your journal is strictly protected by Supabase Row-Level Security. Sync seamlessly across your laptop and mobile phone.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing-section steps-section" id="how-it-works">
        <div className="section-head-center">
          <span className="eyebrow">Simple 3-Step Routine</span>
          <h2>How Portion Works Every Day</h2>
        </div>

        <div className="steps-grid">
          <div className="step-card step-interactive">
            <div className="step-number pulse-number">1</div>
            <h3>Describe Your Meal</h3>
            <p className="small muted">
              Type what you ate in natural language using standard household measures like glasses, bowls, or pieces.
            </p>
          </div>

          <div className="step-card step-interactive">
            <div className="step-number pulse-number">2</div>
            <h3>Review Transparent Assumptions</h3>
            <p className="small muted">
              Portion displays the exact gram assumptions and verified sources. Tweak any ingredient in one click before saving.
            </p>
          </div>

          <div className="step-card step-interactive">
            <div className="step-number pulse-number">3</div>
            <h3>Track Your Daily Progress</h3>
            <p className="small muted">
              Watch your protein, carbs, and fat progress bars update in real time toward your personalized health target.
            </p>
          </div>
        </div>
      </section>

      {/* Transparent Pricing & Early Access Plans */}
      <section className="landing-section pricing-section" id="pricing">
        <div className="section-head-center">
          <span className="eyebrow">Early Adopter Plans</span>
          <h2>Simple, Transparent Pricing</h2>
          <p className="muted">
            Portion is 100% free to use right now during our public beta. Early adopters get full access to all features and lock in grandfathered rates when Pro launches.
          </p>
        </div>

        <div className="pricing-grid">
          {/* Card 1: Public Beta */}
          <div className="pricing-card beta-card hover-lift">
            <div className="pricing-header">
              <span className="pricing-badge green">Free Now</span>
              <h3>Public Beta</h3>
              <p className="small muted">Everything you need to effortlessly log your everyday meals.</p>
              <div className="pricing-amount">
                <span className="price-val">$0</span>
                <span className="price-period">/ month (Free to use now)</span>
              </div>
            </div>

            <ul className="pricing-features">
              <li><Icon name="check" size={16} /> Natural language meal & drink logging</li>
              <li><Icon name="check" size={16} /> Indonesian & regional dish intelligence</li>
              <li><Icon name="check" size={16} /> Verified USDA & Open Food Facts data</li>
              <li><Icon name="check" size={16} /> Mifflin-St Jeor BMR & TDEE macro targets</li>
              <li><Icon name="check" size={16} /> Save Usual meals for 1-tap re-logging</li>
              <li><Icon name="check" size={16} /> Private cloud sync with Supabase RLS</li>
            </ul>

            <button className="button primary cta-large shine-btn full-width" onClick={onSignUp}>
              Start Free in Beta <Icon name="arrow" size={16} />
            </button>
            <span className="pricing-footnote">No credit card or payment required.</span>
          </div>

          {/* Card 2: Portion Pro (Launching Soon) */}
          <div className="pricing-card pro-card hover-lift featured-card">
            <div className="pro-pill-featured">Free Access During Beta</div>
            <div className="pricing-header">
              <span className="pricing-badge pro">Future Pro Tier</span>
              <h3>Portion Pro</h3>
              <p className="small muted">For serious health goals, athletes, and nutrition power users.</p>
              <div className="pricing-amount">
                <span className="price-val">$4.99</span>
                <span className="price-period">/ month (~Rp 49.000/bln)</span>
              </div>
            </div>

            <ul className="pricing-features">
              <li><Icon name="check" size={16} /> <strong>Everything in Public Beta, plus:</strong></li>
              <li><Icon name="check" size={16} /> Unlimited high-volume Claude meal breakdowns</li>
              <li><Icon name="check" size={16} /> Micronutrient tracking (sodium, sugar, dietary fiber)</li>
              <li><Icon name="check" size={16} /> PDF nutrition export for doctors & trainers</li>
              <li><Icon name="check" size={16} /> Batch recipe & meal-prep portion calculator</li>
              <li><Icon name="check" size={16} /> Priority response speed & early feature access</li>
            </ul>

            <button className="button secondary cta-large full-width hover-lift pro-btn" onClick={onSignUp}>
              Join Pro Beta (100% Free Now) <Icon name="spark" size={16} />
            </button>
            <span className="pricing-footnote">Free during Early Access. Grandfathered rates for early adopters.</span>
          </div>
        </div>
      </section>

      {/* Academic Backing & Research Section */}
      <section className="landing-section academic-section" id="academic">
        <div className="academic-card hover-lift">
          <div className="academic-badge">Academic & Angel Backing</div>
          <h3>Grounded in Applied AI Research</h3>
          <p className="muted">
            Portion is supported by angel investment and research guidance from{' '}
            <strong>Dr. Maria Irmina Prasetiyowati, S.Kom., M.T.</strong>, Associate Professor in Artificial Intelligence and former Head of the Informatics Department at Universitas Multimedia Nusantara (UMN).
          </p>
          <div className="academic-quote">
            “Developing intelligent AI models that accurately interpret complex, localized culinary vocabularies bridges the gap between academic machine learning and everyday health habits.”
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="landing-final-cta">
        <div className="final-cta-box shadow-pulse">
          <h2>Ready to make nutrition tracking effortless?</h2>
          <p>Create your free account today and start logging your meals in plain language.</p>
          <div className="final-cta-buttons">
            <button className="button primary cta-large white-btn shine-btn" onClick={onSignUp}>
              Create Free Account <Icon name="arrow" size={17} />
            </button>
            <button className="button secondary cta-large outline-btn hover-lift" onClick={onSignIn}>
              Sign In to Your Journal
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-brand">
            <a className="brand" href="/">
              <span className="brand-mark"><Icon name="plate" size={20} /></span>
              portion<span className="brand-period">.</span>
            </a>
            <p className="small muted">
              The intelligent food journal for real daily life.
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#demo">Live Demo</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#pricing">Pricing</a>
              <button className="text-button small" onClick={onSignIn}>Sign In</button>
            </div>
            <div className="footer-col">
              <h4>Organization</h4>
              <a href="#academic">Research & Team</a>
              <a href="mailto:contact@portion.my.id">contact@portion.my.id</a>
              <span>Universitas Multimedia Nusantara</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="small muted">
            © {new Date().getFullYear()} Portion. All rights reserved. Live on portion.my.id.
          </p>
          <p className="small muted">
            Protected by Supabase Row-Level Security. Powered by verified USDA & Open Food Facts data.
          </p>
        </div>
      </footer>

      {/* Auth Modal Container */}
      {authModal}
    </div>
  );
}
