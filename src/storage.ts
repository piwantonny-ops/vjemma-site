import { useEffect, useState } from 'react';
import type { AppSettings, AppState } from './types';

export const BRAND_LOGO_URL = '/assets/aistudio/logo_c90328c3.jpg';
export const WHATSAPP_DISPLAY_PHONE = '0776043203';
export const WHATSAPP_ADMIN_PHONE = '256776043203';
export const LOCKED_ADMIN_EMAIL = 'piwantonny@gmail.com';
export const DEFAULT_GENRES_LIST = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Kids',
  'Musical',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Sport',
  'Thriller',
  'War',
  'Western',
  'Nollywood',
  'Bollywood',
  'Hollywood',
  'Ugandan Movies',
  'VJ Translated',
  'Korean Drama',
  'Chinese Drama',
  'Turkish Series',
  'Indian Series',
  'Anime',
] as const;

export const DEFAULT_CATEGORIES_LIST = [
  'New Releases',
  'Trending Now',
  'Top Rated',
  'Most Watched',
  'VJ Emma Exclusive',
  'Action Movies',
  'Comedy Movies',
  'Horror Movies',
  'Series & Seasons',
  'Live TV',
  'Coming Soon',
  'VIP Only',
] as const;

export const DEFAULT_GENRE_LINE = DEFAULT_GENRES_LIST.join(', ');
export const DEFAULT_CATEGORY_LINE = DEFAULT_CATEGORIES_LIST.join(', ');
export const LIVE_SYNC_CHANNEL = 'vj_emma_live_sync';

export function parseGenreLine(line?: string, fallbackLine: string = DEFAULT_GENRE_LINE): string[] {
  const source = line !== undefined ? line : fallbackLine;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const part of source.split(',')) {
    const clean = part.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

export function parseCategoryLine(line?: string): string[] {
  return parseGenreLine(line, DEFAULT_CATEGORY_LINE);
}

export function mergeTagLines(savedLine: string | undefined, defaultsList: readonly string[]): string {
  const existing = savedLine ? parseGenreLine(savedLine, '') : [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of [...defaultsList, ...existing]) {
    const clean = item.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result.join(', ');
}

export function parseMovieGenres(...sources: (string | string[] | undefined)[]): string[] {
  const tokens: string[] = [];
  for (const src of sources) {
    if (!src) continue;
    if (Array.isArray(src)) {
      for (const item of src) {
        if (typeof item === 'string') tokens.push(item);
      }
    } else if (typeof src === 'string') {
      tokens.push(...src.split(','));
    }
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const part of tokens) {
    const clean = part.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

export function isVipLabel(label?: string): boolean {
  return (label || '').trim().toUpperCase().includes('VIP');
}

export const DB_KEY = 'vj_emma_truelight_v2';
const IDB_NAME = 'vj_emma_media_store';
const IDB_STORE = 'files';
const objectUrlCache: Record<string, string> = {};
let idbInstance: IDBDatabase | null = null;

export function openMediaDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (idbInstance) {
      resolve(idbInstance);
      return;
    }
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = (e) => {
      idbInstance = (e.target as IDBOpenDBRequest).result;
      resolve(idbInstance);
    };
    req.onerror = () => resolve(null);
  });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(blob);
  });
}

