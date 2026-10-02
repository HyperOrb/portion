import { useEffect, useRef, type ReactNode } from 'react';
import { proteinFeedback, type Nutrients } from './domain';
import { supabase } from './cloud';

export const nutrientKeys = ['calories', 'protein', 'carbs', 'fat'] as const;
export const nutrientNames = { calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };
export const number = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
// randomUUID requires HTTPS; getRandomValues also works on a phone's local HTTP origin.
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    plate: <><path d="M3 12h18a9 9 0 0 1-18 0Z" /><path d="M13 9c0-5 3-7 8-6-1 4-3 6-8 6Zm-1 3 5-6" /></>,
    journal: <><rect x="5" y="3" width="15" height="18" rx="2" /><path d="M9 3v18M12 8h5m-5 4h5m-5 4h3M3 7h3m-3 5h3m-3 5h3" /></>,
    bookmark: <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z" />,
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="8" cy="18" r="2" fill="currentColor" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    left: <path d="m15 5-7 7 7 7" />,
    right: <path d="m9 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5Z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.2" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.plate}</svg>;
}

export function MacroLine({ totals }: { totals: Nutrients }) {
  return <div className="macro-line">{(['protein', 'carbs', 'fat'] as const).map(key => <span key={key}><i className={`dot ${key}`} /><b>{number(totals[key])} g</b> {nutrientNames[key].toLowerCase()}</span>)}</div>;
}

export function ProteinNote({ protein, target, mealProtein }: { protein: number; target?: number; mealProtein?: number }) {
  if (!target) return null;
  return <div className="protein-note" aria-label="Protein feedback"><span className="summary-label"><i className="dot protein" />Protein first</span><p className="small">{proteinFeedback(protein, target, mealProtein)}</p></div>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="modal-title">
    <div className="modal-body"><div className="section-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>{children}</div>
  </dialog>;
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const headers: Record<string, string> = body === undefined ? {} : { 'Content-Type': 'application/json' };
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({ error: 'The local server is unavailable. Run npm run dev and try again.' }));
  if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
  return result as T;
}
