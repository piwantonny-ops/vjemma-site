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

// In-memory Admin Bearer token (never persisted in localStorage/sessionStorage)
let adminBearerToken: string | null = null;

export function setAdminBearerToken(token: string | null): void {
  adminBearerToken = token ? token.trim() : null;
}

export function hasAdminBearerToken(): boolean {
  return Boolean(adminBearerToken);
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (adminBearerToken) {
    headers.Authorization = `Bearer ${adminBearerToken}`;
  }
  return headers;
}

export async function checkAdminServerStatus(): Promise<{
  configured: boolean;
  envLocked: boolean;
  authenticated: boolean;
}> {
  try {
    const res = await fetch('/api/admin/status', {
      method: 'GET',
      cache: 'no-store',
      headers: adminBearerToken ? { Authorization: `Bearer ${adminBearerToken}` } : {},
    });
    if (!res.ok) return { configured: true, envLocked: false, authenticated: false };
    const data = (await res.json()) as {
      configured?: boolean;
      envLocked?: boolean;
      authenticated?: boolean;
    };
    return {
      configured: Boolean(data.configured),
      envLocked: Boolean(data.envLocked),
      authenticated: Boolean(data.authenticated),
    };
  } catch {
    return { configured: true, envLocked: false, authenticated: false };
  }
}

export async function loginAdminToD1(
  identifier: string,
  password: string
): Promise<{ ok: boolean; email?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ identifier, password }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      token?: string;
      email?: string;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.token) {
      return { ok: false, error: data.error || `Admin login failed (HTTP ${res.status}).` };
    }
    setAdminBearerToken(data.token);
    return { ok: true, email: data.email };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to reach Admin login endpoint.',
    };
  }
}

export async function updateAdminPasswordInD1(
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/password', {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ newPassword }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Could not update Admin password (HTTP ${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update Admin password.',
    };
  }
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
    poster:
      movie.poster && !movie.poster.startsWith('idb://') ? sanitizeAssetUrl(movie.poster) : '',
    video: movie.video && !movie.video.startsWith('idb://') ? sanitizeAssetUrl(movie.video) : '',
  };
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

