import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { freshData, validateBackup, type AppData } from './domain';

const url = import.meta.env?.VITE_SUPABASE_URL?.trim();
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function configurationError() {
  if (Boolean(url) !== Boolean(key)) return 'Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then rebuild.';
  if (key && !key.startsWith('sb_publishable_')) return 'Use the Supabase publishable key for the browser. Secret keys must stay on the server.';
  if (url) {
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:') return 'Use your project’s HTTPS Supabase URL.'; }
    catch { return 'VITE_SUPABASE_URL must be your complete HTTPS project URL.'; }
  }
  return '';
}
export const cloudSetupError = configurationError();
export const supabase = url && key && !cloudSetupError ? createClient(url, key, {
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) },
}) : null;

export class CloudConflict extends Error {
  constructor() { super('Your journal changed on another device or tab. Export the unsaved version if needed, reload the cloud journal, then apply your changes again.'); }
}

export async function readJournal(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from('journals').select('data,revision').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Could not load your cloud journal. Check the connection and Supabase database setup, then retry. Your device journal is preserved.');
  if (!data) return { data: freshData(), revision: 0 };
  if (!Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('The cloud journal has an invalid revision. Export its data from Supabase before repairing it.');
  return { data: validateBackup(data.data), revision: data.revision as number };
}

export async function writeJournal(client: SupabaseClient, userId: string, next: AppData, revision: number) {
  const data = validateBackup(next);
  // ponytail: one snapshot per account, capped at 5 MB; split meals into rows if journals outgrow this.
  if (new TextEncoder().encode(JSON.stringify(data)).length > 5 * 1024 * 1024) throw new Error('This journal is too large for a cloud save. Export a backup before reducing it.');
  // Compare-and-swap prevents an old tab or device from silently overwriting newer data.
  const table = client.from('journals');
  const result = revision === 0
    ? await table.insert({ user_id: userId, data }).select('revision').single()
    : await table.update({ data }).eq('user_id', userId).eq('revision', revision).select('revision').maybeSingle();
  if (result.error?.code === '23505' || (!result.error && !result.data)) throw new CloudConflict();
  if (result.error || !result.data) throw new Error('Cloud save failed. Your changes have not been saved. Check your connection, then retry.');
  if (!Number.isSafeInteger(result.data.revision) || result.data.revision <= revision) throw new Error('Cloud save could not be confirmed. Reload the cloud journal before trying again.');
  return result.data.revision as number;
}

export function mergeDeviceJournal(account: AppData, device: AppData): AppData {
  const merged = structuredClone(account);
  for (const key of ['meals', 'usualMeals', 'labels'] as const) {
    const ids = new Set(account[key].map(item => item.id));
    // Existing account copies win when this device was imported previously.
    Object.assign(merged, { [key]: [...account[key], ...device[key].filter(item => !ids.has(item.id))] });
  }
  if (!account.meals.length && !account.usualMeals.length && !account.labels.length) merged.targets = structuredClone(device.targets);
  return validateBackup(merged);
}
