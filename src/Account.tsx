import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudSetupError, supabase } from './cloud';
import { Icon, Modal } from './ui';
import LandingPage from './LandingPage';

function AccountShell({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="account-page">
      <div className="account-page-header">
        <a className="brand" href="/" aria-label="Portion Home">
          <span className="brand-mark"><Icon name="plate" size={25} /></span>
          portion<span className="brand-period">.</span>
        </a>
        {onClose && (
          <button className="icon-button modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      <section className="panel account-panel">{children}</section>
      <p className="small muted account-caption">Your everyday food journal. Calories, macros, and meals worth repeating.</p>
    </div>
  );
}

function SignIn({
  recovery,
  onRecovered,
  onExitRecovery,
  initialMode = 'signin',
  onClose,
}: {
  recovery: boolean;
  onRecovered: () => void;
  onExitRecovery: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot';
  onClose?: () => void;
}) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const title = recovery
    ? 'Choose a new password.'
    : mode === 'signup'
    ? 'Make yourself at home.'
    : mode === 'forgot'
    ? 'Reset your password.'
    : 'Welcome back.';

  return (
    <AccountShell onClose={onClose}>
      <span className="eyebrow">Your Portion account</span>
      <h1>{title}</h1>
      <p className="muted small">
        {recovery
          ? 'Save your new password to return to your journal.'
          : 'Keep your meals, usuals, labels, and targets together across devices.'}
      </p>

      {/* Mode switch tabs */}
      {!recovery && (
        <div className="auth-tab-switch" role="group" aria-label="Account action">
          <button
            disabled={busy}
            aria-pressed={mode === 'signin'}
            className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
          >
            Sign In
          </button>
          <button
            disabled={busy}
            aria-pressed={mode === 'signup'}
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
          >
            Create Account
          </button>
        </div>
      )}

      <form onSubmit={async event => {
        event.preventDefault();
        if (!supabase || busy) return;
        const form = new FormData(event.currentTarget);
        const email = String(form.get('email') || '').trim();
        const password = String(form.get('password') || '');
        setBusy(true); setError(''); setMessage('');
        try {
          const redirect = `${location.origin}/`;
          if (recovery) {
            const result = await supabase.auth.updateUser({ password });
            if (result.error) throw result.error;
            onRecovered();
          } else if (mode === 'signin') {
            const result = await supabase.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
          } else if (mode === 'signup') {
            const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
            if (result.error) throw result.error;
            if (!result.data.session) {
              setMessage('Check your email to confirm your account, then sign in. Already registered? Use Sign in or Reset password.');
            }
          } else {
            const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect });
            if (result.error) throw result.error;
            setMessage('If an account exists for this email, a reset link has been requested. Check your inbox.');
          }
        } catch (err) {
          const code = (err as { code?: string }).code;
          setError(
            code === 'over_email_send_rate_limit'
              ? 'Email delivery is rate limited. Please wait before requesting another link.'
              : code === 'email_address_not_authorized'
              ? 'Supabase’s default email service only sends to project team addresses. Use your Supabase account email, or configure SMTP in Supabase.'
              : (err as Error).message || 'Could not reach the account service. Try again.'
          );
        } finally {
          setBusy(false);
        }
      }}>
        <fieldset disabled={busy} className="plain-fieldset">
          {!recovery && (
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
            </label>
          )}
          {(recovery || mode !== 'forgot') && (
            <label>
              {recovery ? 'New password' : 'Password'}
              <input
                name="password"
                type="password"
                autoComplete={recovery || mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={recovery || mode === 'signup' ? 8 : 1}
                maxLength={128}
                required
              />
            </label>
          )}
          {(recovery || mode === 'signup') && <p className="small muted">Use at least 8 characters.</p>}
          {error && <p role="alert" className="error-message">{error}</p>}
          {message && <p role="status" className="notice">{message}</p>}
          <button className="button primary full">
            {busy
              ? 'Please wait…'
              : recovery
              ? 'Save new password'
              : mode === 'signup'
              ? 'Create account'
              : mode === 'forgot'
              ? 'Send reset link'
              : 'Sign in'}
            <Icon name="arrow" size={17} />
          </button>
        </fieldset>
      </form>

      {!recovery && (
        <div className="account-links">
          {mode === 'signin' ? (
            <>
              <button disabled={busy} className="text-button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>
                Need an account? Sign up
              </button>
              <button disabled={busy} className="text-button small" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}>
                Forgot password?
              </button>
            </>
          ) : (
            <button disabled={busy} className="text-button" onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>
              Already have an account? Sign in
            </button>
          )}
        </div>
      )}

      {recovery && (
        <button className="text-button account-links" disabled={busy} onClick={onExitRecovery}>
          Back to sign in
        </button>
      )}

      <p className="small muted account-privacy">
        Supabase manages your account and saved journal. Read how we handle your data in our <a href="/privacy.html">privacy notice</a> and <a href="/terms.html">beta terms</a>.
      </p>
    </AccountShell>
  );
}

