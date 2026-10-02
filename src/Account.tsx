import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudSetupError, supabase } from './cloud';
import { Icon } from './ui';

function AccountShell({ children }: { children: ReactNode }) {
  return <main className="account-page"><a className="brand" href="#"><span className="brand-mark"><Icon name="plate" size={25} /></span>portion<span className="brand-period">.</span></a><section className="panel account-panel">{children}</section><p className="small muted account-caption">Your everyday food journal. Calories, macros, and meals worth repeating.</p></main>;
}

function SignIn({ recovery, onRecovered, onExitRecovery }: { recovery: boolean; onRecovered: () => void; onExitRecovery: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const title = recovery ? 'Choose a new password.' : mode === 'signup' ? 'Make yourself at home.' : mode === 'forgot' ? 'Reset your password.' : 'Welcome back.';
  return <AccountShell><span className="eyebrow">Your Portion account</span><h1>{title}</h1><p className="muted small">{recovery ? 'Save your new password to return to your journal.' : 'Keep your meals, usuals, labels, and targets together across devices.'}</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (!supabase || busy) return;
      const form = new FormData(event.currentTarget);
      const email = String(form.get('email') || '').trim(); const password = String(form.get('password') || '');
      setBusy(true); setError(''); setMessage('');
      try {
        const redirect = `${location.origin}/`;
        if (recovery) { const result = await supabase.auth.updateUser({ password }); if (result.error) throw result.error; onRecovered(); }
        else if (mode === 'signin') { const result = await supabase.auth.signInWithPassword({ email, password }); if (result.error) throw result.error; }
        else if (mode === 'signup') {
          const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
          if (result.error) throw result.error;
          if (!result.data.session) setMessage('Check your email to confirm your account, then sign in. Already registered? Use Sign in or Reset password.');
        } else { const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect }); if (result.error) throw result.error; setMessage('If an account exists for this email, a reset link has been requested. Check your inbox.'); }
      } catch (err) {
        const code = (err as { code?: string }).code;
        setError(code === 'over_email_send_rate_limit' ? 'Email delivery is rate limited. Please wait before requesting another link.' : code === 'email_address_not_authorized' ? 'Supabase’s default email service only sends to project team addresses. Use your Supabase account email, or configure SMTP in Supabase.' : (err as Error).message || 'Could not reach the account service. Try again.');
      } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="plain-fieldset">
        {!recovery && <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>}
        {(recovery || mode !== 'forgot') && <label>{recovery ? 'New password' : 'Password'}<input name="password" type="password" autoComplete={recovery || mode === 'signup' ? 'new-password' : 'current-password'} minLength={recovery || mode === 'signup' ? 8 : 1} maxLength={128} required /></label>}
        {(recovery || mode === 'signup') && <p className="small muted">Use at least 8 characters.</p>}
        {error && <p role="alert" className="error-message">{error}</p>}{message && <p role="status" className="notice">{message}</p>}
        <button className="button primary full">{busy ? 'Please wait…' : recovery ? 'Save new password' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}<Icon name="arrow" size={17} /></button>
      </fieldset>
    </form>
    {!recovery && <div className="account-links">{mode === 'signin' ? <><button disabled={busy} className="text-button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Create an account</button><button disabled={busy} className="text-button small" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}>Forgot password?</button></> : <button disabled={busy} className="text-button" onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>Back to sign in</button>}</div>}
    {recovery && <button className="text-button account-links" disabled={busy} onClick={onExitRecovery}>Back to sign in</button>}
    <p className="small muted account-privacy">Sign-in and confirmed journals are stored by Supabase. Your existing device journal stays on this browser until you choose to import it. Meal text is sent to Google only when you request an estimate.</p>
  </AccountShell>;
}

export default function AccountGate({ children }: { children: (session: Session | null) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [recovery, setRecovery] = useState(() => new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery');
  const [server, setServer] = useState<{ authRequired: boolean; cloudConfigured: boolean } | null>(null);
  const [error, setError] = useState('');
  async function checkServer() {
    try { const res = await fetch('/api/config'); if (!res.ok) throw new Error(); setServer(await res.json()); setError(''); }
    catch { setError('Could not connect to the Portion server. Start npm run dev locally, or check your deployment.'); }
  }
  useEffect(() => {
    void checkServer();
    if (!supabase) return;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, next) => { if (!active) return; setSession(next); setAuthLoading(false); if (event === 'PASSWORD_RECOVERY') setRecovery(true); if (event === 'SIGNED_OUT') setRecovery(false); });
    void supabase.auth.getSession().then(({ data, error }) => { if (active) { if (error) setError('Could not read your sign-in session. Clear the expired session or sign in again.'); setSession(data.session); setAuthLoading(false); } }).catch(() => { if (active) { setError('Account service unavailable. Reload and try again.'); setAuthLoading(false); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  if (cloudSetupError || (server?.authRequired && (!supabase || !server.cloudConfigured)) || (supabase && server && !server.authRequired)) return <AccountShell><h1>Connect your cloud journal.</h1><p className="muted">{cloudSetupError || 'Set up the free Supabase project and environment variables, then restart or redeploy Portion.'}</p><ol className="setup-steps"><li>Create a Free project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase</a>.</li><li>Run the SQL in <code>supabase/migrations/202610020001_portion.sql</code>.</li><li>Add the public and server variables listed in <code>.env.example</code>. Keep the secret key on the server.</li></ol><p className="small muted">Follow <code>docs/hosting.md</code> in the project. Your existing device data has been preserved.</p><button className="button secondary" onClick={() => location.reload()}>Check setup again</button></AccountShell>;
  if (error) return <AccountShell><h1>Connection needed.</h1><p role="alert" className="error-message">{error}</p><button className="button secondary" onClick={() => location.reload()}>Retry connection</button></AccountShell>;
  if (!server || authLoading) return <AccountShell><p role="status">Connecting to your journal…</p></AccountShell>;
  if (supabase && (!session || recovery)) return <SignIn recovery={recovery} onRecovered={() => { setRecovery(false); location.hash = ''; }} onExitRecovery={() => { void supabase?.auth.signOut({ scope: 'local' }).then(({ error }) => { if (!error) { setRecovery(false); location.hash = ''; } }); }} />;
  return children(session);
}
