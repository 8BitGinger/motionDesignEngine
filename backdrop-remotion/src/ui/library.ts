import { normalizeConfig } from '../engine/SeedEngine';
import type { BackdropConfig } from '../engine/types';

/** Everything a share link carries: the look plus the output settings it was designed for. */
export interface SharedState {
  cfg: BackdropConfig;
  aspect?: string;
  quality?: string;
  customW?: number;
  customH?: number;
  fps?: number;
  duration?: number;
  loop?: boolean;
  transparent?: boolean;
}

export interface LibraryEntry {
  id: string;
  cfg: BackdropConfig;
  at: number;
}

const FAV_KEY = 'backdrop.favorites.v1', HIST_KEY = 'backdrop.history.v1', HIST_MAX = 30;

// Storage can be unavailable (private windows, blocked site data): every access is guarded.
const read = (k: string): LibraryEntry[] => {
  try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const write = (k: string, v: LibraryEntry[]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const cfgId = (cfg: BackdropConfig) => {
  // Small stable hash of the config, used to de-duplicate entries.
  const s = JSON.stringify(cfg);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

export const loadFavorites = () => read(FAV_KEY);
export const loadHistory = () => read(HIST_KEY);

export function toggleFavorite(cfg: BackdropConfig): LibraryEntry[] {
  const id = cfgId(cfg), list = read(FAV_KEY);
  const next = list.some(e => e.id === id) ? list.filter(e => e.id !== id) : [{ id, cfg, at: Date.now() }, ...list];
  write(FAV_KEY, next);
  return next;
}

export function removeFavorite(id: string): LibraryEntry[] {
  const next = read(FAV_KEY).filter(e => e.id !== id);
  write(FAV_KEY, next);
  return next;
}

export function pushHistory(cfg: BackdropConfig): LibraryEntry[] {
  const id = cfgId(cfg), list = read(HIST_KEY).filter(e => e.id !== id);
  const next = [{ id, cfg, at: Date.now() }, ...list].slice(0, HIST_MAX);
  write(HIST_KEY, next);
  return next;
}

export function clearHistory(): LibraryEntry[] { write(HIST_KEY, []); return []; }

const b64urlEncode = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlDecode = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

export const encodeShare = (st: SharedState) => 'look=' + b64urlEncode(JSON.stringify(st));

/** Parse `#look=…` from a URL hash. Returns null when absent or invalid. */
export function decodeShare(hash: string): SharedState | null {
  const m = hash.match(/look=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const st = JSON.parse(b64urlDecode(m[1])) as SharedState;
    return { ...st, cfg: normalizeConfig(st.cfg) };
  } catch { return null; }
}