export default function AccountGate({ children }: { children: (session: Session | null) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [recovery, setRecovery] = useState(() => new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery');
  const [authModal, setAuthModal] = useState<'signin' | 'signup' | null>(() => {
    const hash = location.hash.toLowerCase();
    if (hash === '#signin' || hash === '#login') return 'signin';
    if (hash === '#signup' || hash === '#register') return 'signup';
    return null;
  });
  const [server, setServer] = useState<{ authRequired: boolean; cloudConfigured: boolean } | null>(null);
  const [error, setError] = useState('');

  async function checkServer() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error();
      setServer(await res.json());
      setError('');
    } catch {
      setError('Could not connect to the Portion server. Start npm run dev locally, or check your deployment.');
    }
  }

  useEffect(() => {
    void checkServer();
    if (!supabase) return;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setAuthLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        if (error) setError('Could not read your sign-in session. Clear the expired session or sign in again.');
        setSession(data.session);
        setAuthLoading(false);
      }
    }).catch(() => {
      if (active) {
        setError('Account service unavailable. Reload and try again.');
        setAuthLoading(false);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const setupIssue = cloudSetupError || (server?.authRequired && (!supabase || !server.cloudConfigured)
    ? 'Account access is temporarily unavailable. Please try again later or contact Portion.'
    : supabase && server && !server.authRequired ? 'Account access needs a server configuration update.' : '');
  const showLanding = new URLSearchParams(location.search).get('page') === 'home'
    || ((!session && !recovery) && Boolean(supabase || server?.authRequired || setupIssue || error));

  // Public product information remains usable even when account services are down.
  if (showLanding) {
    const accountIssue = setupIssue || error || (!server || authLoading ? 'Connecting to the account service…' : !supabase ? 'Accounts are unavailable in device-only local mode. Open the local journal to try manual logging.' : '');
    return <LandingPage
      onSignIn={() => setAuthModal('signin')}
      onSignUp={() => setAuthModal('signup')}
      authModal={authModal ? <Modal title={authModal === 'signup' ? 'Create your Portion account' : 'Sign in to Portion'} className="auth-dialog" onClose={() => setAuthModal(null)}>
        {accountIssue ? <div><p role="status" className="notice">{accountIssue}</p><button className="button secondary" onClick={() => void checkServer()}>Retry connection</button>{!supabase && !server?.authRequired && <a className="button secondary" href="/">Open local journal</a>}</div> : <SignIn
          key={authModal} recovery={false} initialMode={authModal}
          onRecovered={() => setRecovery(false)} onExitRecovery={() => setRecovery(false)}
        />}
      </Modal> : null}
    />;
  }

  if (cloudSetupError || (server?.authRequired && (!supabase || !server.cloudConfigured)) || (supabase && server && !server.authRequired)) {
    return (
      <AccountShell>
        <h1>Connect your cloud journal.</h1>
        <p className="muted">{cloudSetupError || 'Set up the free Supabase project and environment variables, then restart or redeploy Portion.'}</p>
        <ol className="setup-steps">
          <li>Create a Free project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase</a>.</li>
          <li>Run the SQL in <code>supabase/migrations/202610020001_portion.sql</code>.</li>
          <li>Add the public and server variables listed in <code>.env.example</code>. Keep the secret key on the server.</li>
        </ol>
        <p className="small muted">Follow <code>docs/hosting.md</code> in the project. Your existing device data has been preserved.</p>
        <button className="button secondary" onClick={() => location.reload()}>Check setup again</button>
      </AccountShell>
    );
  }

  if (error) {
    return (
      <AccountShell>
        <h1>Connection needed.</h1>
        <p role="alert" className="error-message">{error}</p>
        <button className="button secondary" onClick={() => location.reload()}>Retry connection</button>
      </AccountShell>
    );
  }

  if (!server || authLoading) {
    return (
      <AccountShell>
        <p role="status">Connecting to your journal…</p>
      </AccountShell>
    );
  }

  if (supabase && (!session || recovery)) {
    if (recovery) {
      return (
        <SignIn
          recovery={recovery}
          onRecovered={() => { setRecovery(false); location.hash = ''; }}
          onExitRecovery={() => {
            void supabase?.auth.signOut({ scope: 'local' }).then(({ error }) => {
              if (!error) { setRecovery(false); location.hash = ''; }
            });
          }}
        />
      );
    }

  }

  return children(session);
}