export async function saveBlobToIDB(key: string, blob: Blob): Promise<string> {
  const db = await openMediaDB();
  if (!db) {
    return blobToDataURL(blob);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => {
      objectUrlCache['idb://' + key] = URL.createObjectURL(blob);
      resolve('idb://' + key);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function resolveMediaUrl(ref?: string): Promise<string> {
  if (!ref) return '';
  if (!ref.startsWith('idb://')) return ref;
  if (objectUrlCache[ref]) return objectUrlCache[ref];
  const key = ref.replace('idb://', '');
  const db = await openMediaDB();
  if (!db) return '';
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => {
      if (req.result) {
        const url = URL.createObjectURL(req.result as Blob);
        objectUrlCache[ref] = url;
        resolve(url);
      } else {
        resolve('');
      }
    };
    req.onerror = () => resolve('');
  });
}

export function useResolvedMedia(ref?: string): string {
  const [url, setUrl] = useState<string>(() => {
    if (!ref) return '';
    if (!ref.startsWith('idb://')) return ref;
    return objectUrlCache[ref] || '';
  });

  useEffect(() => {
    let cancelled = false;
    if (!ref) {
      setUrl('');
      return;
    }
    if (!ref.startsWith('idb://')) {
      setUrl(ref);
      return;
    }
    if (objectUrlCache[ref]) {
      setUrl(objectUrlCache[ref]);
      return;
    }
    resolveMediaUrl(ref).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  return url;
}

const SESSION_KEY = 'vj_emma_session_v1';

export function createDefaultState(): AppState {
  const parsedGenres = parseGenreLine(DEFAULT_GENRE_LINE);
  const parsedCategories = parseCategoryLine(DEFAULT_CATEGORY_LINE);
  return {
    wallet: 0,
    walletTransactions: [],
    clients: 0,
    users: [],
    movies: [],
    banners: [],
    seasons: [],
    episodes: [],
    liveTvChannels: [],
    categories: parsedCategories.map((name, idx) => ({ id: `cat_${idx}`, name })),
    genres: parsedGenres.map((name, idx) => ({ id: `gen_${idx}`, name })),
    likes: {},
    comments: {},
    adminEmail: LOCKED_ADMIN_EMAIL,
    adminPassword: '',
    currentUser: null,
    isAdminLoggedIn: false,
    settings: {
      appName: 'VJ EMMA - TRUE LIGHT PRODUCTION',
      r2Endpoint: '',
      r2Links: ['', '', '', '', ''],
      whatsappKey: '',
      socialLinks: '',
      whatsappUrl: 'https://wa.me/256776043203',
      youtubeUrl: '',
      facebookUrl: '',
      tiktokUrl: '',
      genreLine: DEFAULT_GENRE_LINE,
      categoryLine: DEFAULT_CATEGORY_LINE,
      movieTags: ['VIP'],
      paymentPlans: [
        { id: 'plan_weekly', name: 'Weekly', price: 5000, days: 7 },
        { id: 'plan_monthly', name: 'Monthly', price: 15000, days: 30 },
        { id: 'plan_vip', name: 'VIP', price: 30000, days: 30 },
      ],
      priceWeekly: 5000,
      priceMonthly: 15000,
      priceVip: 30000,
      showPosterLabel: true,
      showPosterRating: true,
      showPosterSocialBar: true,
      showPosterYear: true,
      showPosterActors: true,
      showPosterDescription: true,
    },
  };
}

export function loadState(): AppState {
  const defaults = createDefaultState();
  try {
    // Clean up legacy localStorage cache so Clients/Payments/Catalog NEVER read stale browser cache
    localStorage.removeItem(DB_KEY);
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const restoredUser =
      parsed.currentUser && parsed.currentUser.role !== 'admin' ? parsed.currentUser : null;

    return {
      ...defaults,
      adminEmail: LOCKED_ADMIN_EMAIL,
      currentUser: restoredUser,
      isAdminLoggedIn: false,
    };
  } catch {
    return defaults;
  }
}

export function saveState(state: AppState): void {
  try {
    // Only persist non-privileged customer session in browser; Admin auth lives in memory and all data lives in Cloudflare D1 (vjemmadb)
    const sessionPayload = {
      currentUser: state.currentUser && state.currentUser.role !== 'admin' ? state.currentUser : null,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionPayload));
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const ch = new BroadcastChannel(LIVE_SYNC_CHANNEL);
      ch.postMessage({ type: 'state-updated', at: Date.now() });
      ch.close();
    }
  } catch (err) {
    console.warn('Session storage save issue', err);
  }
}

export function sanitizeAssetUrl(raw?: string): string {
  const val = (raw || '').trim();
  if (!val) return '';
  if (/^(javascript|vbscript|data:text\/html):/i.test(val)) return '';
  if (
    val.startsWith('/') ||
    val.startsWith('idb://') ||
    val.startsWith('blob:') ||
    val.startsWith('data:image/') ||
    /^https?:\/\//i.test(val)
  ) {
    return val;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(val)) {
    return `https://${val}`;
  }
  return '';
}

export function normalizeSocialUrl(
  raw?: string,
  platformOrWhatsApp?: boolean | 'whatsapp' | 'youtube' | 'facebook' | 'tiktok'
): string {
  const val = (raw || '').trim();
  if (!val) return '';
  if (/^(javascript|vbscript|data):/i.test(val)) return '';
  const platform =
    platformOrWhatsApp === true
      ? 'whatsapp'
      : platformOrWhatsApp === false || !platformOrWhatsApp
        ? undefined
        : platformOrWhatsApp;

  if (platform === 'whatsapp' && /^[+\d\s()-]{7,20}$/.test(val)) {
    const digits = val.replace(/[^\d]/g, '');
    const intl = digits.startsWith('0') ? `256${digits.slice(1)}` : digits;
    return `https://wa.me/${intl}`;
  }
  if (/^https?:\/\//i.test(val)) return val;

  if (platform === 'youtube' && !val.includes('.') && !val.includes('/')) {
    const clean = val.startsWith('@') ? val : `@${val}`;
    return `https://www.youtube.com/${clean}`;
  }
  if (platform === 'tiktok' && !val.includes('.') && !val.includes('/')) {
    const clean = val.startsWith('@') ? val : `@${val}`;
    return `https://www.tiktok.com/${clean}`;
  }
  if (platform === 'facebook' && !val.includes('.') && !val.includes('/')) {
    const clean = val.replace(/^@/, '');
    return `https://www.facebook.com/${clean}`;
  }

  return `https://${val}`;
}

export interface SocialPlatformItem {
  key: 'whatsapp' | 'youtube' | 'facebook' | 'tiktok';
  name: string;
  href: string;
  badgeClass: string;
}

export function getSocialPlatformItems(settings?: Partial<AppSettings>): SocialPlatformItem[] {
  const rawWhatsapp = settings?.whatsappUrl?.trim();
  return [
    {
      key: 'whatsapp',
      name: 'WhatsApp',
      href: normalizeSocialUrl(
        rawWhatsapp || `https://wa.me/${WHATSAPP_ADMIN_PHONE}`,
        'whatsapp'
      ),
      badgeClass: 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/70',
    },
    {
      key: 'youtube',
      name: 'YouTube',
      href: normalizeSocialUrl(settings?.youtubeUrl, 'youtube'),
      badgeClass: 'border-red-500/60 bg-red-950/60 text-red-300 hover:bg-red-900/70',
    },
    {
      key: 'facebook',
      name: 'Facebook',
      href: normalizeSocialUrl(settings?.facebookUrl, 'facebook'),
      badgeClass: 'border-blue-500/60 bg-blue-950/60 text-blue-300 hover:bg-blue-900/70',
    },
    {
      key: 'tiktok',
      name: 'TikTok',
      href: normalizeSocialUrl(settings?.tiktokUrl, 'tiktok'),
      badgeClass: 'border-[#d4af37]/70 bg-[#1a1326] text-[#f0cf65] hover:bg-[#6a0dad]/50',
    },
  ];
}

