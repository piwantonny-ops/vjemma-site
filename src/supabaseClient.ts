import { createClient } from '@supabase/supabase-js';
import { R2_BUCKET_NAME, R2_UPLOAD_WORKER_URL } from './r2Upload';
import {
  DEFAULT_CATEGORIES_LIST,
  DEFAULT_CATEGORY_LINE,
  DEFAULT_GENRES_LIST,
  DEFAULT_GENRE_LINE,
  mergeTagLines,
  normalizeSocialUrl,
  parseCategoryLine,
  parseGenreLine,
  parseMovieGenres,
  sanitizeAssetUrl,
} from './storage';
import type {
  AccountStatus,
  AppSettings,
  AppState,
  Banner,
  CommentItem,
  Episode,
  LikeRecord,
  LiveTvChannel,
  Movie,
  PaymentRequestRecord,
  Season,
  UserAccount,
  WalletTransaction,
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

// Partitioned Cloud Database collections on Cloudflare R2 (never overwrite each other)
const DB_MOVIES_KEY = 'vjemma_db_movies_v1.json';
const DB_SERIES_KEY = 'vjemma_db_series_v1.json';
const DB_SETTINGS_KEY = 'vjemma_db_settings_v1.json';
const DB_MEDIA_KEY = 'vjemma_db_media_v1.json';
const DB_SOCIAL_KEY = 'vjemma_db_social_v1.json';
const LEGACY_CATALOG_KEY = 'vjemma_public_catalog_v1.json';

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

interface MoviesCloudDoc {
  version: number;
  updatedAt: number;
  deletedIds: string[];
  items: Movie[];
}

interface SeriesCloudDoc {
  version: number;
  updatedAt: number;
  deletedSeasonIds: string[];
  deletedEpisodeIds: string[];
  seasons: Season[];
  episodes: Episode[];
}

interface SettingsCloudDoc {
  version: number;
  updatedAt: number;
  settings: Partial<AppSettings>;
}

interface MediaCloudDoc {
  version: number;
  updatedAt: number;
  deletedBannerIds?: string[];
  deletedChannelIds?: string[];
  banners: Banner[];
  liveTvChannels: LiveTvChannel[];
}

interface SocialCloudDoc {
  version: number;
  updatedAt: number;
  likes: Record<string, LikeRecord>;
  comments: Record<string, CommentItem[]>;
}

interface LegacyCatalogSnapshot {
  version?: number;
  updatedAt?: number;
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

async function readR2JsonDoc<T>(key: string): Promise<T | null> {
  try {
    const url = `${R2_UPLOAD_WORKER_URL}/file/${encodeURIComponent(key)}?t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw || raw.trim().startsWith('<')) return null;
    const parsed = JSON.parse(raw) as T;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeR2JsonDoc<T>(key: string, doc: T): Promise<boolean> {
  try {
    const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
    const file = new File([blob], key, { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', file, key);
    formData.append('bucket', R2_BUCKET_NAME);
    formData.append('folder', 'db');

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

function extractTagsArray(rawArray: unknown, rawText: unknown): string[] {
  return parseMovieGenres(
    Array.isArray(rawArray) ? rawArray.map((x) => String(x || '')) : undefined,
    typeof rawText === 'string' ? rawText : undefined
  );
}

function extractSupabaseData(
  rows: SupabaseMovieRow[],
  settingsRow: SupabaseSiteSettingsRow | null
): {
  movies: Movie[];
  seriesIds: Set<string>;
  seasons: Season[];
  episodes: Episode[];
  settingsPatch: Partial<AppSettings>;
} {
  const movies: Movie[] = [];
  const seriesIds = new Set<string>();
  const seasons: Season[] = [];
  const episodes: Episode[] = [];

  for (const row of rows) {
    if (!row || !row.id) continue;
    const d = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>;
    const title = String(d.title || '').trim();
    if (!title) continue;

    const rawPoster = String(d.poster || d.posterUrl || '');
    const rawVideo = String(d.video || d.videoUrl || d.downloadUrl || '');
    const poster = sanitizeAssetUrl(rawPoster);
    const video = sanitizeAssetUrl(rawVideo);
    const genresArr = extractTagsArray(d.genres, d.genre);
    const categoriesArr = extractTagsArray(d.categories, d.category);
    const effectiveGenres = genresArr.length > 0 ? genresArr : categoriesArr;
    const effectiveCategories = categoriesArr.length > 0 ? categoriesArr : genresArr;
    const genreStr = effectiveGenres.join(', ');
    const categoryStr = effectiveCategories.join(', ');
    const label =
      typeof d.label === 'string' && d.label.trim()
        ? d.label.trim()
        : typeof d.badge === 'string' && d.badge.trim()
          ? d.badge.trim()
          : '';
    const year = d.year !== undefined && d.year !== null ? String(d.year) : '';
    const duration = typeof d.duration === 'string' ? d.duration : '';
    const actors = typeof d.actors === 'string' ? d.actors : '';
    const description = typeof d.description === 'string' ? d.description : '';
    const rating = d.rating !== undefined && d.rating !== null ? String(d.rating) : '';
    const parsedCreatedAt = Number(d.createdAt);
    const rowCreatedAt = row.created_at ? Date.parse(row.created_at) : NaN;
    const createdAt =
      Number.isFinite(parsedCreatedAt) && parsedCreatedAt > 0
        ? parsedCreatedAt
        : Number.isFinite(rowCreatedAt)
          ? rowCreatedAt
          : Date.now();

    const rawSeasons = Array.isArray(d.seasons) ? (d.seasons as Record<string, unknown>[]) : [];
    const isSeriesRow = String(d.type || '').toLowerCase() === 'series' || rawSeasons.length > 0;

    if (isSeriesRow) {
      seriesIds.add(String(row.id));
      if (rawSeasons.length > 0) {
        for (const sObj of rawSeasons) {
          const seasonId = String(sObj.id || `sea_${row.id}_${sObj.number || 1}`);
          const seasonNumber = String(sObj.number || sObj.seasonNumber || '1');
          seasons.push({
            id: seasonId,
            seriesTitle: title,
            seasonNumber,
            label,
            genre: genreStr,
            genres: effectiveGenres,
            category: categoryStr,
            categories: effectiveCategories,
            year,
            duration,
            actors,
            description,
            poster,
          });
          const rawEps = Array.isArray(sObj.episodes) ? (sObj.episodes as Record<string, unknown>[]) : [];
          for (const epObj of rawEps) {
            const epTitle = String(epObj.title || `${title} Ep ${epObj.number || 1}`).trim();
            const epVideo = sanitizeAssetUrl(String(epObj.videoUrl || epObj.video || video));
            episodes.push({
              id: String(epObj.id || `ep_${seasonId}_${epObj.number || 1}`),
              seasonId,
              episodeNumber: String(epObj.number || epObj.episodeNumber || '1'),
              title: epTitle,
              video: epVideo,
            });
          }
        }
      } else {
        const seasonId = `sea_${row.id}_1`;
        seasons.push({
          id: seasonId,
          seriesTitle: title,
          seasonNumber: '1',
          label,
          genre: genreStr,
          genres: effectiveGenres,
          category: categoryStr,
          categories: effectiveCategories,
          year,
          duration,
          actors,
          description,
          poster,
        });
        if (video) {
          episodes.push({
            id: `ep_${row.id}_1`,
            seasonId,
            episodeNumber: '1',
            title: `${title} Episode 1`,
            video,
          });
        }
      }
      continue;
    }

    movies.push({
      id: String(row.id),
      title,
      year,
      duration,
      rating,
      category: categoryStr,
      categories: effectiveCategories,
      genre: genreStr,
      genres: effectiveGenres,
      actors,
      label,
      description,
      poster,
      video,
      createdAt,
    });
  }

  const settingsPatch: Partial<AppSettings> = {};
  if (settingsRow && settingsRow.value && typeof settingsRow.value === 'object') {
    const val = settingsRow.value;
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

    const rawWhatsapp =
      (typeof vjSettings.whatsappUrl === 'string' && vjSettings.whatsappUrl.trim()) ||
      (typeof legacy.whatsapp === 'string' && legacy.whatsapp.trim()) ||
      '';
    if (rawWhatsapp) {
      settingsPatch.whatsappUrl = normalizeSocialUrl(rawWhatsapp, 'whatsapp');
    }
    const rawYoutube =
      (typeof vjSettings.youtubeUrl === 'string' && vjSettings.youtubeUrl.trim()) ||
      (typeof legacy.youtube === 'string' && legacy.youtube.trim()) ||
      '';
    if (rawYoutube) {
      settingsPatch.youtubeUrl = normalizeSocialUrl(rawYoutube, 'youtube');
    }
    const rawFacebook =
      (typeof vjSettings.facebookUrl === 'string' && vjSettings.facebookUrl.trim()) ||
      (typeof legacy.facebook === 'string' && legacy.facebook.trim()) ||
      '';
    if (rawFacebook) {
      settingsPatch.facebookUrl = normalizeSocialUrl(rawFacebook, 'facebook');
    }
    const rawTiktok =
      (typeof vjSettings.tiktokUrl === 'string' && vjSettings.tiktokUrl.trim()) ||
      (typeof legacy.tiktok === 'string' && legacy.tiktok.trim()) ||
      '';
    if (rawTiktok) {
      settingsPatch.tiktokUrl = normalizeSocialUrl(rawTiktok, 'tiktok');
    }
    if (typeof legacy.r2PublicUrl === 'string' && legacy.r2PublicUrl.trim()) {
      const cleanR2 = sanitizeAssetUrl(legacy.r2PublicUrl);
      if (cleanR2) {
        settingsPatch.r2Endpoint = cleanR2;
        settingsPatch.r2Links = [cleanR2, '', '', '', ''];
      }
    }
    if (typeof vjSettings.genreLine === 'string' && vjSettings.genreLine.trim()) {
      settingsPatch.genreLine = vjSettings.genreLine;
    }
    if (typeof vjSettings.categoryLine === 'string' && vjSettings.categoryLine.trim()) {
      settingsPatch.categoryLine = vjSettings.categoryLine;
    }
    if (Array.isArray(vjSettings.paymentPlans) && vjSettings.paymentPlans.length > 0) {
      settingsPatch.paymentPlans = vjSettings.paymentPlans;
    }
  }

  return { movies, seriesIds, seasons, episodes, settingsPatch };
}

function sanitizePublicSettingsForCloud(settings: AppSettings): Partial<AppSettings> {
  return {
    appName: settings.appName,
    whatsappUrl: settings.whatsappUrl,
    youtubeUrl: settings.youtubeUrl,
    facebookUrl: settings.facebookUrl,
    tiktokUrl: settings.tiktokUrl,
    socialLinks: settings.socialLinks,
    genreLine: settings.genreLine ?? DEFAULT_GENRE_LINE,
    categoryLine: settings.categoryLine ?? DEFAULT_CATEGORY_LINE,
    paymentPlans: settings.paymentPlans,
    priceWeekly: settings.priceWeekly,
    priceMonthly: settings.priceMonthly,
    priceVip: settings.priceVip,
    showPosterLabel: settings.showPosterLabel,
    showPosterRating: settings.showPosterRating,
    showPosterSocialBar: settings.showPosterSocialBar,
    showPosterYear: settings.showPosterYear,
    showPosterActors: settings.showPosterActors,
    showPosterDescription: settings.showPosterDescription,
    r2Endpoint: settings.r2Endpoint,
    r2Links: settings.r2Links,
    pesapalIpnUrl: settings.pesapalIpnUrl,
  };
}

function sanitizeMovieForCloud(movie: Movie): Movie {
  const genresArr = parseMovieGenres(movie.genres, movie.genre);
  const categoriesArr = parseMovieGenres(movie.categories, movie.category);
  return {
    ...movie,
    genres: genresArr,
    genre: genresArr.join(', '),
    categories: categoriesArr,
    category: categoriesArr.join(', '),
    poster: movie.poster && !movie.poster.startsWith('idb://') ? sanitizeAssetUrl(movie.poster) : '',
    video: movie.video && !movie.video.startsWith('idb://') ? sanitizeAssetUrl(movie.video) : '',
  };
}

function mapMovieToSupabasePayload(movie: Movie): {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
} {
  const clean = sanitizeMovieForCloud(movie);
  const genresArr = parseMovieGenres(clean.genres, clean.genre);
  const categoriesArr = parseMovieGenres(clean.categories, clean.category);
  return {
    id: clean.id,
    data: {
      id: clean.id,
      title: clean.title,
      year: clean.year || '',
      duration: clean.duration || '',
      rating: clean.rating || '',
      category: categoriesArr.join(', '),
      categories: categoriesArr,
      genre: genresArr.join(', '),
      genres: genresArr,
      actors: clean.actors || '',
      label: clean.label || '',
      badge: clean.label || '',
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

function buildCategoriesAndGenres(genreLine: string, categoryLine?: string) {
  const parsedGenres = parseGenreLine(genreLine);
  const parsedCategories = parseCategoryLine(categoryLine);
  return {
    categories: parsedCategories.map((name, idx) => ({ id: `cat_${idx}`, name })),
    genres: parsedGenres.map((name, idx) => ({ id: `gen_${idx}`, name })),
  };
}

export async function fetchSupabasePublicState(
  currentState: AppState,
  _options: { forceRemote?: boolean } = {}
): Promise<Partial<AppState> | null> {
  try {
    const [
      moviesDoc,
      seriesDoc,
      settingsDoc,
      mediaDoc,
      socialDoc,
      supaMoviesRes,
      supaSettingsRes,
    ] = await Promise.all([
      readR2JsonDoc<MoviesCloudDoc>(DB_MOVIES_KEY),
      readR2JsonDoc<SeriesCloudDoc>(DB_SERIES_KEY),
      readR2JsonDoc<SettingsCloudDoc>(DB_SETTINGS_KEY),
      readR2JsonDoc<MediaCloudDoc>(DB_MEDIA_KEY),
      readR2JsonDoc<SocialCloudDoc>(DB_SOCIAL_KEY),
      supabase.from('movies').select('id, data, created_at, updated_at'),
      supabase.from('site_settings').select('key, value, updated_at').eq('key', 'public').maybeSingle(),
    ]);

    const needLegacyBootstrap = !moviesDoc || !seriesDoc || !settingsDoc;
    const legacySnapshot = needLegacyBootstrap
      ? await readR2JsonDoc<LegacyCatalogSnapshot>(LEGACY_CATALOG_KEY)
      : null;

    const supaRows =
      !supaMoviesRes.error && Array.isArray(supaMoviesRes.data)
        ? (supaMoviesRes.data as SupabaseMovieRow[])
        : [];
    const supaSettingsRow =
      !supaSettingsRes.error && supaSettingsRes.data
        ? (supaSettingsRes.data as SupabaseSiteSettingsRow)
        : null;

    const extractedSupa = extractSupabaseData(supaRows, supaSettingsRow);

    const bootstrapWrites: Promise<boolean>[] = [];

    // 1. RESOLVE MOVIES (bootstrap cleanly from legacy R2 + Supabase on first boot)
    let resolvedMovies: Movie[] = [];
    if (moviesDoc && Array.isArray(moviesDoc.items)) {
      resolvedMovies = moviesDoc.items.map(sanitizeMovieForCloud);
    } else {
      const mergedMap = new Map<string, Movie>();
      for (const m of extractedSupa.movies) {
        mergedMap.set(m.id, m);
      }
      if (legacySnapshot && Array.isArray(legacySnapshot.movies)) {
        for (const m of legacySnapshot.movies) {
          if (extractedSupa.seriesIds.has(m.id)) continue; // Keep Series in Series collection
          const prev = mergedMap.get(m.id);
          const cleanM = sanitizeMovieForCloud(m);
          mergedMap.set(m.id, prev ? { ...prev, ...cleanM, poster: cleanM.poster || prev.poster, video: cleanM.video || prev.video } : cleanM);
        }
      }
      resolvedMovies = Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);
      // Persist restored movies directly into dedicated Cloud DB doc
      if (resolvedMovies.length > 0) {
        bootstrapWrites.push(
          writeR2JsonDoc<MoviesCloudDoc>(DB_MOVIES_KEY, {
            version: 1,
            updatedAt: Date.now(),
            deletedIds: [],
            items: resolvedMovies,
          })
        );
      }
    }

    // 2. RESOLVE SERIES (SEASONS + EPISODES)
    let resolvedSeasons: Season[] = [];
    let resolvedEpisodes: Episode[] = [];
    if (seriesDoc && Array.isArray(seriesDoc.seasons)) {
      resolvedSeasons = seriesDoc.seasons;
      resolvedEpisodes = Array.isArray(seriesDoc.episodes) ? seriesDoc.episodes : [];
    } else {
      const seasonMap = new Map<string, Season>();
      const epMap = new Map<string, Episode>();
      for (const s of extractedSupa.seasons) seasonMap.set(s.id, s);
      for (const ep of extractedSupa.episodes) epMap.set(ep.id, ep);
      if (legacySnapshot) {
        if (Array.isArray(legacySnapshot.seasons)) {
          for (const s of legacySnapshot.seasons) seasonMap.set(s.id, s);
        }
        if (Array.isArray(legacySnapshot.episodes)) {
          for (const ep of legacySnapshot.episodes) epMap.set(ep.id, ep);
        }
      }
      resolvedSeasons = Array.from(seasonMap.values());
      resolvedEpisodes = Array.from(epMap.values());
      if (resolvedSeasons.length > 0 || resolvedEpisodes.length > 0) {
        bootstrapWrites.push(
          writeR2JsonDoc<SeriesCloudDoc>(DB_SERIES_KEY, {
            version: 1,
            updatedAt: Date.now(),
            deletedSeasonIds: [],
            deletedEpisodeIds: [],
            seasons: resolvedSeasons,
            episodes: resolvedEpisodes,
          })
        );
      }
    }

    // 3. RESOLVE SETTINGS (MERGE NON-EMPTY CLOUD SETTINGS SO LINKS NEVER GET WIPED)
    let resolvedSettings: AppSettings = { ...currentState.settings };
    if (settingsDoc && settingsDoc.settings && typeof settingsDoc.settings === 'object') {
      const cloudSet = settingsDoc.settings;
      const mergedR2 =
        Array.isArray(cloudSet.r2Links) && cloudSet.r2Links.some(Boolean)
          ? cloudSet.r2Links
          : extractedSupa.settingsPatch.r2Links || currentState.settings.r2Links;
      resolvedSettings = {
        ...currentState.settings,
        ...cloudSet,
        whatsappUrl:
          (cloudSet.whatsappUrl && cloudSet.whatsappUrl.trim()) ||
          extractedSupa.settingsPatch.whatsappUrl ||
          currentState.settings.whatsappUrl,
        youtubeUrl:
          (cloudSet.youtubeUrl && cloudSet.youtubeUrl.trim()) ||
          extractedSupa.settingsPatch.youtubeUrl ||
          '',
        facebookUrl:
          (cloudSet.facebookUrl && cloudSet.facebookUrl.trim()) ||
          extractedSupa.settingsPatch.facebookUrl ||
          '',
        tiktokUrl:
          (cloudSet.tiktokUrl && cloudSet.tiktokUrl.trim()) ||
          extractedSupa.settingsPatch.tiktokUrl ||
          '',
        r2Endpoint:
          (cloudSet.r2Endpoint && cloudSet.r2Endpoint.trim()) ||
          extractedSupa.settingsPatch.r2Endpoint ||
          '',
        r2Links: mergedR2,
        genreLine: !cloudSet.categoryLine
          ? mergeTagLines(cloudSet.genreLine, DEFAULT_GENRES_LIST)
          : typeof cloudSet.genreLine === 'string' && cloudSet.genreLine.trim()
            ? cloudSet.genreLine
            : currentState.settings.genreLine || DEFAULT_GENRE_LINE,
        categoryLine:
          typeof cloudSet.categoryLine === 'string' && cloudSet.categoryLine.trim()
            ? cloudSet.categoryLine
            : currentState.settings.categoryLine || DEFAULT_CATEGORY_LINE,
        paymentPlans:
          Array.isArray(cloudSet.paymentPlans) && cloudSet.paymentPlans.length > 0
            ? cloudSet.paymentPlans
            : currentState.settings.paymentPlans,
      };
      if (!cloudSet.categoryLine) {
        bootstrapWrites.push(
          writeR2JsonDoc<SettingsCloudDoc>(DB_SETTINGS_KEY, {
            version: 1,
            updatedAt: Date.now(),
            settings: {
              ...cloudSet,
              genreLine: resolvedSettings.genreLine,
              categoryLine: resolvedSettings.categoryLine,
            },
          })
        );
      }
    } else {
      const legSet = (legacySnapshot?.settings || {}) as Partial<AppSettings>;
      resolvedSettings = {
        ...currentState.settings,
        ...legSet,
        ...extractedSupa.settingsPatch,
        whatsappUrl:
          extractedSupa.settingsPatch.whatsappUrl ||
          (typeof legSet.whatsappUrl === 'string' ? legSet.whatsappUrl : '') ||
          currentState.settings.whatsappUrl,
        youtubeUrl:
          extractedSupa.settingsPatch.youtubeUrl ||
          (typeof legSet.youtubeUrl === 'string' ? legSet.youtubeUrl : '') ||
          '',
        facebookUrl:
          extractedSupa.settingsPatch.facebookUrl ||
          (typeof legSet.facebookUrl === 'string' ? legSet.facebookUrl : '') ||
          '',
        tiktokUrl:
          extractedSupa.settingsPatch.tiktokUrl ||
          (typeof legSet.tiktokUrl === 'string' ? legSet.tiktokUrl : '') ||
          '',
        genreLine: mergeTagLines(
          (typeof legSet.genreLine === 'string' && legSet.genreLine.trim()) ||
            extractedSupa.settingsPatch.genreLine,
          DEFAULT_GENRES_LIST
        ),
        categoryLine: mergeTagLines(
          (typeof legSet.categoryLine === 'string' && legSet.categoryLine.trim()) ||
            extractedSupa.settingsPatch.categoryLine,
          DEFAULT_CATEGORIES_LIST
        ),
        paymentPlans:
          Array.isArray(legSet.paymentPlans) && legSet.paymentPlans.length > 0
            ? legSet.paymentPlans
            : currentState.settings.paymentPlans,
      };
      bootstrapWrites.push(
        writeR2JsonDoc<SettingsCloudDoc>(DB_SETTINGS_KEY, {
          version: 1,
          updatedAt: Date.now(),
          settings: sanitizePublicSettingsForCloud(resolvedSettings),
        })
      );
    }

    // 4. RESOLVE BANNERS & LIVE TV
    const resolvedBanners =
      mediaDoc && Array.isArray(mediaDoc.banners)
        ? mediaDoc.banners
        : Array.isArray(legacySnapshot?.banners)
          ? legacySnapshot!.banners
          : currentState.banners;
    const resolvedChannels =
      mediaDoc && Array.isArray(mediaDoc.liveTvChannels)
        ? mediaDoc.liveTvChannels
        : Array.isArray(legacySnapshot?.liveTvChannels)
          ? legacySnapshot!.liveTvChannels
          : currentState.liveTvChannels;

    if (!mediaDoc && (resolvedBanners.length > 0 || resolvedChannels.length > 0)) {
      bootstrapWrites.push(
        writeR2JsonDoc<MediaCloudDoc>(DB_MEDIA_KEY, {
          version: 1,
          updatedAt: Date.now(),
          banners: resolvedBanners,
          liveTvChannels: resolvedChannels,
        })
      );
    }

    // 5. RESOLVE LIKES & COMMENTS
    const resolvedLikes =
      socialDoc && socialDoc.likes && typeof socialDoc.likes === 'object'
        ? socialDoc.likes
        : legacySnapshot?.likes && typeof legacySnapshot.likes === 'object'
          ? legacySnapshot.likes
          : currentState.likes;
    const resolvedComments =
      socialDoc && socialDoc.comments && typeof socialDoc.comments === 'object'
        ? socialDoc.comments
        : legacySnapshot?.comments && typeof legacySnapshot.comments === 'object'
          ? legacySnapshot.comments
          : currentState.comments;

    if (bootstrapWrites.length > 0) {
      await Promise.all(bootstrapWrites).catch(() => {});
    }

    const { categories, genres } = buildCategoriesAndGenres(
      resolvedSettings.genreLine || DEFAULT_GENRE_LINE,
      resolvedSettings.categoryLine || DEFAULT_CATEGORY_LINE
    );

    return {
      movies: resolvedMovies,
      seasons: resolvedSeasons,
      episodes: resolvedEpisodes,
      settings: resolvedSettings,
      categories,
      genres,
      banners: resolvedBanners,
      liveTvChannels: resolvedChannels,
      likes: resolvedLikes,
      comments: resolvedComments,
    };
  } catch (err) {
    console.warn('Cloud Database fetch failed:', err);
    return null;
  }
}

export async function syncStateChangesToSupabase(
  prev: AppState,
  next: AppState
): Promise<{ ok: boolean; error?: string; localOnly?: boolean }> {
  try {
    const ops: Promise<boolean>[] = [];

    // 1. MOVIES ONLY (Read-Merge-Write vjemma_db_movies_v1.json — NEVER touches settings or series)
    if (prev.movies !== next.movies) {
      const prevMap = new Map(prev.movies.map((m) => [m.id, m]));
      const nextIds = new Set(next.movies.map((m) => m.id));
      const changedMovies = next.movies.filter((m) => {
        const old = prevMap.get(m.id);
        return !old || JSON.stringify(old) !== JSON.stringify(m);
      });
      const deletedIds = prev.movies.filter((m) => !nextIds.has(m.id)).map((m) => m.id);

      ops.push(
        (async () => {
          const currentCloud = await readR2JsonDoc<MoviesCloudDoc>(DB_MOVIES_KEY);
          const cloudItems = Array.isArray(currentCloud?.items) ? currentCloud!.items : next.movies;
          const deletedSet = new Set<string>(Array.isArray(currentCloud?.deletedIds) ? currentCloud!.deletedIds : []);
          const mergedMap = new Map<string, Movie>();

          for (const item of cloudItems) {
            mergedMap.set(item.id, sanitizeMovieForCloud(item));
          }
          for (const ch of changedMovies) {
            deletedSet.delete(ch.id);
            const existingCloud = mergedMap.get(ch.id);
            const clean = sanitizeMovieForCloud(ch);
            // If old poster existed in cloud and Admin didn't explicitly clear poster, preserve unless changed
            const prevLocal = prevMap.get(ch.id);
            const explicitlyClearedPoster = Boolean(prevLocal?.poster && !clean.poster);
            const finalPoster = explicitlyClearedPoster
              ? ''
              : clean.poster || existingCloud?.poster || '';
            const explicitlyClearedVideo = Boolean(prevLocal?.video && !clean.video);
            const finalVideo = explicitlyClearedVideo
              ? ''
              : clean.video || existingCloud?.video || '';
            mergedMap.set(ch.id, {
              ...clean,
              poster: finalPoster,
              video: finalVideo,
            });
          }
          for (const delId of deletedIds) {
            deletedSet.add(delId);
            mergedMap.delete(delId);
          }

          const mergedList = Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);
          const okR2 = await writeR2JsonDoc<MoviesCloudDoc>(DB_MOVIES_KEY, {
            version: 1,
            updatedAt: Date.now(),
            deletedIds: Array.from(deletedSet),
            items: mergedList,
          });

          // Best-effort Supabase mirror
          if (changedMovies.length > 0) {
            supabase
              .from('movies')
              .upsert(changedMovies.map(mapMovieToSupabasePayload), { onConflict: 'id' })
              .then((res) => {
                if (res.error && !isRlsPolicyError(res.error)) {
                  console.warn('Supabase movies sync note:', res.error.message);
                }
              });
          }
          if (deletedIds.length > 0) {
            supabase
              .from('movies')
              .delete()
              .in('id', deletedIds)
              .then((res) => {
                if (res.error && !isRlsPolicyError(res.error)) {
                  console.warn('Supabase movies delete note:', res.error.message);
                }
              });
          }

          return okR2;
        })()
      );
    }

    // 2. SERIES (SEASONS & EPISODES) ONLY (NEVER touches movies or settings)
    if (prev.seasons !== next.seasons || prev.episodes !== next.episodes) {
      const prevSeasonMap = new Map(prev.seasons.map((s) => [s.id, s]));
      const nextSeasonIds = new Set(next.seasons.map((s) => s.id));
      const changedSeasons = next.seasons.filter((s) => {
        const old = prevSeasonMap.get(s.id);
        return !old || JSON.stringify(old) !== JSON.stringify(s);
      });
      const deletedSeasonIds = prev.seasons.filter((s) => !nextSeasonIds.has(s.id)).map((s) => s.id);

      const prevEpMap = new Map(prev.episodes.map((e) => [e.id, e]));
      const nextEpIds = new Set(next.episodes.map((e) => e.id));
      const changedEpisodes = next.episodes.filter((e) => {
        const old = prevEpMap.get(e.id);
        return !old || JSON.stringify(old) !== JSON.stringify(e);
      });
      const deletedEpIds = prev.episodes.filter((e) => !nextEpIds.has(e.id)).map((e) => e.id);

      ops.push(
        (async () => {
          const currentCloud = await readR2JsonDoc<SeriesCloudDoc>(DB_SERIES_KEY);
          const seasonMap = new Map<string, Season>(
            (Array.isArray(currentCloud?.seasons) ? currentCloud!.seasons : next.seasons).map((s) => [s.id, s])
          );
          const epMap = new Map<string, Episode>(
            (Array.isArray(currentCloud?.episodes) ? currentCloud!.episodes : next.episodes).map((e) => [e.id, e])
          );
          const delSeasonSet = new Set<string>(currentCloud?.deletedSeasonIds || []);
          const delEpSet = new Set<string>(currentCloud?.deletedEpisodeIds || []);

          for (const s of changedSeasons) {
            delSeasonSet.delete(s.id);
            const prevLocal = prevSeasonMap.get(s.id);
            const existingCloud = seasonMap.get(s.id);
            const clearedPoster = Boolean(prevLocal?.poster && !s.poster);
            seasonMap.set(s.id, {
              ...s,
              poster: clearedPoster ? '' : sanitizeAssetUrl(s.poster) || existingCloud?.poster || '',
            });
          }
          for (const delId of deletedSeasonIds) {
            delSeasonSet.add(delId);
            seasonMap.delete(delId);
          }

          for (const ep of changedEpisodes) {
            delEpSet.delete(ep.id);
            const existingCloud = epMap.get(ep.id);
            epMap.set(ep.id, {
              ...ep,
              video: sanitizeAssetUrl(ep.video) || existingCloud?.video || '',
            });
          }
          for (const delId of deletedEpIds) {
            delEpSet.add(delId);
            epMap.delete(delId);
          }

          return writeR2JsonDoc<SeriesCloudDoc>(DB_SERIES_KEY, {
            version: 1,
            updatedAt: Date.now(),
            deletedSeasonIds: Array.from(delSeasonSet),
            deletedEpisodeIds: Array.from(delEpSet),
            seasons: Array.from(seasonMap.values()),
            episodes: Array.from(epMap.values()),
          });
        })()
      );
    }

    // 3. SETTINGS ONLY (Diff-merge ONLY changed setting keys — NEVER overwrites Movies or Series)
    if (prev.settings !== next.settings) {
      const prevPublic = sanitizePublicSettingsForCloud(prev.settings) as Record<string, unknown>;
      const nextPublic = sanitizePublicSettingsForCloud(next.settings) as Record<string, unknown>;
      const changedPatch: Record<string, unknown> = {};

      for (const key of Object.keys(nextPublic)) {
        if (JSON.stringify(prevPublic[key]) !== JSON.stringify(nextPublic[key])) {
          changedPatch[key] = nextPublic[key];
        }
      }

      if (Object.keys(changedPatch).length > 0) {
        ops.push(
          (async () => {
            const currentCloud = await readR2JsonDoc<SettingsCloudDoc>(DB_SETTINGS_KEY);
            const baseSettings =
              currentCloud?.settings && typeof currentCloud.settings === 'object'
                ? (currentCloud.settings as Record<string, unknown>)
                : prevPublic;

            const mergedSettings = {
              ...baseSettings,
              ...changedPatch,
            } as Partial<AppSettings>;

            const okR2 = await writeR2JsonDoc<SettingsCloudDoc>(DB_SETTINGS_KEY, {
              version: 1,
              updatedAt: Date.now(),
              settings: mergedSettings,
            });

            // Best-effort Supabase mirror
            const parsedGenres = parseGenreLine(
              typeof mergedSettings.genreLine === 'string'
                ? mergedSettings.genreLine
                : next.settings.genreLine
            );
            const parsedCategories = parseCategoryLine(
              typeof mergedSettings.categoryLine === 'string'
                ? mergedSettings.categoryLine
                : next.settings.categoryLine
            );
            const existingLegacy =
              cachedSiteSettingsBase.settings && typeof cachedSiteSettingsBase.settings === 'object'
                ? (cachedSiteSettingsBase.settings as Record<string, unknown>)
                : {};
            const nextSupaVal: Record<string, unknown> = {
              ...cachedSiteSettingsBase,
              genres: parsedGenres.map((name) => ({
                id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name,
              })),
              categories: parsedCategories.map((name) => ({
                id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name,
                slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              })),
              settings: {
                ...existingLegacy,
                siteName: mergedSettings.appName || next.settings.appName,
                whatsapp: mergedSettings.whatsappUrl ?? next.settings.whatsappUrl,
                youtube: mergedSettings.youtubeUrl ?? next.settings.youtubeUrl,
                facebook: mergedSettings.facebookUrl ?? next.settings.facebookUrl,
                tiktok: mergedSettings.tiktokUrl ?? next.settings.tiktokUrl,
              },
            };
            cachedSiteSettingsBase = nextSupaVal;
            supabase
              .from('site_settings')
              .upsert({ key: 'public', value: nextSupaVal, updated_at: new Date().toISOString() }, { onConflict: 'key' })
              .then(() => {});

            return okR2;
          })()
        );
      }
    }

    // 4. BANNERS & LIVE TV ONLY
    if (prev.banners !== next.banners || prev.liveTvChannels !== next.liveTvChannels) {
      const prevBannerMap = new Map(prev.banners.map((b) => [b.id, b]));
      const nextBannerIds = new Set(next.banners.map((b) => b.id));
      const changedBanners = next.banners.filter((b) => {
        const old = prevBannerMap.get(b.id);
        return !old || JSON.stringify(old) !== JSON.stringify(b);
      });
      const deletedBannerIds = prev.banners.filter((b) => !nextBannerIds.has(b.id)).map((b) => b.id);

      const prevChMap = new Map((prev.liveTvChannels || []).map((c) => [c.id, c]));
      const nextChIds = new Set((next.liveTvChannels || []).map((c) => c.id));
      const changedChannels = (next.liveTvChannels || []).filter((c) => {
        const old = prevChMap.get(c.id);
        return !old || JSON.stringify(old) !== JSON.stringify(c);
      });
      const deletedChIds = (prev.liveTvChannels || []).filter((c) => !nextChIds.has(c.id)).map((c) => c.id);

      ops.push(
        (async () => {
          const currentCloud = await readR2JsonDoc<MediaCloudDoc>(DB_MEDIA_KEY);
          const bannerMap = new Map<string, Banner>(
            (Array.isArray(currentCloud?.banners) ? currentCloud!.banners : next.banners).map((b) => [b.id, b])
          );
          const chMap = new Map<string, LiveTvChannel>(
            (Array.isArray(currentCloud?.liveTvChannels) ? currentCloud!.liveTvChannels : (next.liveTvChannels || [])).map((c) => [c.id, c])
          );

          for (const b of changedBanners) {
            const existingCloud = bannerMap.get(b.id);
            bannerMap.set(b.id, {
              ...b,
              image: sanitizeAssetUrl(b.image) || existingCloud?.image || '',
            });
          }
          for (const id of deletedBannerIds) bannerMap.delete(id);
          for (const c of changedChannels) {
            const prevLocal = prevChMap.get(c.id);
            const existingCloud = chMap.get(c.id);
            const clearedPoster = Boolean(prevLocal?.poster && !c.poster);
            chMap.set(c.id, {
              ...c,
              poster: clearedPoster ? '' : sanitizeAssetUrl(c.poster) || existingCloud?.poster || '',
            });
          }
          for (const id of deletedChIds) chMap.delete(id);

          return writeR2JsonDoc<MediaCloudDoc>(DB_MEDIA_KEY, {
            version: 1,
            updatedAt: Date.now(),
            banners: Array.from(bannerMap.values()),
            liveTvChannels: Array.from(chMap.values()),
          });
        })()
      );
    }

    // 5. LIKES & COMMENTS ONLY
    if (prev.likes !== next.likes || prev.comments !== next.comments) {
      ops.push(
        (async () => {
          const currentCloud = await readR2JsonDoc<SocialCloudDoc>(DB_SOCIAL_KEY);
          const mergedLikes: Record<string, LikeRecord> = {
            ...(currentCloud?.likes || {}),
          };
          for (const [id, rec] of Object.entries(next.likes)) {
            if (JSON.stringify(prev.likes[id]) !== JSON.stringify(rec)) {
              mergedLikes[id] = rec;
            }
          }
          const mergedComments: Record<string, CommentItem[]> = {
            ...(currentCloud?.comments || {}),
          };
          for (const [id, list] of Object.entries(next.comments)) {
            if (JSON.stringify(prev.comments[id]) !== JSON.stringify(list)) {
              mergedComments[id] = list;
            }
          }
          return writeR2JsonDoc<SocialCloudDoc>(DB_SOCIAL_KEY, {
            version: 1,
            updatedAt: Date.now(),
            likes: mergedLikes,
            comments: mergedComments,
          });
        })()
      );
    }

    if (ops.length === 0) return { ok: true };
    const results = await Promise.all(ops);
    if (results.some((ok) => !ok)) {
      return { ok: false, error: 'Could not save one or more items to Cloud Database.' };
    }
    return { ok: true, localOnly: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cloud Database sync failed' };
  }
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatSupabaseError(err: { code?: string; message?: string; details?: string } | null): string {
  if (!err) return 'Unknown Supabase error.';
  const code = err.code ? `[${err.code}] ` : '';
  const msg = err.message || 'Supabase request failed';
  const details = err.details ? ` (${err.details})` : '';
  return `${code}${msg}${details}`;
}

function mapPaymentRequestRowToUser(row: PaymentRequestRecord): UserAccount {
  const status: AccountStatus =
    row.status === 'approved' || row.status === 'blocked' ? row.status : 'pending';
  const createdMs = row.created_at ? Date.parse(row.created_at) : NaN;
  const createdAt = Number.isFinite(createdMs) ? createdMs : Date.now();
  const expiry = Number(row.expiry || 0);
  const amount = Number(row.amount || 0);
  const days = Math.max(1, Number(row.days || 1));

  return {
    id: String(row.id),
    name: row.name ? String(row.name) : undefined,
    phone: String(row.phone || '').trim(),
    email: String(row.email || '').trim(),
    password: '',
    subscribed: status === 'approved',
    plan: status === 'approved' ? String(row.plan || 'VIP') : null,
    pendingPlan: status === 'pending' ? String(row.plan || 'Subscription') : null,
    pendingAmount: amount,
    pendingDays: days,
    paymentMethod: String(row.payment_method || 'Manual WhatsApp'),
    status,
    expiry,
    createdAt,
  };
}

export async function fetchPaymentRequestsFromSupabase(): Promise<{
  ok: boolean;
  users: UserAccount[];
  transactions: WalletTransaction[];
  wallet: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return {
        ok: false,
        users: [],
        transactions: [],
        wallet: 0,
        error: formatSupabaseError(error),
      };
    }

    const rows = Array.isArray(data) ? (data as PaymentRequestRecord[]) : [];
    const users = rows.map(mapPaymentRequestRowToUser);
    let wallet = 0;
    const transactions: WalletTransaction[] = rows.map((row) => {
      const amount = Number(row.amount || 0);
      const createdMs = row.created_at ? Date.parse(row.created_at) : NaN;
      const isApproved = row.status === 'approved';
      if (isApproved && Number.isFinite(amount) && amount > 0) {
        wallet += amount;
      }
      return {
        id: `tx_${row.id}`,
        name: row.name ? String(row.name) : undefined,
        phone: String(row.phone || '').trim(),
        email: String(row.email || '').trim(),
        plan: String(row.plan || 'Subscription'),
        amount,
        method: String(row.payment_method || 'Manual WhatsApp'),
        status: isApproved ? 'completed' : 'pending',
        createdAt: Number.isFinite(createdMs) ? createdMs : Date.now(),
      };
    });

    return { ok: true, users, transactions, wallet };
  } catch (err) {
    return {
      ok: false,
      users: [],
      transactions: [],
      wallet: 0,
      error: err instanceof Error ? err.message : 'Failed to load payment_requests from Supabase.',
    };
  }
}

export async function insertPaymentRequestToSupabase(input: {
  name?: string;
  phone: string;
  email: string;
  plan: string;
  amount: number;
  days: number;
  paymentMethod: string;
  status?: AccountStatus;
  expiry?: number;
}): Promise<{ ok: boolean; user?: UserAccount; error?: string }> {
  try {
    const payload: PaymentRequestRecord = {
      id: generateUuid(),
      name: input.name?.trim() || null,
      phone: input.phone.trim(),
      email: input.email.trim(),
      plan: input.plan.trim(),
      amount: Number(input.amount || 0),
      days: Math.max(1, Number(input.days || 1)),
      payment_method: input.paymentMethod.trim() || 'Manual WhatsApp',
      status: input.status || 'pending',
      expiry: Number(input.expiry || 0),
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('payment_requests')
      .insert([payload])
      .select('*')
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: formatSupabaseError(error || { message: 'Supabase did not return saved row.' }),
      };
    }

    return {
      ok: true,
      user: mapPaymentRequestRowToUser(data as PaymentRequestRecord),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to insert into Supabase payment_requests.',
    };
  }
}

export async function updatePaymentRequestInSupabase(
  id: string,
  patch: Partial<Pick<PaymentRequestRecord, 'status' | 'expiry' | 'plan' | 'amount' | 'days' | 'payment_method'>>
): Promise<{ ok: boolean; user?: UserAccount; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payment_requests')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: formatSupabaseError(error || { message: 'Could not update payment_requests row.' }),
      };
    }

    return {
      ok: true,
      user: mapPaymentRequestRowToUser(data as PaymentRequestRecord),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update Supabase payment_requests.',
    };
  }
}

export async function deletePaymentRequestInSupabase(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('payment_requests').delete().eq('id', id);
    if (error) {
      return { ok: false, error: formatSupabaseError(error) };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete row from payment_requests.',
    };
  }
}

export function subscribeToSupabasePublicChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('vjemma-public-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => {});
  };
}