export async function fetchD1PublicState(
  currentState: AppState
): Promise<Partial<AppState> | null> {
  try {
    const res = await fetch(`/api/catalog?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      movies?: Movie[];
      seasons?: Season[];
      episodes?: Episode[];
      settings?: Partial<AppSettings>;
      banners?: Banner[];
      liveTvChannels?: LiveTvChannel[];
      likes?: Record<string, LikeRecord>;
      comments?: Record<string, CommentItem[]>;
    } | null;

    if (!data || !data.ok) return null;

    const resolvedMovies = Array.isArray(data.movies)
      ? data.movies.map(sanitizeMovieForCloud)
      : currentState.movies;
    const resolvedSeasons = Array.isArray(data.seasons) ? data.seasons : currentState.seasons;
    const resolvedEpisodes = Array.isArray(data.episodes) ? data.episodes : currentState.episodes;

    const cloudSet = data.settings && typeof data.settings === 'object' ? data.settings : {};
    const mergedR2 =
      Array.isArray(cloudSet.r2Links) && cloudSet.r2Links.some(Boolean)
        ? cloudSet.r2Links
        : currentState.settings.r2Links;

    const resolvedSettings: AppSettings = {
      ...currentState.settings,
      ...cloudSet,
      whatsappUrl:
        (cloudSet.whatsappUrl && normalizeSocialUrl(cloudSet.whatsappUrl, 'whatsapp')) ||
        currentState.settings.whatsappUrl,
      youtubeUrl: cloudSet.youtubeUrl ? normalizeSocialUrl(cloudSet.youtubeUrl, 'youtube') : '',
      facebookUrl: cloudSet.facebookUrl ? normalizeSocialUrl(cloudSet.facebookUrl, 'facebook') : '',
      tiktokUrl: cloudSet.tiktokUrl ? normalizeSocialUrl(cloudSet.tiktokUrl, 'tiktok') : '',
      r2Endpoint: (cloudSet.r2Endpoint && sanitizeAssetUrl(cloudSet.r2Endpoint)) || '',
      r2Links: mergedR2,
      genreLine: !cloudSet.categoryLine
        ? mergeTagLines(cloudSet.genreLine, DEFAULT_GENRES_LIST)
        : typeof cloudSet.genreLine === 'string' && cloudSet.genreLine.trim()
          ? cloudSet.genreLine
          : currentState.settings.genreLine || DEFAULT_GENRE_LINE,
      categoryLine:
        typeof cloudSet.categoryLine === 'string' && cloudSet.categoryLine.trim()
          ? cloudSet.categoryLine
          : mergeTagLines(undefined, DEFAULT_CATEGORIES_LIST),
      paymentPlans:
        Array.isArray(cloudSet.paymentPlans) && cloudSet.paymentPlans.length > 0
          ? cloudSet.paymentPlans
          : currentState.settings.paymentPlans,
    };

    const resolvedBanners = Array.isArray(data.banners) ? data.banners : currentState.banners;
    const resolvedChannels = Array.isArray(data.liveTvChannels)
      ? data.liveTvChannels
      : currentState.liveTvChannels;
    const resolvedLikes =
      data.likes && typeof data.likes === 'object' ? data.likes : currentState.likes;
    const resolvedComments =
      data.comments && typeof data.comments === 'object' ? data.comments : currentState.comments;

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
    console.warn('Cloudflare D1 catalog fetch failed:', err);
    return null;
  }
}

export async function syncStateChangesToD1(
  prev: AppState,
  next: AppState
): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: Record<string, unknown> = {};

    // 1. Movies diff (preserve old poster/video URLs unless explicitly cleared)
    if (prev.movies !== next.movies) {
      const prevMap = new Map(prev.movies.map((m) => [m.id, m]));
      const nextIds = new Set(next.movies.map((m) => m.id));
      const changedMovies = next.movies
        .filter((m) => {
          const old = prevMap.get(m.id);
          return !old || JSON.stringify(old) !== JSON.stringify(m);
        })
        .map((ch) => {
          const prevLocal = prevMap.get(ch.id);
          const clean = sanitizeMovieForCloud(ch);
          const explicitlyClearedPoster = Boolean(prevLocal?.poster && !clean.poster);
          const explicitlyClearedVideo = Boolean(prevLocal?.video && !clean.video);
          return {
            ...clean,
            poster: explicitlyClearedPoster ? '' : clean.poster || prevLocal?.poster || '',
            video: explicitlyClearedVideo ? '' : clean.video || prevLocal?.video || '',
          };
        });
      const deletedMovieIds = prev.movies.filter((m) => !nextIds.has(m.id)).map((m) => m.id);
      if (changedMovies.length > 0) payload.changedMovies = changedMovies;
      if (deletedMovieIds.length > 0) payload.deletedMovieIds = deletedMovieIds;
    }

    // 2. Series (Seasons & Episodes)
    if (prev.seasons !== next.seasons || prev.episodes !== next.episodes) {
      payload.seasons = next.seasons.map((s) => ({
        ...s,
        poster: sanitizeAssetUrl(s.poster),
      }));
      payload.episodes = next.episodes.map((ep) => ({
        ...ep,
        video: sanitizeAssetUrl(ep.video),
      }));
    }

    // 3. Settings diff (only changed keys)
    if (prev.settings !== next.settings) {
      const prevPublic = sanitizePublicSettingsForCloud(prev.settings) as Record<string, unknown>;
      const nextPublic = sanitizePublicSettingsForCloud(next.settings) as Record<string, unknown>;
      const settingsPatch: Record<string, unknown> = {};
      for (const key of Object.keys(nextPublic)) {
        if (JSON.stringify(prevPublic[key]) !== JSON.stringify(nextPublic[key])) {
          settingsPatch[key] = nextPublic[key];
        }
      }
      if (Object.keys(settingsPatch).length > 0) {
        payload.settingsPatch = settingsPatch;
      }
    }

    // 4. Media (Banners & Live TV)
    if (prev.banners !== next.banners) {
      payload.banners = next.banners.map((b) => ({
        ...b,
        image: sanitizeAssetUrl(b.image),
      }));
    }
    if (prev.liveTvChannels !== next.liveTvChannels) {
      payload.liveTvChannels = (next.liveTvChannels || []).map((c) => ({
        ...c,
        poster: sanitizeAssetUrl(c.poster),
      }));
    }

    // 5. Likes & Comments
    if (prev.likes !== next.likes) {
      const likesPatch: Record<string, LikeRecord> = {};
      for (const [id, rec] of Object.entries(next.likes)) {
        if (JSON.stringify(prev.likes[id]) !== JSON.stringify(rec)) {
          likesPatch[id] = rec;
        }
      }
      if (Object.keys(likesPatch).length > 0) payload.likesPatch = likesPatch;
    }
    if (prev.comments !== next.comments) {
      const commentsPatch: Record<string, CommentItem[]> = {};
      for (const [id, list] of Object.entries(next.comments)) {
        if (JSON.stringify(prev.comments[id]) !== JSON.stringify(list)) {
          commentsPatch[id] = list;
        }
      }
      if (Object.keys(commentsPatch).length > 0) payload.commentsPatch = commentsPatch;
    }

    if (Object.keys(payload).length === 0) return { ok: true };

    const res = await fetch('/api/catalog/sync', {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Could not save changes to D1 (HTTP ${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Cloudflare D1 catalog sync failed.',
    };
  }
}

function mapPaymentRequestRowToUser(row: PaymentRequestRecord): UserAccount {
  const status: AccountStatus =
    row.status === 'approved' || row.status === 'blocked' ? row.status : 'pending';
  const createdMs = row.created_at ? Date.parse(row.created_at) : NaN;
  const createdAt = Number.isFinite(createdMs) ? createdMs : Date.now();
  const days = Math.max(1, Number(row.days || 1));
  const rawExpiry = Number(row.expiry || 0);
  const expiry =
    status === 'approved'
      ? rawExpiry > 0
        ? rawExpiry
        : createdAt + days * 86400000
      : 0;
  const amount = Number(row.amount || 0);
  const clientName = row.client_name ?? row.name ?? null;
  const clientPhone = String(row.client_phone ?? row.phone ?? '').trim();
  const method = String(row.method ?? row.payment_method ?? 'whatsapp').trim();

  return {
    id: String(row.id),
    name: clientName ? String(clientName) : undefined,
    phone: clientPhone,
    email: String(row.email || '').trim(),
    password: '',
    subscribed: status === 'approved',
    plan: status === 'approved' ? String(row.plan || 'VIP') : null,
    pendingPlan: status === 'pending' ? String(row.plan || 'Subscription') : null,
    pendingAmount: amount,
    pendingDays: days,
    paymentMethod: method,
    status,
    expiry,
    createdAt,
  };
}

async function fetchD1PaymentApi<T>(
  url: string,
  init: RequestInit,
  fallbackError: string
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  let lastNetworkErr: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        cache: 'no-store',
      });
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const rawText = await res.text();

      if (contentType.includes('text/html') || rawText.trimStart().startsWith('<')) {
        return {
          ok: false,
          status: res.status,
          error:
            'Cloudflare D1 API (/api/payment-requests) returned HTML instead of JSON. Deploy with Cloudflare Functions/Worker and bind D1 "DB" -> "vjemmadb".',
        };
      }

      let parsed: (T & { ok?: boolean; error?: string }) | null = null;
      try {
        parsed = rawText ? (JSON.parse(rawText) as T & { ok?: boolean; error?: string }) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok || !parsed || parsed.ok === false) {
        const msg =
          parsed?.error ||
          (res.status === 401
            ? 'Admin session expired or missing. Please sign in to /admin again.'
            : `${fallbackError} (HTTP ${res.status}).`);
        return { ok: false, status: res.status, error: msg };
      }

      return { ok: true, status: res.status, data: parsed };
    } catch (err) {
      lastNetworkErr = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  const rawMsg = lastNetworkErr instanceof Error ? lastNetworkErr.message : '';
  const isNetworkFetchError =
    /failed to fetch|networkerror|load failed/i.test(rawMsg) || !rawMsg;
  return {
    ok: false,
    status: 0,
    error: isNetworkFetchError
      ? 'Could not reach Cloudflare D1 API (/api/payment-requests). Check your connection or reload to clear old browser cache.'
      : rawMsg,
  };
}

export async function fetchPaymentRequestsFromD1(lookup?: {
  phone?: string;
  email?: string;
  forceAdmin?: boolean;
}): Promise<{
  ok: boolean;
  status?: number;
  users: UserAccount[];
  transactions: WalletTransaction[];
  wallet: number;
  error?: string;
}> {
  const isAdmin = Boolean(lookup?.forceAdmin || hasAdminBearerToken());
  const cleanPhone = (lookup?.phone || '').trim();
  const cleanEmail = (lookup?.email || '').trim();
  if (!isAdmin && !cleanPhone && !cleanEmail) {
    return { ok: true, users: [], transactions: [], wallet: 0 };
  }

  const params = new URLSearchParams({ t: String(Date.now()) });
  if (!isAdmin) {
    if (cleanPhone) params.set('phone', cleanPhone);
    if (cleanEmail) params.set('email', cleanEmail);
  }

  const res = await fetchD1PaymentApi<{ rows?: PaymentRequestRecord[] }>(
    `/api/payment-requests?${params.toString()}`,
    {
      method: 'GET',
      headers: adminBearerToken ? { Authorization: `Bearer ${adminBearerToken}` } : {},
    },
    'Failed to load payment_requests from D1'
  );

  if (!res.ok || !res.data) {
    return {
      ok: false,
      status: res.status,
      users: [],
      transactions: [],
      wallet: 0,
      error: res.error || 'Failed to load payment_requests from D1.',
    };
  }

  const rows = Array.isArray(res.data.rows) ? res.data.rows : [];
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
      name: (row.client_name ?? row.name) ? String(row.client_name ?? row.name) : undefined,
      phone: String(row.client_phone ?? row.phone ?? '').trim(),
      email: String(row.email || '').trim(),
      plan: String(row.plan || 'Subscription'),
      amount,
      method: String(row.method ?? row.payment_method ?? 'whatsapp'),
      status: isApproved ? 'completed' : 'pending',
      createdAt: Number.isFinite(createdMs) ? createdMs : Date.now(),
    };
  });

  return { ok: true, status: res.status, users, transactions, wallet };
}

export async function insertPaymentRequestToD1(input: {
  client_name?: string;
  client_phone: string;
  email?: string;
  plan: string;
  amount: number;
  days: number;
  method: string;
  status?: AccountStatus;
  expiry?: number;
}): Promise<{ ok: boolean; status?: number; user?: UserAccount; error?: string }> {
  const res = await fetchD1PaymentApi<{ row?: PaymentRequestRecord }>(
    '/api/payment-requests',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        client_name: input.client_name?.trim() || null,
        client_phone: input.client_phone.trim(),
        email: input.email?.trim() || '',
        plan: input.plan.trim(),
        amount: Number(input.amount || 0),
        days: Math.max(1, Number(input.days || 1)),
        method: input.method.trim() || 'whatsapp',
        status: input.status || 'pending',
        expiry: Number(input.expiry || 0),
      }),
    },
    'Could not save payment request to D1'
  );

  if (!res.ok || !res.data?.row) {
    return {
      ok: false,
      status: res.status,
      error: res.error || 'Failed to insert into D1 payment_requests.',
    };
  }
  return { ok: true, status: res.status, user: mapPaymentRequestRowToUser(res.data.row) };
}

export async function updatePaymentRequestInD1(
  id: string,
  patch: Partial<{
    status: AccountStatus;
    expiry: number;
    plan: string;
    amount: number;
    days: number;
    method: string;
  }>
): Promise<{ ok: boolean; status?: number; user?: UserAccount; error?: string }> {
  const res = await fetchD1PaymentApi<{ row?: PaymentRequestRecord }>(
    `/api/payment-requests/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    },
    'Could not update payment_requests in D1'
  );

  if (!res.ok || !res.data?.row) {
    return {
      ok: false,
      status: res.status,
      error: res.error || 'Failed to update D1 payment_requests.',
    };
  }
  return { ok: true, status: res.status, user: mapPaymentRequestRowToUser(res.data.row) };
}

export async function deletePaymentRequestInD1(
  id: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const res = await fetchD1PaymentApi<{ ok?: boolean }>(
    `/api/payment-requests/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
    'Could not delete row from D1 payment_requests'
  );

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: res.error || 'Failed to delete row from D1 payment_requests.',
    };
  }
  return { ok: true, status: res.status };
}
