import { createClient } from '@supabase/supabase-js';
import { R2_BUCKET_NAME, R2_UPLOAD_WORKER_URL } from './r2Upload';
import { DEFAULT_GENRE_LINE, parseGenreLine, sanitizeAssetUrl } from './storage';
import type {
  AppSettings,
  AppState,
  Banner,
  CommentItem,
  Episode,
  LikeRecord,
  LiveTvChannel,
  Movie,
  PaymentPlan,
  Season,
} from './types';

export const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL || 'https://yxcclztokovovtrccwhp.supabase.co'
)
  .trim()
  .replace(/\/+$/, '');
export const SUPABASE_PUBLISHABLE_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_qcDo4H6LrhAYL0I4lok5zw_LTf0_Dsc'
).trim();

const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    cache: 'no-store',
  });

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: noStoreFetch,
  },
});

const PUBLIC_CATALOG_OBJECT_KEY = 'vjemma_public_catalog_v1.json';
const DIRTY_MOVIES_KEY = 'vj_emma_dirty_movies_v1';
const DELETED_MOVIES_KEY = 'vj_emma_deleted_movies_v1';
const DIRTY_SETTINGS_KEY = 'vj_emma_dirty_settings_v1';
const LAST_SYNC_TS_KEY = 'vj_emma_last_sync_ts_v1';

interface SupabaseMovieRow {
  id: string;
  data: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

interface SupabaseSiteSettingsRow {
  key: string;
  value: Record<string, unknown> | null;
  updated_at?: string;
}

interface PublicCatalogSnapshot {
  version: number;
  updatedAt: number;
  deletedMovieIds?: string[];
  movies?: Movie[];
  seasons?: Season[];
  episodes?: Episode[];
  banners?: Banner[];
  liveTvChannels?: LiveTvChannel[];
  likes?: Record<string, LikeRecord>;
  comments?: Record<string, CommentItem[]>;
  settings?: Partial<AppSettings>;
}

let cachedSiteSettingsBase: Record<string, unknown> = {};

function readIdList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeIdList(key: string, ids: string[]): void {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
    }
  } catch {
    // Ignore storage quota issues
  }
}

