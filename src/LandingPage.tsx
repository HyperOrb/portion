import { useState, type ReactNode } from 'react';
import { Icon, MacroLine, number } from './ui';

type Preset = {
  label: string;
  query: string;
  items: { name: string; qty: string; cals: number; p: number; c: number; f: number }[];
};

const PRESETS: Preset[] = [
  {
    label: '🍜 Mie Ayam + Telur Rebus',
    query: '1 mangkuk mie ayam jamur dan 1 butir telur rebus',
    items: [
      { name: 'Mie ayam jamur (1 porsi mangkuk)', qty: '350 g', cals: 420, p: 18, c: 54, f: 14 },
      { name: 'Telur ayam rebus matang', qty: '55 g (1 butir)', cals: 78, p: 6.3, c: 0.6, f: 5.3 },
    ],
  },
  {
    label: '🍗 Nasi Padang Ayam Gulai',
    query: '1 porsi nasi putih, 1 potong ayam gulai, dan daun singkong rebus',
    items: [
      { name: 'Nasi putih pulen', qty: '150 g (1 centong)', cals: 195, p: 3.8, c: 43.2, f: 0.4 },
      { name: 'Ayam gulai bumbu padang', qty: '120 g (1 potong paha)', cals: 260, p: 21, c: 4.5, f: 17.5 },
      { name: 'Daun singkong rebus', qty: '60 g', cals: 35, p: 2.2, c: 5.8, f: 0.6 },
    ],
  },
  {
    label: '☕ Caffe Latte + Toast',
    query: '1 gelas caffe latte oat milk dan 2 lembar roti gandum panggang telur ceplok',
    items: [
      { name: 'Caffe latte with oat milk (unsweetened)', qty: '240 mL (1 glass)', cals: 130, p: 3.5, c: 16, f: 5.5 },
      { name: 'Roti gandum panggang', qty: '70 g (2 lembar)', cals: 170, p: 7.2, c: 31, f: 2.4 },
      { name: 'Telur ceplok mata sapi', qty: '50 g (1 butir)', cals: 92, p: 6.2, c: 0.4, f: 7.1 },
    ],
  },
];

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
  const current = PRESETS[activePreset];

  const totalCals = current.items.reduce((sum, item) => sum + item.cals, 0);
  const totalP = current.items.reduce((sum, item) => sum + item.p, 0);
  const totalC = current.items.reduce((sum, item) => sum + item.c, 0);
  const totalF = current.items.reduce((sum, item) => sum + item.f, 0);

  return (
    <div className="landing-page">
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
            <a href="#academic">Research</a>
          </nav>

          <div className="landing-header-actions">
            <button className="button secondary small-btn" onClick={onSignIn}>
              Sign In
            </button>
            <button className="button primary small-btn" onClick={onSignUp}>
              Get Started Free <Icon name="arrow" size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero" id="hero">
        <div className="landing-hero-content">
          <div className="landing-pill">
            <Icon name="spark" size={14} />
            <span>AI-Powered Food Journal · Built for Real Meals</span>
          </div>

          <h1 className="landing-title">
            Track calories and macros <br className="hero-break" />
            <span className="landing-highlight">in plain words.</span>
          </h1>

          <p className="landing-subtitle">
            No more searching massive, frustrating databases for every single ingredient.
            Describe what you ate in everyday Indonesian or English—Portion breaks down ingredients,
            estimates portion weights, and calculates verified macros in seconds.
          </p>

          <div className="landing-cta-group">
            <button className="button primary cta-large" onClick={onSignUp}>
              Start Tracking Free <Icon name="arrow" size={18} />
            </button>
            <a href="#demo" className="button secondary cta-large">
              <Icon name="spark" size={16} /> See Live Demo
            </a>
          </div>

          <div className="landing-trust-bar">
            <span><Icon name="check" size={15} /> USDA FoodData Central Verified</span>
            <span><Icon name="check" size={15} /> Open Food Facts Integration</span>
            <span><Icon name="check" size={15} /> Mifflin-St Jeor TDEE Calculator</span>
            <span><Icon name="check" size={15} /> 100% Free for Personal Use</span>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="landing-section demo-section" id="demo">
        <div className="section-head-center">
          <span className="eyebrow">Interactive Preview</span>
          <h2>See How Portion Understands Your Food</h2>
          <p className="muted">
            Click any meal below to see how Portion transforms conversational descriptions into structured nutritional data.
          </p>
        </div>

        <div className="demo-card-container">
          {/* Preset Buttons */}
          <div className="preset-tabs" role="tablist" aria-label="Sample Meals">
            {PRESETS.map((p, idx) => (
              <button
                key={p.label}
                role="tab"
                aria-selected={activePreset === idx}
                className={`preset-tab ${activePreset === idx ? 'active' : ''}`}
                onClick={() => setActivePreset(idx)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Simulated Input */}
          <div className="demo-input-box">
            <span className="demo-input-icon"><Icon name="spark" size={18} /></span>
            <div className="demo-input-text">{current.query}</div>
            <span className="demo-tag">Interpreted</span>
          </div>

          {/* Breakdown Result */}
          <div className="demo-result-panel">
            <div className="demo-result-header">
              <div>
                <span className="small muted">Estimated Energy</span>
                <div className="demo-calorie-big">
                  {totalCals} <span>kcal</span>
                </div>
              </div>
              <div className="demo-macro-pills">
                <span className="demo-macro-pill protein">
                  <i className="dot protein" /> <b>{number(totalP)}g</b> Protein
                </span>
                <span className="demo-macro-pill carbs">
                  <i className="dot carbs" /> <b>{number(totalC)}g</b> Carbs
                </span>
                <span className="demo-macro-pill fat">
                  <i className="dot fat" /> <b>{number(totalF)}g</b> Fat
                </span>
              </div>
            </div>

            <div className="demo-items-list">
              <span className="small muted-label">Identified Ingredients ({current.items.length})</span>
              {current.items.map(item => (
                <div className="demo-item-row" key={item.name}>
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
              <Icon name="check" size={14} />
              <span>Assumptions are transparent and fully editable before you save.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why Traditional Apps Fail vs Portion */}
      <section className="landing-section comparison-section">
        <div className="section-head-center">
          <span className="eyebrow">The Portion Difference</span>
          <h2>Why 80% of People Quit Calorie Counting</h2>
          <p className="muted">Logging food shouldn't take more time than cooking it.</p>
        </div>

        <div className="comparison-grid">
          <div className="comp-card negative">
            <h3>❌ Traditional Calorie Apps</h3>
            <ul>
              <li>Forces you to weigh raw ingredients and search 20 different database entries for one meal.</li>
              <li>Fails completely on localized and mixed dishes (Nasi Padang, Soto, Mie Ayam).</li>
              <li>Takes 5–10 minutes per entry, causing high friction and day-3 drop-offs.</li>
              <li>Cluttered with ads, paywalls, and unverified user-submitted duplicate entries.</li>
            </ul>
          </div>

          <div className="comp-card positive">
            <div className="positive-badge">Portion Way</div>
            <h3>✨ The Portion Experience</h3>
            <ul>
              <li>Type or speak naturally in plain words: bowls, glasses, spoons, or pieces.</li>
              <li>Native intelligence for regional culinary vocabulary and Indonesian dishes.</li>
              <li>Takes 5 seconds to log, review transparent assumptions, and save to your journal.</li>
              <li>Clean, minimal interface powered by verified USDA and Open Food Facts data.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="landing-section features-section" id="features">
        <div className="section-head-center">
          <span className="eyebrow">Built for Consistency</span>
          <h2>Everything You Need to Reach Your Goals</h2>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><Icon name="spark" size={24} /></div>
            <h3>Natural Language Parsing</h3>
            <p className="small muted">
              Just write what’s on your plate. Our AI models estimate portions, calculate calories, and separate macro balances with zero friction.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Icon name="plate" size={24} /></div>
            <h3>Regional & Local Dishes</h3>
            <p className="small muted">
              Designed specifically to handle Indonesian and Southeast Asian meal formats, from street food snacks to rich coconut-milk curries.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Icon name="journal" size={24} /></div>
            <h3>Verified Nutritional Data</h3>
            <p className="small muted">
              Cross-checked with USDA FoodData Central and Open Food Facts package records. Accurate macros without wild guessing.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Icon name="settings" size={24} /></div>
            <h3>Smart BMR & TDEE Targets</h3>
            <p className="small muted">
              Automatic calorie and protein target calculation powered by the clinical Mifflin-St Jeor equation, personalized to your body and goal.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Icon name="bookmark" size={24} /></div>
            <h3>Repeat Meals in One Tap</h3>
            <p className="small muted">
              Save your frequent breakfasts and staple lunches as Usuals. Re-log them anytime with a single tap.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Icon name="lock" size={24} /></div>
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
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Describe Your Meal</h3>
            <p className="small muted">
              Type what you ate in natural language using standard household measures like glasses, bowls, or pieces.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Review Transparent Assumptions</h3>
            <p className="small muted">
              Portion displays the exact gram assumptions and verified sources. Tweak any ingredient in one click before saving.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Track Your Daily Progress</h3>
            <p className="small muted">
              Watch your protein, carbs, and fat progress bars update in real time toward your personalized health target.
            </p>
          </div>
        </div>
      </section>

      {/* Academic Backing & Research Section */}
      <section className="landing-section academic-section" id="academic">
        <div className="academic-card">
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
        <div className="final-cta-box">
          <h2>Ready to make nutrition tracking effortless?</h2>
          <p>Create your free account today and start logging your meals in plain language.</p>
          <div className="final-cta-buttons">
            <button className="button primary cta-large white-btn" onClick={onSignUp}>
              Create Free Account <Icon name="arrow" size={17} />
            </button>
            <button className="button secondary cta-large outline-btn" onClick={onSignIn}>
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
