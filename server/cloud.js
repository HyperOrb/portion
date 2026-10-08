import { createClient } from '@supabase/supabase-js';
import { ApiError } from './gemini.js';

export function cloudRequired(env) {
  return Boolean(env.VERCEL || env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_SECRET_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

export function createCloud(env) {
  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  try {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
    });
  } catch { return null; }
}

export async function requireUser(req, cloud) {
  if (!cloud) throw new ApiError(503, 'CLOUD_SETUP_REQUIRED', 'Cloud accounts need Supabase configuration on the server. Follow docs/hosting.md, then redeploy.');
  const token = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token || token.length > 12000) throw new ApiError(401, 'SIGN_IN_REQUIRED', 'Sign in to your Portion account to use this service.');
  let result;
  try { result = await cloud.auth.getUser(token); }
  catch { throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Account verification is unavailable. Please try again.'); }
  if (result.error || !result.data?.user?.id || result.data.user.is_anonymous) throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
  return result.data.user;
}

export async function reserveParse(cloud, dailyLimit, intervalSeconds, lease) {
  let result;
  try { result = await cloud.rpc('reserve_parse', { p_daily_limit: dailyLimit, p_interval_seconds: intervalSeconds, p_lease: lease }); }
  catch { throw new ApiError(503, 'BUDGET_UNAVAILABLE', 'The usage safeguard is unavailable. No AI request was sent. Check the Supabase setup and try again.'); }
  if (result.error || typeof result.data?.allowed !== 'boolean') throw new ApiError(503, 'BUDGET_UNAVAILABLE', 'The usage safeguard is unavailable. Run the database migration before using AI.');
  if (!result.data.allowed) {
    if (result.data.reason === 'daily') throw new ApiError(429, 'DAILY_SAFEGUARD', `The app’s shared ${dailyLimit}-request daily safeguard has been reached. It resets at midnight UTC. You can still log usual meals or enter foods manually.`);
    throw new ApiError(429, 'REQUEST_PACING', 'Please wait a moment before estimating another meal.', Math.max(1, Math.min(3600, Number(result.data.retryAfterSeconds) || 3)));
  }
}

export async function releaseParse(cloud, lease) {
  // A failed release expires after 60 seconds. Never turn a successful parse into a retry.
  try { await cloud.rpc('release_parse', { p_lease: lease }); } catch { /* Lease expiry handles disconnects. */ }
}
