import { createClient } from '@supabase/supabase-js';
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

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

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

let cachedSiteSettingsBase: Record<string, unknown> = {};

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

function mapMovieToSupabasePayload(movie: Movie): {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
} {
  const poster = movie.poster && !movie.poster.startsWith('idb://') ? sanitizeAssetUrl(movie.poster) : '';
  const video = movie.video && !movie.video.startsWith('idb://') ? sanitizeAssetUrl(movie.video) : '';

  return {
    id: movie.id,
    data: {
      id: movie.id,
      title: movie.title,
      year: movie.year || '',
      rating: movie.rating || '',
      category: movie.category || '',
      genre: movie.genre || movie.category || '',
      actors: movie.actors || '',
      label: movie.label || '',
      description: movie.description || '',
      poster,
      posterUrl: poster,
      video,
      videoUrl: video,
      downloadUrl: video,
      featured: true,
      completed: true,
      seasons: [],
      duration: '',
      trailerUrl: '',
      createdAt: movie.createdAt || Date.now(),
    },
    updated_at: new Date().toISOString(),
  };
}

function buildPublicSettingsSnapshot(state: AppState) {
  return {
    updatedAt: Date.now(),
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

export async function fetchSupabasePublicState(
  currentState: AppState
): Promise<Partial<AppState> | null> {
  try {
    const [moviesRes, settingsRes] = await Promise.all([
      supabase.from('movies').select('id, data, created_at, updated_at'),
      supabase.from('site_settings').select('key, value, updated_at').eq('key', 'public').maybeSingle(),
    ]);

    const patch: Partial<AppState> = {};

    if (!moviesRes.error && Array.isArray(moviesRes.data)) {
      const remoteMovies = (moviesRes.data as SupabaseMovieRow[])
        .map(mapRowToMovie)
        .filter((m): m is Movie => Boolean(m))
        .sort((a, b) => a.createdAt - b.createdAt);

      if (remoteMovies.length > 0) {
        patch.movies = remoteMovies;
      }
    }

    if (!settingsRes.error && settingsRes.data) {
      const row = settingsRes.data as SupabaseSiteSettingsRow;
      const val = (row.value && typeof row.value === 'object' ? row.value : {}) as Record<
        string,
        unknown
      >;
      cachedSiteSettingsBase = val;

      const legacy =
        val.settings && typeof val.settings === 'object'
          ? (val.settings as Record<string, unknown>)
          : {};
      const vjemma =
        val.vjemma && typeof val.vjemma === 'object'
          ? (val.vjemma as Record<string, unknown>)
          : null;
      const vjSettings =
        vjemma?.settings && typeof vjemma.settings === 'object'
          ? (vjemma.settings as Partial<AppSettings>)
          : {};

      const nextGenreLine =
        typeof vjSettings.genreLine === 'string' && vjSettings.genreLine.trim().length > 0
          ? vjSettings.genreLine
          : currentState.settings.genreLine || DEFAULT_GENRE_LINE;
      const parsedGenres = parseGenreLine(nextGenreLine);

      const nextPlans: PaymentPlan[] =
        Array.isArray(vjSettings.paymentPlans) && vjSettings.paymentPlans.length > 0
          ? vjSettings.paymentPlans
          : currentState.settings.paymentPlans;

      patch.categories = parsedGenres.map((name, idx) => ({ id: `cat_${idx}`, name }));
      patch.genres = parsedGenres.map((name, idx) => ({ id: `gen_${idx}`, name }));

      patch.settings = {
        ...currentState.settings,
        appName:
          typeof vjSettings.appName === 'string' && vjSettings.appName.trim()
            ? vjSettings.appName
            : currentState.settings.appName,
        whatsappUrl:
          typeof vjSettings.whatsappUrl === 'string'
            ? vjSettings.whatsappUrl
            : typeof legacy.whatsapp === 'string' && legacy.whatsapp.trim()
              ? legacy.whatsapp.trim()
              : currentState.settings.whatsappUrl,
        youtubeUrl:
          typeof vjSettings.youtubeUrl === 'string'
            ? vjSettings.youtubeUrl
            : typeof legacy.youtube === 'string' && legacy.youtube.trim()
              ? legacy.youtube.trim()
              : currentState.settings.youtubeUrl,
        facebookUrl:
          typeof vjSettings.facebookUrl === 'string'
            ? vjSettings.facebookUrl
            : typeof legacy.facebook === 'string' && legacy.facebook.trim()
              ? legacy.facebook.trim()
              : currentState.settings.facebookUrl,
        tiktokUrl:
          typeof vjSettings.tiktokUrl === 'string'
            ? vjSettings.tiktokUrl
            : typeof legacy.tiktok === 'string' && legacy.tiktok.trim()
              ? legacy.tiktok.trim()
              : currentState.settings.tiktokUrl,
        socialLinks:
          typeof vjSettings.socialLinks === 'string'
            ? vjSettings.socialLinks
            : currentState.settings.socialLinks,
        genreLine: nextGenreLine,
        paymentPlans: nextPlans,
        priceWeekly:
          typeof vjSettings.priceWeekly === 'number'
            ? vjSettings.priceWeekly
            : currentState.settings.priceWeekly,
        priceMonthly:
          typeof vjSettings.priceMonthly === 'number'
            ? vjSettings.priceMonthly
            : currentState.settings.priceMonthly,
        priceVip:
          typeof vjSettings.priceVip === 'number'
            ? vjSettings.priceVip
            : currentState.settings.priceVip,
        showPosterLabel:
          typeof vjSettings.showPosterLabel === 'boolean'
            ? vjSettings.showPosterLabel
            : currentState.settings.showPosterLabel,
        showPosterRating:
          typeof vjSettings.showPosterRating === 'boolean'
            ? vjSettings.showPosterRating
            : currentState.settings.showPosterRating,
        showPosterSocialBar:
          typeof vjSettings.showPosterSocialBar === 'boolean'
            ? vjSettings.showPosterSocialBar
            : currentState.settings.showPosterSocialBar,
        showPosterYear:
          typeof vjSettings.showPosterYear === 'boolean'
            ? vjSettings.showPosterYear
            : currentState.settings.showPosterYear,
        showPosterActors:
          typeof vjSettings.showPosterActors === 'boolean'
            ? vjSettings.showPosterActors
            : currentState.settings.showPosterActors,
        showPosterDescription:
          typeof vjSettings.showPosterDescription === 'boolean'
            ? vjSettings.showPosterDescription
            : currentState.settings.showPosterDescription,
        r2Endpoint:
          typeof vjSettings.r2Endpoint === 'string'
            ? vjSettings.r2Endpoint
            : currentState.settings.r2Endpoint,
        r2Links: Array.isArray(vjSettings.r2Links)
          ? vjSettings.r2Links
          : currentState.settings.r2Links,
      };

      if (vjemma) {
        if (Array.isArray(vjemma.banners)) {
          patch.banners = vjemma.banners as Banner[];
        }
        if (Array.isArray(vjemma.seasons)) {
          patch.seasons = vjemma.seasons as Season[];
        }
        if (Array.isArray(vjemma.episodes)) {
          patch.episodes = vjemma.episodes as Episode[];
        }
        if (Array.isArray(vjemma.liveTvChannels)) {
          patch.liveTvChannels = vjemma.liveTvChannels as LiveTvChannel[];
        }
        if (vjemma.likes && typeof vjemma.likes === 'object') {
          patch.likes = vjemma.likes as Record<string, LikeRecord>;
        }
        if (vjemma.comments && typeof vjemma.comments === 'object') {
          patch.comments = vjemma.comments as Record<string, CommentItem[]>;
        }
      }
    }

    return patch;
  } catch (err) {
    console.warn('Supabase initial fetch failed:', err);
    return null;
  }
}

export async function syncStateChangesToSupabase(
  prev: AppState,
  next: AppState
): Promise<{ ok: boolean; error?: string }> {
  try {
    const tasks: PromiseLike<{ error: { message: string } | null }>[] = [];

    if (prev.movies !== next.movies) {
      const prevMap = new Map(prev.movies.map((m) => [m.id, m]));
      const nextIds = new Set(next.movies.map((m) => m.id));

      const changedOrAdded = next.movies.filter((m) => {
        const old = prevMap.get(m.id);
        return !old || JSON.stringify(old) !== JSON.stringify(m);
      });

      const deletedIds = prev.movies.filter((m) => !nextIds.has(m.id)).map((m) => m.id);

      if (changedOrAdded.length > 0) {
        const payloads = changedOrAdded.map(mapMovieToSupabasePayload);
        tasks.push(
          supabase
            .from('movies')
            .upsert(payloads, { onConflict: 'id' })
            .then((res) => ({ error: res.error }))
        );
      }

      if (deletedIds.length > 0) {
        tasks.push(
          supabase
            .from('movies')
            .delete()
            .in('id', deletedIds)
            .then((res) => ({ error: res.error }))
        );
      }
    }

    const publicSettingsChanged =
      prev.settings !== next.settings ||
      prev.banners !== next.banners ||
      prev.seasons !== next.seasons ||
      prev.episodes !== next.episodes ||
      prev.liveTvChannels !== next.liveTvChannels ||
      prev.categories !== next.categories ||
      prev.genres !== next.genres ||
      prev.likes !== next.likes ||
      prev.comments !== next.comments;

    if (publicSettingsChanged) {
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
        vjemma: buildPublicSettingsSnapshot(next),
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
          .then((res) => ({ error: res.error }))
      );
    }

    if (tasks.length === 0) return { ok: true };

    const results = await Promise.all(tasks);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return { ok: false, error: failed.error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Supabase sync failed' };
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