function readLastSyncTs(): number {
  try {
    const raw = localStorage.getItem(LAST_SYNC_TS_KEY);
    const num = Number(raw || 0);
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
}

function writeLastSyncTs(ts: number): void {
  try {
    localStorage.setItem(LAST_SYNC_TS_KEY, String(ts));
  } catch {
    // Ignore storage errors
  }
}

function isRlsPolicyError(err?: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = String(err.code || '').trim();
  const msg = String(err.message || '');
  return (
    code === '42501' ||
    /row-level security/i.test(msg) ||
    /violates row-level security/i.test(msg) ||
    /permission denied/i.test(msg)
  );
}

function mapRowToMovie(row: SupabaseMovieRow): Movie | null {
  if (!row || !row.id) return null;
  const d = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>;
  const title = String(d.title || '').trim();
  if (!title) return null;

  const rawPoster = String(d.poster || d.posterUrl || '');
  const rawVideo = String(d.video || d.videoUrl || d.downloadUrl || '');
  const rawCategory = String(d.category || d.genre || '');
  const rawGenre = String(d.genre || d.category || '');
  const parsedCreatedAt = Number(d.createdAt);
  const rowCreatedAt = row.created_at ? Date.parse(row.created_at) : NaN;

  return {
    id: String(row.id),
    title,
    year: d.year !== undefined && d.year !== null ? String(d.year) : '',
    duration: typeof d.duration === 'string' ? d.duration : '',
    rating: d.rating !== undefined && d.rating !== null ? String(d.rating) : '',
    category: rawCategory,
    genre: rawGenre,
    actors: typeof d.actors === 'string' ? d.actors : '',
    label: typeof d.label === 'string' ? d.label : '',
    description: typeof d.description === 'string' ? d.description : '',
    poster: sanitizeAssetUrl(rawPoster),
    video: sanitizeAssetUrl(rawVideo),
    createdAt:
      Number.isFinite(parsedCreatedAt) && parsedCreatedAt > 0
        ? parsedCreatedAt
        : Number.isFinite(rowCreatedAt)
          ? rowCreatedAt
          : Date.now(),
  };
}

function sanitizeMovieForSync(movie: Movie): Movie {
  return {
    ...movie,
    poster: movie.poster && !movie.poster.startsWith('idb://') ? sanitizeAssetUrl(movie.poster) : '',
    video: movie.video && !movie.video.startsWith('idb://') ? sanitizeAssetUrl(movie.video) : '',
  };
}

function mapMovieToSupabasePayload(movie: Movie): {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
} {
  const clean = sanitizeMovieForSync(movie);

  return {
    id: clean.id,
    data: {
      id: clean.id,
      title: clean.title,
      year: clean.year || '',
      duration: clean.duration || '',
      rating: clean.rating || '',
      category: clean.category || '',
      genre: clean.genre || clean.category || '',
      actors: clean.actors || '',
      label: clean.label || '',
      description: clean.description || '',
      poster: clean.poster,
      posterUrl: clean.poster,
      video: clean.video,
      videoUrl: clean.video,
      downloadUrl: clean.video,
      featured: true,
      completed: true,
      seasons: [],
      trailerUrl: '',
      createdAt: clean.createdAt || Date.now(),
    },
    updated_at: new Date().toISOString(),
  };
}

function buildPublicSettingsSnapshot(state: AppState, syncTs: number) {
  return {
    updatedAt: syncTs,
    settings: {
      appName: state.settings.appName,
      whatsappUrl: state.settings.whatsappUrl,
      youtubeUrl: state.settings.youtubeUrl,
      facebookUrl: state.settings.facebookUrl,
      tiktokUrl: state.settings.tiktokUrl,
      socialLinks: state.settings.socialLinks,
      genreLine: state.settings.genreLine ?? DEFAULT_GENRE_LINE,
      paymentPlans: state.settings.paymentPlans,
      priceWeekly: state.settings.priceWeekly,
      priceMonthly: state.settings.priceMonthly,
      priceVip: state.settings.priceVip,
      showPosterLabel: state.settings.showPosterLabel,
      showPosterRating: state.settings.showPosterRating,
      showPosterSocialBar: state.settings.showPosterSocialBar,
      showPosterYear: state.settings.showPosterYear,
      showPosterActors: state.settings.showPosterActors,
      showPosterDescription: state.settings.showPosterDescription,
      r2Endpoint: state.settings.r2Endpoint,
      r2Links: state.settings.r2Links,
    },
    banners: state.banners.map((b) => ({
      ...b,
      image: b.image && !b.image.startsWith('idb://') ? sanitizeAssetUrl(b.image) : '',
    })),
    seasons: state.seasons.map((s) => ({
      ...s,
      poster: s.poster && !s.poster.startsWith('idb://') ? sanitizeAssetUrl(s.poster) : '',
    })),
    episodes: state.episodes.map((ep) => ({
      ...ep,
      video: ep.video && !ep.video.startsWith('idb://') ? sanitizeAssetUrl(ep.video) : '',
    })),
    liveTvChannels: (state.liveTvChannels || []).map((ch) => ({
      ...ch,
      streamUrl: sanitizeAssetUrl(ch.streamUrl),
      poster: ch.poster && !ch.poster.startsWith('idb://') ? sanitizeAssetUrl(ch.poster) : '',
    })),
    likes: state.likes,
    comments: state.comments,
  };
}

function buildFullPublicCatalogSnapshot(
  state: AppState,
  syncTs: number,
  deletedMovieIds: string[]
): PublicCatalogSnapshot {
  const base = buildPublicSettingsSnapshot(state, syncTs);
  return {
    version: 1,
    updatedAt: syncTs,
    deletedMovieIds,
    movies: state.movies.map(sanitizeMovieForSync),
    seasons: base.seasons,
    episodes: base.episodes,
    banners: base.banners,
    liveTvChannels: base.liveTvChannels,
    likes: base.likes,
    comments: base.comments,
    settings: base.settings,
  };
}

async function fetchR2PublicCatalog(): Promise<PublicCatalogSnapshot | null> {
  try {
    const url = `${R2_UPLOAD_WORKER_URL}/file/${PUBLIC_CATALOG_OBJECT_KEY}?t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw || raw.trim().startsWith('<')) return null;
    const parsed = JSON.parse(raw) as PublicCatalogSnapshot;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.updatedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function fetchServerPublicCatalog(): Promise<PublicCatalogSnapshot | null> {
  try {
    const res = await fetch(`/api/public-state?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    const parsed = (await res.json()) as PublicCatalogSnapshot;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.updatedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function pushR2PublicCatalog(snapshot: PublicCatalogSnapshot): Promise<boolean> {
  try {
    const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
    const file = new File([blob], PUBLIC_CATALOG_OBJECT_KEY, { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', file, PUBLIC_CATALOG_OBJECT_KEY);
    formData.append('bucket', R2_BUCKET_NAME);
    formData.append('folder', 'catalog');

    const res = await fetch(`${R2_UPLOAD_WORKER_URL}/upload`, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function pushServerPublicCatalog(snapshot: PublicCatalogSnapshot): Promise<boolean> {
  try {
    const res = await fetch('/api/public-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

function mergeSettingsFields(
  currentSettings: AppSettings,
  remoteSettings: Partial<AppSettings>,
  legacy: Record<string, unknown> = {}
): {
  settings: AppSettings;
  categories: { id: string; name: string }[];
  genres: { id: string; name: string }[];
} {
  const nextGenreLine =
    typeof remoteSettings.genreLine === 'string' && remoteSettings.genreLine.trim().length > 0
      ? remoteSettings.genreLine
      : currentSettings.genreLine || DEFAULT_GENRE_LINE;
  const parsedGenres = parseGenreLine(nextGenreLine);

  const nextPlans: PaymentPlan[] =
    Array.isArray(remoteSettings.paymentPlans) && remoteSettings.paymentPlans.length > 0
      ? remoteSettings.paymentPlans
      : currentSettings.paymentPlans;

  return {
    categories: parsedGenres.map((name, idx) => ({ id: `cat_${idx}`, name })),
    genres: parsedGenres.map((name, idx) => ({ id: `gen_${idx}`, name })),
    settings: {
      ...currentSettings,
      appName:
        typeof remoteSettings.appName === 'string' && remoteSettings.appName.trim()
          ? remoteSettings.appName
          : currentSettings.appName,
      whatsappUrl:
        typeof remoteSettings.whatsappUrl === 'string'
          ? remoteSettings.whatsappUrl
          : typeof legacy.whatsapp === 'string' && legacy.whatsapp.trim()
            ? legacy.whatsapp.trim()
            : currentSettings.whatsappUrl,
      youtubeUrl:
        typeof remoteSettings.youtubeUrl === 'string'
          ? remoteSettings.youtubeUrl
          : typeof legacy.youtube === 'string' && legacy.youtube.trim()
            ? legacy.youtube.trim()
            : currentSettings.youtubeUrl,
      facebookUrl:
        typeof remoteSettings.facebookUrl === 'string'
          ? remoteSettings.facebookUrl
          : typeof legacy.facebook === 'string' && legacy.facebook.trim()
            ? legacy.facebook.trim()
            : currentSettings.facebookUrl,
      tiktokUrl:
        typeof remoteSettings.tiktokUrl === 'string'
          ? remoteSettings.tiktokUrl
          : typeof legacy.tiktok === 'string' && legacy.tiktok.trim()
            ? legacy.tiktok.trim()
            : currentSettings.tiktokUrl,
      socialLinks:
        typeof remoteSettings.socialLinks === 'string'
          ? remoteSettings.socialLinks
          : currentSettings.socialLinks,
      genreLine: nextGenreLine,
      paymentPlans: nextPlans,
      priceWeekly:
        typeof remoteSettings.priceWeekly === 'number'
          ? remoteSettings.priceWeekly
          : currentSettings.priceWeekly,
      priceMonthly:
        typeof remoteSettings.priceMonthly === 'number'
          ? remoteSettings.priceMonthly
          : currentSettings.priceMonthly,
      priceVip:
        typeof remoteSettings.priceVip === 'number'
          ? remoteSettings.priceVip
          : currentSettings.priceVip,
      showPosterLabel:
        typeof remoteSettings.showPosterLabel === 'boolean'
          ? remoteSettings.showPosterLabel
          : currentSettings.showPosterLabel,
      showPosterRating:
        typeof remoteSettings.showPosterRating === 'boolean'
          ? remoteSettings.showPosterRating
          : currentSettings.showPosterRating,
      showPosterSocialBar:
        typeof remoteSettings.showPosterSocialBar === 'boolean'
          ? remoteSettings.showPosterSocialBar
          : currentSettings.showPosterSocialBar,
      showPosterYear:
        typeof remoteSettings.showPosterYear === 'boolean'
          ? remoteSettings.showPosterYear
          : currentSettings.showPosterYear,
      showPosterActors:
        typeof remoteSettings.showPosterActors === 'boolean'
          ? remoteSettings.showPosterActors
          : currentSettings.showPosterActors,
      showPosterDescription:
        typeof remoteSettings.showPosterDescription === 'boolean'
          ? remoteSettings.showPosterDescription
          : currentSettings.showPosterDescription,
      r2Endpoint:
        typeof remoteSettings.r2Endpoint === 'string'
          ? remoteSettings.r2Endpoint
          : currentSettings.r2Endpoint,
      r2Links: Array.isArray(remoteSettings.r2Links)
        ? remoteSettings.r2Links
        : currentSettings.r2Links,
    },
  };
}

export async function fetchSupabasePublicState(
  currentState: AppState,
  options: { forceRemote?: boolean } = {}
): Promise<Partial<AppState> | null> {
  try {
    const [moviesRes, settingsRes, r2Snapshot, serverSnapshot] = await Promise.all([
      supabase.from('movies').select('id, data, created_at, updated_at'),
      supabase.from('site_settings').select('key, value, updated_at').eq('key', 'public').maybeSingle(),
      fetchR2PublicCatalog(),
      fetchServerPublicCatalog(),
    ]);

    const patch: Partial<AppState> = {};
    const localSyncTs = readLastSyncTs();

    let supabaseSettingsTs = 0;
    let supabaseVjSnapshot: PublicCatalogSnapshot | null = null;
    let supabaseLegacySettings: Record<string, unknown> = {};

    if (!settingsRes.error && settingsRes.data) {
      const row = settingsRes.data as SupabaseSiteSettingsRow;
      const val = (row.value && typeof row.value === 'object' ? row.value : {}) as Record<
        string,
        unknown
      >;
      cachedSiteSettingsBase = val;
      supabaseLegacySettings =
        val.settings && typeof val.settings === 'object'
          ? (val.settings as Record<string, unknown>)
          : {};
      const vjemma =
        val.vjemma && typeof val.vjemma === 'object'
          ? (val.vjemma as Record<string, unknown>)
          : null;

      const parsedRowUpdatedAt = row.updated_at ? Date.parse(row.updated_at) : 0;
      const vjUpdatedAt = Number(vjemma?.updatedAt || 0);
      supabaseSettingsTs = Math.max(
        Number.isFinite(vjUpdatedAt) ? vjUpdatedAt : 0,
        Number.isFinite(parsedRowUpdatedAt) ? parsedRowUpdatedAt : 0
      );

      if (vjemma) {
        supabaseVjSnapshot = {
          version: 1,
          updatedAt: supabaseSettingsTs,
          seasons: Array.isArray(vjemma.seasons) ? (vjemma.seasons as Season[]) : undefined,
          episodes: Array.isArray(vjemma.episodes) ? (vjemma.episodes as Episode[]) : undefined,
          banners: Array.isArray(vjemma.banners) ? (vjemma.banners as Banner[]) : undefined,
          liveTvChannels: Array.isArray(vjemma.liveTvChannels)
            ? (vjemma.liveTvChannels as LiveTvChannel[])
            : undefined,
          likes:
            vjemma.likes && typeof vjemma.likes === 'object'
              ? (vjemma.likes as Record<string, LikeRecord>)
              : undefined,
          comments:
            vjemma.comments && typeof vjemma.comments === 'object'
              ? (vjemma.comments as Record<string, CommentItem[]>)
              : undefined,
          settings:
            vjemma.settings && typeof vjemma.settings === 'object'
              ? (vjemma.settings as Partial<AppSettings>)
              : undefined,
        };
      }
    }

    // Choose the newest catalog snapshot among R2, same-origin server mirror, and Supabase
    const candidates: PublicCatalogSnapshot[] = [];
    if (r2Snapshot) candidates.push(r2Snapshot);
    if (serverSnapshot) candidates.push(serverSnapshot);
    if (supabaseVjSnapshot) candidates.push(supabaseVjSnapshot);
    candidates.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

    const newestSnapshot = candidates[0] || null;
    const newestRemoteTs = Number(newestSnapshot?.updatedAt || 0);

    const dirtySet = new Set(readIdList(DIRTY_MOVIES_KEY));
    const localDeletedSet = new Set(readIdList(DELETED_MOVIES_KEY));
    let hasDirtySettings = false;
    try {
      hasDirtySettings = localStorage.getItem(DIRTY_SETTINGS_KEY) === '1';
    } catch {
      hasDirtySettings = false;
    }

    const remoteWinsSnapshot = Boolean(
      newestSnapshot &&
        (!hasDirtySettings || newestRemoteTs > localSyncTs || options.forceRemote)
    );

    if (newestSnapshot && remoteWinsSnapshot) {
      if (newestSnapshot.settings) {
        const merged = mergeSettingsFields(
          currentState.settings,
          newestSnapshot.settings,
          supabaseLegacySettings
        );
        patch.settings = merged.settings;
        patch.categories = merged.categories;
        patch.genres = merged.genres;
      }
      if (Array.isArray(newestSnapshot.banners)) {
        patch.banners = newestSnapshot.banners;
      }
      if (Array.isArray(newestSnapshot.seasons)) {
        patch.seasons = newestSnapshot.seasons;
      }
      if (Array.isArray(newestSnapshot.episodes)) {
        patch.episodes = newestSnapshot.episodes;
      }
      if (Array.isArray(newestSnapshot.liveTvChannels)) {
        patch.liveTvChannels = newestSnapshot.liveTvChannels;
      }
      if (newestSnapshot.likes && typeof newestSnapshot.likes === 'object') {
        patch.likes = newestSnapshot.likes;
      }
      if (newestSnapshot.comments && typeof newestSnapshot.comments === 'object') {
        patch.comments = newestSnapshot.comments;
      }
    }

    // Movies resolution: prefer R2/server complete movie snapshot when newer than local unsynced changes
    const remoteCatalogMovies =
      newestSnapshot && Array.isArray(newestSnapshot.movies) && newestSnapshot.movies.length > 0
        ? newestSnapshot.movies
        : null;
    const remoteDeletedSet = new Set<string>([
      ...localDeletedSet,
      ...(Array.isArray(newestSnapshot?.deletedMovieIds)
        ? newestSnapshot!.deletedMovieIds.map(String)
        : []),
    ]);

    const supabaseMovies =
      !moviesRes.error && Array.isArray(moviesRes.data)
        ? (moviesRes.data as SupabaseMovieRow[])
            .map(mapRowToMovie)
            .filter((m): m is Movie => Boolean(m))
        : [];

    if (remoteCatalogMovies && (newestRemoteTs >= localSyncTs || options.forceRemote)) {
      const localById = new Map(currentState.movies.map((m) => [m.id, m]));
      const mergedMap = new Map<string, Movie>();

      for (const remote of remoteCatalogMovies) {
        if (remoteDeletedSet.has(remote.id)) continue;
        const local = localById.get(remote.id);
        if (local && dirtySet.has(remote.id) && localSyncTs > newestRemoteTs) {
          mergedMap.set(remote.id, {
            ...remote,
            ...local,
            poster: local.poster || remote.poster,
            video: local.video || remote.video,
          });
        } else {
          mergedMap.set(remote.id, {
            ...remote,
            poster: remote.poster || local?.poster || '',
            video: remote.video || local?.video || '',
          });
        }
      }

      // Preserve any unsynced local-only movies created on this device after newestRemoteTs
      for (const local of currentState.movies) {
        if (remoteDeletedSet.has(local.id)) continue;
        if (!mergedMap.has(local.id) && dirtySet.has(local.id) && localSyncTs > newestRemoteTs) {
          mergedMap.set(local.id, local);
        }
      }

      patch.movies = Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);
    } else if (supabaseMovies.length > 0) {
      const localById = new Map(currentState.movies.map((m) => [m.id, m]));
      const mergedMap = new Map<string, Movie>();

      for (const remote of supabaseMovies) {
        if (remoteDeletedSet.has(remote.id)) continue;
        const local = localById.get(remote.id);
        if (local && dirtySet.has(remote.id)) {
          mergedMap.set(remote.id, {
            ...remote,
            ...local,
            poster: local.poster || remote.poster,
            video: local.video || remote.video,
          });
        } else if (local) {
          mergedMap.set(remote.id, {
            ...remote,
            poster: remote.poster || local.poster,
            video: remote.video || local.video,
            label: remote.label || local.label,
            duration: remote.duration || local.duration,
          });
        } else {
          mergedMap.set(remote.id, remote);
        }
      }

      for (const local of currentState.movies) {
        if (remoteDeletedSet.has(local.id)) continue;
        if (
          !mergedMap.has(local.id) &&
          (dirtySet.has(local.id) || (local.id.startsWith('mov_') && !local.id.startsWith('mov_sample_')))
        ) {
          mergedMap.set(local.id, local);
        }
      }

      patch.movies = Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);
    }

    if (newestRemoteTs > localSyncTs && !hasDirtySettings) {
      writeLastSyncTs(newestRemoteTs);
    }

    return Object.keys(patch).length > 0 ? patch : null;
  } catch (err) {
    console.warn('Public catalog sync fetch failed:', err);
    return null;
  }
}

export async function syncStateChangesToSupabase(
  prev: AppState,
  next: AppState
): Promise<{ ok: boolean; error?: string; localOnly?: boolean }> {
  try {
    const syncTs = Math.max(Date.now(), readLastSyncTs() + 1);
    writeLastSyncTs(syncTs);

    const tasks: PromiseLike<{ error: { code?: string; message: string } | null }>[] = [];
    let hadRlsFallback = false;

    const dirtyNow = new Set(readIdList(DIRTY_MOVIES_KEY));
    const deletedNow = new Set(readIdList(DELETED_MOVIES_KEY));

    const moviesChanged = prev.movies !== next.movies;
    if (moviesChanged) {
      const prevMap = new Map(prev.movies.map((m) => [m.id, m]));
      const nextIds = new Set(next.movies.map((m) => m.id));

      const changedOrAdded = next.movies.filter((m) => {
        const old = prevMap.get(m.id);
        return !old || JSON.stringify(old) !== JSON.stringify(m);
      });

      const deletedIds = prev.movies.filter((m) => !nextIds.has(m.id)).map((m) => m.id);

      for (const m of changedOrAdded) {
        dirtyNow.add(m.id);
        deletedNow.delete(m.id);
      }
      for (const delId of deletedIds) {
        deletedNow.add(delId);
        dirtyNow.delete(delId);
      }

      writeIdList(DIRTY_MOVIES_KEY, Array.from(dirtyNow));
      writeIdList(DELETED_MOVIES_KEY, Array.from(deletedNow));

      if (changedOrAdded.length > 0) {
        const payloads = changedOrAdded.map(mapMovieToSupabasePayload);
        tasks.push(
          supabase
            .from('movies')
            .upsert(payloads, { onConflict: 'id' })
            .then((res) => {
              if (!res.error) {
                const remainingDirty = readIdList(DIRTY_MOVIES_KEY).filter(
                  (id) => !changedOrAdded.some((m) => m.id === id)
                );
                writeIdList(DIRTY_MOVIES_KEY, remainingDirty);
              } else if (isRlsPolicyError(res.error)) {
                hadRlsFallback = true;
                return { error: null };
              }
              return { error: res.error };
            })
        );
      }

      if (deletedIds.length > 0) {
        tasks.push(
          supabase
            .from('movies')
            .delete()
            .in('id', deletedIds)
            .then((res) => {
              if (!res.error) {
                const remainingDeleted = readIdList(DELETED_MOVIES_KEY).filter(
                  (id) => !deletedIds.includes(id)
                );
                writeIdList(DELETED_MOVIES_KEY, remainingDeleted);
              } else if (isRlsPolicyError(res.error)) {
                hadRlsFallback = true;
                return { error: null };
              }
              return { error: res.error };
            })
        );
      }
    }

    const publicCatalogChanged =
      moviesChanged ||
      prev.settings !== next.settings ||
      prev.banners !== next.banners ||
      prev.seasons !== next.seasons ||
      prev.episodes !== next.episodes ||
      prev.liveTvChannels !== next.liveTvChannels ||
      prev.categories !== next.categories ||
      prev.genres !== next.genres ||
      prev.likes !== next.likes ||
      prev.comments !== next.comments;

    if (!publicCatalogChanged) {
      return { ok: true };
    }

    if (
      prev.settings !== next.settings ||
      prev.banners !== next.banners ||
      prev.seasons !== next.seasons ||
      prev.episodes !== next.episodes ||
      prev.liveTvChannels !== next.liveTvChannels ||
      prev.categories !== next.categories ||
      prev.genres !== next.genres ||
      prev.likes !== next.likes ||
      prev.comments !== next.comments
    ) {
      try {
        localStorage.setItem(DIRTY_SETTINGS_KEY, '1');
      } catch {
        // Ignore
      }

      const existingLegacySettings =
        cachedSiteSettingsBase.settings && typeof cachedSiteSettingsBase.settings === 'object'
          ? (cachedSiteSettingsBase.settings as Record<string, unknown>)
          : {};

      const parsedGenres = parseGenreLine(next.settings.genreLine);
      const nextValue: Record<string, unknown> = {
        ...cachedSiteSettingsBase,
        genres: parsedGenres.map((name) => ({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name,
        })),
        categories: parsedGenres.map((name) => ({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        })),
        settings: {
          ...existingLegacySettings,
          siteName: next.settings.appName,
          whatsapp: next.settings.whatsappUrl,
          youtube: next.settings.youtubeUrl,
          facebook: next.settings.facebookUrl,
          tiktok: next.settings.tiktokUrl,
        },
        vjemma: buildPublicSettingsSnapshot(next, syncTs),
      };

      cachedSiteSettingsBase = nextValue;
      tasks.push(
        supabase
          .from('site_settings')
          .upsert(
            {
              key: 'public',
              value: nextValue,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          )
          .then((res) => {
            if (!res.error) {
              try {
                localStorage.removeItem(DIRTY_SETTINGS_KEY);
              } catch {
                // Ignore
              }
            } else if (isRlsPolicyError(res.error)) {
              hadRlsFallback = true;
              return { error: null };
            }
            return { error: res.error };
          })
      );
    }

    // Primary cross-device sync via Cloudflare R2 public catalog + same-origin server mirror
    const fullSnapshot = buildFullPublicCatalogSnapshot(
      next,
      syncTs,
      Array.from(deletedNow)
    );

    const [r2Ok, serverOk] = await Promise.all([
      pushR2PublicCatalog(fullSnapshot),
      pushServerPublicCatalog(fullSnapshot),
      ...tasks,
    ]).then((all) => {
      const r2Result = Boolean(all[0]);
      const srvResult = Boolean(all[1]);
      const supaResults = all.slice(2) as { error: { code?: string; message: string } | null }[];
      const failed = supaResults.find((r) => r?.error);
      if (failed?.error) {
        console.warn('Supabase sync note:', failed.error.message);
      }
      return [r2Result, srvResult] as const;
    });

    if (r2Ok || serverOk) {
      // Cross-device cloud snapshot succeeded: clear local dirty locks so all devices stay in sync
      writeIdList(DIRTY_MOVIES_KEY, []);
      try {
        localStorage.removeItem(DIRTY_SETTINGS_KEY);
      } catch {
        // Ignore
      }
      return { ok: true, localOnly: false };
    }

    return { ok: true, localOnly: hadRlsFallback };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cloud sync failed' };
  }
}

export function subscribeToSupabasePublicChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('vjemma-public-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => {});
  };
}
