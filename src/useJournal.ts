import { useEffect, useRef, useState } from 'react';
import { freshData, loadData, saveData, STORAGE_KEY, validateBackup, type AppData } from './domain';
import { readJournal, supabase, writeJournal } from './cloud';

export function useJournal(userId?: string) {
  const [initial] = useState(() => {
    if (userId) return { data: freshData(), error: '' };
    try { return { data: loadData(), error: '' }; }
    catch (error) { return { data: freshData(), error: (error as Error).message }; }
  });
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [loading, setLoading] = useState(Boolean(userId));
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState<AppData | null>(null);
  const revision = useRef(0);
  const locked = useRef(false);
  const ready = useRef(!userId);
  const alive = useRef(true);
  const lastStored = useRef<string | null>(null);

  async function reload() {
    if (!userId || !supabase || locked.current) return;
    locked.current = true; ready.current = false; setLoading(true); setLoadError('');
    try {
      const result = await readJournal(supabase, userId);
      if (!alive.current) return;
      revision.current = result.revision; setData(result.data); setUnsaved(null); ready.current = true;
    } catch (error) { if (alive.current) setLoadError((error as Error).message); }
    finally { locked.current = false; if (alive.current) setLoading(false); }
  }

  useEffect(() => {
    alive.current = true;
    if (userId) void reload();
    else {
      try { lastStored.current = localStorage.getItem(STORAGE_KEY); } catch { /* Initial read reports errors. */ }
    }
    const sync = (event: StorageEvent) => {
      if (userId || (event.key !== STORAGE_KEY && event.key !== null)) return;
      try { const next = loadData(); lastStored.current = localStorage.getItem(STORAGE_KEY); setData(next); setStorageError(''); }
      catch (error) { setStorageError((error as Error).message); }
    };
    window.addEventListener('storage', sync);
    return () => { alive.current = false; window.removeEventListener('storage', sync); };
  }, [userId]);

  async function commit(next: AppData, recovery = false): Promise<void> {
    if (locked.current) throw new Error('A save or reload is still in progress. Please wait.');
    if (!ready.current) throw new Error('Reload your cloud journal before saving.');
    if (storageError && !recovery) throw new Error('Restore a valid backup before saving, so the preserved log isn’t overwritten.');
    const validated = validateBackup(next);
    locked.current = true; setSaving(true);
    try {
      if (userId && supabase) {
        revision.current = await writeJournal(supabase, userId, validated, revision.current);
      } else {
        if (!recovery && localStorage.getItem(STORAGE_KEY) !== lastStored.current) throw new Error('The journal changed in another tab. Reload the page before saving.');
        saveData(validated); lastStored.current = localStorage.getItem(STORAGE_KEY);
      }
      if (alive.current) { setData(validated); setStorageError(''); setUnsaved(null); }
    } catch (error) {
      if (userId && alive.current) { setUnsaved(validated); ready.current = false; }
      throw error;
    } finally { locked.current = false; if (alive.current) setSaving(false); }
  }

  return { data, storageError, loading, loadError, saving, unsaved, commit, reload };
}
