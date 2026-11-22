import { useEffect, useState } from 'react';
import type { AppSettings, AppState } from './types';

export const BRAND_LOGO_URL = '/assets/aistudio/logo_c90328c3.jpg';
export const WHATSAPP_DISPLAY_PHONE = '0776043203';
export const WHATSAPP_ADMIN_PHONE = '256776043203';
export const LOCKED_ADMIN_EMAIL = 'piwantonny@gmail.com';
export const DEFAULT_GENRE_LINE =
  'Indian, Asian, Christian, Comedy, Action, Drama, Love, Family, Thriller, Horror, Documentary, Kids, VIP Movies, Lango Movies, Acholi Movies, Alur Movies';
export const LIVE_SYNC_CHANNEL = 'vj_emma_live_sync';

export function parseGenreLine(line?: string): string[] {
  const source = line !== undefined ? line : DEFAULT_GENRE_LINE;
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

export function createDefaultState(): AppState {
  const now = 1795302000000;
  const parsedGenres = parseGenreLine(DEFAULT_GENRE_LINE);
  return {
    wallet: 0,
    walletTransactions: [],
    clients: 0,
    users: [],
    movies: [
      {
        id: 'mov_sample_1',
        title: 'True Light Over Acholi',
        year: '2026',
        rating: '4.9',
        category: 'Christian',
        genre: 'Christian',
        actors: 'Okello Moses, Akello Grace, Opiyo Daniel',
        label: '',
        description: 'An inspiring Luo-translated faith story of hope, courage, and forgiveness.',
        poster: '/src/assets/images/poster_true_light_1795302097420.jpg',
        video: '',
        createdAt: now + 1,
      },
      {
        id: 'mov_sample_2',
        title: 'Night Strike Kampala',
        year: '2026',
        rating: '4.8',
        category: 'Action',
        genre: 'Action',
        actors: 'Odongo Victor, Aber Faith, Kizza Samuel',
        label: '',
        description: 'High-stakes undercover action translated in Luo by VJ Emma.',
        poster: '/src/assets/images/poster_night_strike_1795302098055.jpg',
        video: '',
        createdAt: now + 2,
      },
      {
        id: 'mov_sample_3',
        title: 'The Golden Throne',
        year: '2026',
        rating: '5.0',
        category: 'Drama',
        genre: 'Drama',
        actors: 'Komakech Brian, Apiyo Esther, Oloya Peter',
        label: '',
        description: 'A royal saga of leadership, betrayal, and honour brought home in Luo.',
        poster: '/src/assets/images/poster_golden_throne_1795302098341.jpg',
        video: '',
        createdAt: now + 3,
      },
      {
        id: 'mov_sample_4',
        title: 'Promise By The Nile',
        year: '2026',
        rating: '4.7',
        category: 'Acholi Movies',
        genre: 'Acholi Movies',
        actors: 'Onyango Denis, Adoch Mercy, Latim Ronald',
        label: '',
        description: 'A heartfelt family journey along the banks of the Nile in Luo.',
        poster: '/src/assets/images/poster_nile_promise_1795302098552.jpg',
        video: '',
        createdAt: now + 4,
      },
    ],
    banners: [],
    seasons: [],
    episodes: [],
    liveTvChannels: [],
    categories: parsedGenres.map((name, idx) => ({ id: `cat_${idx}`, name })),
    genres: parsedGenres.map((name, idx) => ({ id: `gen_${idx}`, name })),
    likes: {},
    comments: {},
    adminEmail: LOCKED_ADMIN_EMAIL,
    adminPassword: 'VJEMMA123',
    currentUser: null,
    isAdminLoggedIn: false,
    settings: {
      appName: 'VJ EMMA - TRUE LIGHT PRODUCTION',
      r2Endpoint: '',
      r2Links: ['', '', '', '', ''],
      pesapalKey: '',
      pesapalSecret: '',
      pesapalIpnUrl: '',
      whatsappKey: '',
      socialLinks: '',
      whatsappUrl: 'https://wa.me/256776043203',
      youtubeUrl: '',
      facebookUrl: '',
      tiktokUrl: '',
      genreLine: DEFAULT_GENRE_LINE,
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
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const defaults = createDefaultState();
    const savedR2 = Array.isArray(parsed.settings?.r2Links) ? parsed.settings!.r2Links : [];
    const normalizedR2 = [0, 1, 2, 3, 4].map(
      (idx) => savedR2[idx] ?? (idx === 0 ? parsed.settings?.r2Endpoint || '' : '')
    );

    const genreLine =
      typeof parsed.settings?.genreLine === 'string' && parsed.settings.genreLine.trim().length > 0
        ? parsed.settings.genreLine
        : DEFAULT_GENRE_LINE;
    const parsedGenreNames = parseGenreLine(genreLine);
    const syncedGenres = parsedGenreNames.map((name, idx) => ({ id: `gen_${idx}`, name }));
    const syncedCategories = parsedGenreNames.map((name, idx) => ({ id: `cat_${idx}`, name }));

    const rawPlans = Array.isArray(parsed.settings?.paymentPlans)
      ? parsed.settings!.paymentPlans
      : [];
    const normalizedPlans =
      rawPlans.length > 0
        ? rawPlans
            .map((p, idx) => ({
              id: String(p.id || `plan_${idx}_${Date.now()}`),
              name: String(p.name || 'Plan').trim(),
              price: Math.max(0, Number(p.price) || 0),
              days: Math.max(1, Number(p.days) || 1),
            }))
            .filter((p) => p.name)
        : [
            {
              id: 'plan_weekly',
              name: 'Weekly',
              price: Number(parsed.settings?.priceWeekly || 5000),
              days: 7,
            },
            {
              id: 'plan_monthly',
              name: 'Monthly',
              price: Number(parsed.settings?.priceMonthly || 15000),
              days: 30,
            },
            {
              id: 'plan_vip',
              name: 'VIP',
              price: Number(parsed.settings?.priceVip || 30000),
              days: 30,
            },
          ];

    const migratedPassword =
      !parsed.adminPassword || parsed.adminPassword === 'admin123' || parsed.adminPassword === 'vjemma123'
        ? defaults.adminPassword
        : parsed.adminPassword;

    const legacyAutoLabels = new Set(['TRENDING', 'HOT', 'NEW RELEASE', 'TOP 10']);
    const cleanedMovies = Array.isArray(parsed.movies)
      ? parsed.movies.map((m) =>
          m.id.startsWith('mov_sample_') && legacyAutoLabels.has((m.label || '').trim().toUpperCase())
            ? { ...m, label: '' }
            : m
        )
      : defaults.movies;

    return {
      ...defaults,
      ...parsed,
      movies: cleanedMovies,
      categories: syncedCategories,
      genres: syncedGenres,
      adminEmail: LOCKED_ADMIN_EMAIL,
      adminPassword: migratedPassword,
      walletTransactions: Array.isArray(parsed.walletTransactions)
        ? parsed.walletTransactions
        : defaults.walletTransactions,
      liveTvChannels: Array.isArray(parsed.liveTvChannels) ? parsed.liveTvChannels : defaults.liveTvChannels,
      settings: {
        ...defaults.settings,
        ...(parsed.settings || {}),
        genreLine,
        r2Links: normalizedR2,
        movieTags: ['VIP'],
        paymentPlans: normalizedPlans,
      },
    };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const ch = new BroadcastChannel(LIVE_SYNC_CHANNEL);
      ch.postMessage({ type: 'state-updated', at: Date.now() });
      ch.close();
    }
  } catch (err) {
    console.warn('Storage save issue', err);
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

