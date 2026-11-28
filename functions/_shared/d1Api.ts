import type { D1Database, D1Env } from './d1Types';

const DEFAULT_R2_WORKER_URL = 'https://vjemma-upload.piwantonny.workers.dev';
const LOCKED_ADMIN_EMAIL = 'piwantonny@gmail.com';

const ALLOWED_ORIGINS = new Set([
  'https://vjemma.site',
  'https://www.vjemma.site',
]);

let ephemeralSessionSecret: Uint8Array<ArrayBuffer> | null = null;

interface PaymentTableMeta {
  columns: Set<string>;
  idIsIntegerPk: boolean;
}

interface MoviesTableMeta {
  columns: Set<string>;
  hasDataJsonCol: boolean;
}

function getCorsHeaders(request: Request): Record<string, string> {
  const reqOrigin = (request.headers.get('Origin') || '').trim();
  const allowOrigin =
    ALLOWED_ORIGINS.has(reqOrigin) ||
    reqOrigin.endsWith('.vjemma.site') ||
    reqOrigin.endsWith('.pages.dev') ||
    reqOrigin.endsWith('.workers.dev') ||
    reqOrigin.endsWith('.run.app') ||
    reqOrigin.startsWith('http://localhost:') ||
    reqOrigin.startsWith('http://127.0.0.1:')
      ? reqOrigin
      : 'https://vjemma.site';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };
}

function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...getCorsHeaders(request),
      ...extraHeaders,
    },
  });
}

function resolveD1(env: D1Env): { db: D1Database | null; bindingName: string } {
  if (env.DB) return { db: env.DB, bindingName: 'DB' };
  if (env.vjemmadb) return { db: env.vjemmadb, bindingName: 'vjemmadb' };
  if (env.VJEMMADB) return { db: env.VJEMMADB, bindingName: 'VJEMMADB' };
  if (env.d1) return { db: env.d1, bindingName: 'd1' };
  return { db: null, bindingName: '' };
}

function randomHex(byteLen = 16): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return timingSafeEqualBytes(enc.encode(a), enc.encode(b));
}

function encodeUtf8Buffer(str: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(str);
  const buf = new Uint8Array(new ArrayBuffer(encoded.length));
  buf.set(encoded);
  return buf;
}

async function getSessionSecretBytes(
  env: D1Env,
  db?: D1Database | null
): Promise<Uint8Array<ArrayBuffer>> {
  const configured = (env.ADMIN_SESSION_SECRET || '').trim();
  if (configured.length >= 16) {
    return encodeUtf8Buffer(configured);
  }
  if (db) {
    try {
      const existing = await readSiteSettingJson<{ secret?: string }>(db, 'admin_session_secret');
      if (existing?.secret && existing.secret.length >= 32) {
        return encodeUtf8Buffer(existing.secret);
      }
      const generated = randomHex(32);
      await writeSiteSettingJson(db, 'admin_session_secret', {
        secret: generated,
        createdAt: new Date().toISOString(),
      });
      return encodeUtf8Buffer(generated);
    } catch {
      // Fallback to isolate secret if D1 write fails
    }
  }
  if (!ephemeralSessionSecret) {
    ephemeralSessionSecret = new Uint8Array(new ArrayBuffer(32));
    crypto.getRandomValues(ephemeralSessionSecret);
  }
  return ephemeralSessionSecret;
}

async function hashPasswordPbkdf2(password: string, existingSaltHex?: string): Promise<string> {
  const saltHex = existingSaltHex || randomHex(16);
  const saltBytes = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) || []
  );
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pbkdf2$${saltHex}$${hashHex}`;
}

async function verifyPasswordPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const candidate = await hashPasswordPbkdf2(password, parts[1]);
  return timingSafeEqualStrings(candidate, stored);
}

async function signAdminToken(
  env: D1Env,
  db: D1Database,
  email: string
): Promise<string> {
  const secretBytes = await getSessionSecretBytes(env, db);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payloadObj = {
    sub: email,
    role: 'admin',
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
  const payloadB64 = toBase64Url(payloadBytes);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));
  return `${payloadB64}.${sigB64}`;
}

async function verifyAdminToken(
  request: Request,
  env: D1Env,
  db: D1Database
): Promise<{ ok: boolean; email?: string }> {
  const auth = (request.headers.get('Authorization') || '').trim();
  if (!auth.startsWith('Bearer ')) return { ok: false };
  const token = auth.slice(7).trim();
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return { ok: false };

  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  const sigBytes = fromBase64Url(sigB64);
  const payloadBytes = fromBase64Url(payloadB64);
  if (!sigBytes || !payloadBytes) return { ok: false };

  try {
    const secretBytes = await getSessionSecretBytes(env, db);
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return { ok: false };
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      sub?: string;
      role?: string;
      exp?: number;
    };
    if (parsed.role !== 'admin' || !parsed.exp || Date.now() > parsed.exp) {
      return { ok: false };
    }
    return { ok: true, email: parsed.sub || LOCKED_ADMIN_EMAIL };
  } catch {
    return { ok: false };
  }
}

async function ensureD1Tables(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS payment_requests (
        id TEXT PRIMARY KEY,
        client_name TEXT,
        client_phone TEXT NOT NULL,
        email TEXT DEFAULT '',
        plan TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        days INTEGER NOT NULL DEFAULT 1,
        method TEXT NOT NULL DEFAULT 'whatsapp',
        status TEXT NOT NULL DEFAULT 'pending',
        expiry INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS movies (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
}

async function inspectPaymentTable(db: D1Database): Promise<PaymentTableMeta> {
  const res = await db.prepare('PRAGMA table_info(payment_requests)').all();
  const rows = Array.isArray(res.results) ? res.results : [];
  const columns = new Set<string>();
  let idIsIntegerPk = false;
  for (const r of rows) {
    const colName = String(r.name || '').trim();
    if (!colName) continue;
    columns.add(colName);
    if (colName === 'id' && Number(r.pk) === 1 && String(r.type || '').toUpperCase().includes('INT')) {
      idIsIntegerPk = true;
    }
  }
  return { columns, idIsIntegerPk };
}

async function inspectMoviesTable(db: D1Database): Promise<MoviesTableMeta> {
  const res = await db.prepare('PRAGMA table_info(movies)').all();
  const rows = Array.isArray(res.results) ? res.results : [];
  const columns = new Set<string>();
  for (const r of rows) {
    const colName = String(r.name || '').trim();
    if (colName) columns.add(colName);
  }
  return { columns, hasDataJsonCol: columns.has('data') };
}

function inferDaysFromPlan(planName: string): number {
  const p = planName.toLowerCase();
  if (p.includes('week')) return 7;
  if (p.includes('month') || p.includes('vip')) return 30;
  if (p.includes('year')) return 365;
  return 1;
}

function normalizePaymentRow(row: Record<string, unknown>) {
  const plan = String(row.plan || 'Subscription').trim();
  const days = Math.max(1, Number(row.days || inferDaysFromPlan(plan)));
  const rawCreated = row.created_at;
  let createdAtStr = new Date().toISOString();
  let createdMs = Date.now();
  if (typeof rawCreated === 'number' && Number.isFinite(rawCreated)) {
    createdMs = rawCreated > 1e12 ? rawCreated : rawCreated * 1000;
    createdAtStr = new Date(createdMs).toISOString();
  } else if (typeof rawCreated === 'string' && rawCreated.trim()) {
    const parsed = Date.parse(rawCreated.includes('T') ? rawCreated : rawCreated.replace(' ', 'T') + 'Z');
    const altParsed = Date.parse(rawCreated);
    createdMs = Number.isFinite(parsed) ? parsed : Number.isFinite(altParsed) ? altParsed : Date.now();
    createdAtStr = Number.isFinite(parsed) ? new Date(parsed).toISOString() : rawCreated;
  }

  const status =
    row.status === 'approved' || row.status === 'blocked' ? row.status : 'pending';
  const rawExpiry = Number(row.expiry || 0);
  const expiry =
    status === 'approved'
      ? rawExpiry > 0
        ? rawExpiry
        : createdMs + days * 86400000
      : 0;

  return {
    id: String(row.id ?? ''),
    client_name: row.client_name ?? row.name ?? null,
    name: row.client_name ?? row.name ?? null,
    client_phone: String(row.client_phone ?? row.phone ?? '').trim(),
    phone: String(row.client_phone ?? row.phone ?? '').trim(),
    email: String(row.email ?? '').trim(),
    plan,
    amount: Number(row.amount || 0),
    days,
    method: String(row.method ?? row.payment_method ?? 'whatsapp').trim(),
    payment_method: String(row.method ?? row.payment_method ?? 'whatsapp').trim(),
    status,
    expiry,
    created_at: createdAtStr,
  };
}

async function readSiteSettingJson<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db
    .prepare('SELECT value FROM site_settings WHERE key = ?')
    .bind(key)
    .first<{ value?: string }>();
  if (!row || typeof row.value !== 'string') return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function writeSiteSettingJson(db: D1Database, key: string, value: unknown): Promise<void> {
  const nowIso = new Date().toISOString();
  const payload = JSON.stringify(value);
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, payload, nowIso)
    .run();
}

function sanitizeAssetUrlServer(raw?: unknown): string {
  const val = typeof raw === 'string' ? raw.trim() : '';
  if (!val) return '';
  if (/^(javascript|vbscript|data:text\/html):/i.test(val)) return '';
  if (
    val.startsWith('/') ||
    val.startsWith('blob:') ||
    val.startsWith('data:image/') ||
    /^https?:\/\//i.test(val)
  ) {
    return val;
  }
  return '';
}

function parseTagsServer(...sources: unknown[]): string[] {
  const tokens: string[] = [];
  for (const s of sources) {
    if (Array.isArray(s)) {
      for (const item of s) {
        if (typeof item === 'string') tokens.push(item);
      }
    } else if (typeof s === 'string') {
      tokens.push(...s.split(','));
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const clean = t.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function normalizeMovieRowFromD1(row: Record<string, unknown>): Record<string, unknown> | null {
  let d: Record<string, unknown> = row;
  if (typeof row.data === 'string' && row.data.trim()) {
    try {
      const parsed = JSON.parse(row.data) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') d = { ...row, ...parsed };
    } catch {
      // keep row fields
    }
  }
  const id = String(d.id || row.id || '').trim();
  const title = String(d.title || '').trim();
  if (!id || !title) return null;

  const genresArr = parseTagsServer(d.genres, d.genre);
  const categoriesArr = parseTagsServer(d.categories, d.category);
  const effectiveGenres = genresArr.length > 0 ? genresArr : categoriesArr;
  const effectiveCategories = categoriesArr.length > 0 ? categoriesArr : genresArr;
  const parsedCreated = Number(d.createdAt);
  const createdMs =
    Number.isFinite(parsedCreated) && parsedCreated > 0
      ? parsedCreated
      : typeof row.created_at === 'string' && Number.isFinite(Date.parse(row.created_at))
        ? Date.parse(row.created_at)
        : Date.now();

  return {
    id,
    title,
    year: d.year !== undefined && d.year !== null ? String(d.year) : '',
    duration: typeof d.duration === 'string' ? d.duration : '',
    rating: d.rating !== undefined && d.rating !== null ? String(d.rating) : '',
    category: effectiveCategories.join(', '),
    categories: effectiveCategories,
    genre: effectiveGenres.join(', '),
    genres: effectiveGenres,
    actors: typeof d.actors === 'string' ? d.actors : '',
    label: typeof d.label === 'string' ? d.label : typeof d.badge === 'string' ? d.badge : '',
    description: typeof d.description === 'string' ? d.description : '',
    poster: sanitizeAssetUrlServer(d.poster || d.posterUrl),
    video: sanitizeAssetUrlServer(d.video || d.videoUrl || d.downloadUrl),
    createdAt: createdMs,
  };
}

async function upsertMovieInD1(
  db: D1Database,
  meta: MoviesTableMeta,
  movie: Record<string, unknown>
): Promise<void> {
  const id = String(movie.id || '').trim();
  if (!id) return;
  const nowIso = new Date().toISOString();
  const genresArr = parseTagsServer(movie.genres, movie.genre);
  const categoriesArr = parseTagsServer(movie.categories, movie.category);
  const cleanPoster = sanitizeAssetUrlServer(movie.poster);
  const cleanVideo = sanitizeAssetUrlServer(movie.video);

  const normalizedDoc = {
    id,
    title: String(movie.title || '').trim(),
    year: String(movie.year || ''),
    duration: String(movie.duration || ''),
    rating: String(movie.rating || ''),
    category: categoriesArr.join(', '),
    categories: categoriesArr,
    genre: genresArr.join(', '),
    genres: genresArr,
    actors: String(movie.actors || ''),
    label: String(movie.label || ''),
    description: String(movie.description || ''),
    poster: cleanPoster,
    posterUrl: cleanPoster,
    video: cleanVideo,
    videoUrl: cleanVideo,
    createdAt: Number(movie.createdAt || Date.now()),
  };

  if (meta.hasDataJsonCol) {
    await db
      .prepare(
        `INSERT INTO movies (id, data, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
      .bind(id, JSON.stringify(normalizedDoc), nowIso, nowIso)
      .run();
    return;
  }

  // Flat-column fallback if user created custom flat columns on `movies`
  const candidateCols: Record<string, unknown> = {
    id,
    title: normalizedDoc.title,
    year: normalizedDoc.year,
    duration: normalizedDoc.duration,
    rating: normalizedDoc.rating,
    category: normalizedDoc.category,
    categories: JSON.stringify(categoriesArr),
    genre: normalizedDoc.genre,
    genres: JSON.stringify(genresArr),
    actors: normalizedDoc.actors,
    label: normalizedDoc.label,
    description: normalizedDoc.description,
    poster: cleanPoster,
    poster_url: cleanPoster,
    video: cleanVideo,
    video_url: cleanVideo,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const activeCols = Object.keys(candidateCols).filter((c) => meta.columns.has(c));
  if (!activeCols.includes('id')) return;

  const placeholders = activeCols.map(() => '?').join(', ');
  const updates = activeCols
    .filter((c) => c !== 'id' && c !== 'created_at')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  const values = activeCols.map((c) => candidateCols[c]);

  const sql = updates
    ? `INSERT INTO movies (${activeCols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`
    : `INSERT OR REPLACE INTO movies (${activeCols.join(', ')}) VALUES (${placeholders})`;

  await db.prepare(sql).bind(...values).run();
}

async function readR2JsonDocOptional<T>(r2WorkerBase: string, key: string): Promise<T | null> {
  try {
    const url = `${r2WorkerBase}/file/${encodeURIComponent(key)}?t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw || raw.trim().startsWith('<')) return null;
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function insertPaymentRowInD1(
  db: D1Database,
  meta: PaymentTableMeta,
  input: {
    client_name: string | null;
    client_phone: string;
    email: string;
    plan: string;
    amount: number;
    days: number;
    method: string;
    status: 'pending' | 'approved' | 'blocked';
    expiry: number;
  }
) {
  const nowIso = new Date().toISOString();
  const cols: string[] = [];
  const vals: unknown[] = [];
  let generatedUuid: string | null = null;

  if (meta.columns.has('id') && !meta.idIsIntegerPk) {
    generatedUuid = crypto.randomUUID();
    cols.push('id');
    vals.push(generatedUuid);
  }
  if (meta.columns.has('client_name')) {
    cols.push('client_name');
    vals.push(input.client_name);
  }
  if (meta.columns.has('name')) {
    cols.push('name');
    vals.push(input.client_name);
  }
  if (meta.columns.has('client_phone')) {
    cols.push('client_phone');
    vals.push(input.client_phone);
  }
  if (meta.columns.has('phone')) {
    cols.push('phone');
    vals.push(input.client_phone);
  }
  if (meta.columns.has('email')) {
    cols.push('email');
    vals.push(input.email);
  }
  if (meta.columns.has('plan')) {
    cols.push('plan');
    vals.push(input.plan);
  }
  if (meta.columns.has('amount')) {
    cols.push('amount');
    vals.push(input.amount);
  }
  if (meta.columns.has('days')) {
    cols.push('days');
    vals.push(input.days);
  }
  if (meta.columns.has('method')) {
    cols.push('method');
    vals.push(input.method);
  }
  if (meta.columns.has('payment_method')) {
    cols.push('payment_method');
    vals.push(input.method);
  }
  if (meta.columns.has('status')) {
    cols.push('status');
    vals.push(input.status);
  }
  if (meta.columns.has('expiry')) {
    cols.push('expiry');
    vals.push(input.expiry);
  }
  if (meta.columns.has('created_at')) {
    cols.push('created_at');
    vals.push(nowIso);
  }

  const placeholders = cols.map(() => '?').join(', ');
  const insertSql = `INSERT INTO payment_requests (${cols.join(', ')}) VALUES (${placeholders})`;
  const insertResult = await db.prepare(insertSql).bind(...vals).run();

  let savedRow: Record<string, unknown> | null = null;
  if (generatedUuid) {
    savedRow = await db
      .prepare('SELECT * FROM payment_requests WHERE id = ?')
      .bind(generatedUuid)
      .first();
  } else if (insertResult.meta?.last_row_id !== undefined) {
    savedRow = await db
      .prepare('SELECT * FROM payment_requests WHERE rowid = ?')
      .bind(insertResult.meta.last_row_id)
      .first();
  }

  if (!savedRow) {
    return normalizePaymentRow({
      id: generatedUuid || String(insertResult.meta?.last_row_id || crypto.randomUUID()),
      client_name: input.client_name,
      client_phone: input.client_phone,
      email: input.email,
      plan: input.plan,
      amount: input.amount,
      days: input.days,
      method: input.method,
      status: input.status,
      expiry: input.expiry,
      created_at: nowIso,
    });
  }
  return normalizePaymentRow(savedRow);
}

export async function handleD1ApiRequest(request: Request, env: D1Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const { db, bindingName } = resolveD1(env);

  if (path === '/api/health') {
    let d1Ready = false;
    if (db) {
      try {
        await ensureD1Tables(db);
        d1Ready = true;
      } catch {
        d1Ready = false;
      }
    }
    return jsonResponse(request, {
      ok: true,
      database: 'cloudflare-d1',
      binding: bindingName || null,
      d1Ready,
    });
  }

  // All /api/* endpoints require Cloudflare D1 (`vjemmadb`)
  if (!db) {
    return jsonResponse(
      request,
      {
        error:
          'Cloudflare D1 binding "DB" (vjemmadb) is not connected. Bind D1 "DB" -> "vjemmadb" in wrangler.toml and Worker/Pages Settings.',
      },
      503
    );
  }

  await ensureD1Tables(db);

  // ADMIN AUTH ROUTES
  if (path === '/api/admin/status' && request.method === 'GET') {
    const envPwd = (env.ADMIN_PASSWORD || '').trim();
    const storedAuth = await readSiteSettingJson<{ hash?: string }>(db, 'admin_auth');
    const authCheck = await verifyAdminToken(request, env, db);
    return jsonResponse(request, {
      ok: true,
      configured: Boolean(envPwd || storedAuth?.hash),
      envLocked: Boolean(envPwd),
      authenticated: authCheck.ok,
      email: authCheck.email || null,
    });
  }

  if (path === '/api/admin/login' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as {
      identifier?: string;
      email?: string;
      password?: string;
    };
    const identifier = String(body.identifier || body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!identifier || !password) {
      return jsonResponse(request, { error: 'Enter Admin Username / Email and Password.' }, 400);
    }
    if (identifier !== 'admin' && identifier !== LOCKED_ADMIN_EMAIL.toLowerCase()) {
      return jsonResponse(request, { error: 'Access denied: Invalid Admin credentials.' }, 401);
    }

    const envPwd = (env.ADMIN_PASSWORD || '').trim();
    const storedAuth = await readSiteSettingJson<{ hash?: string }>(db, 'admin_auth');

    if (envPwd) {
      if (!timingSafeEqualStrings(password, envPwd)) {
        return jsonResponse(request, { error: 'Incorrect Admin Password.' }, 401);
      }
    } else if (storedAuth?.hash) {
      const ok = await verifyPasswordPbkdf2(password, storedAuth.hash);
      if (!ok) {
        return jsonResponse(request, { error: 'Incorrect Admin Password.' }, 401);
      }
    } else {
      // First-time claim: hash & persist chosen admin password securely in D1
      const hash = await hashPasswordPbkdf2(password);
      await writeSiteSettingJson(db, 'admin_auth', {
        hash,
        claimedAt: new Date().toISOString(),
      });
    }

    const emailOut = identifier === 'admin' ? LOCKED_ADMIN_EMAIL : identifier;
    const token = await signAdminToken(env, db, emailOut);
    return jsonResponse(request, {
      ok: true,
      token,
      email: emailOut,
    });
  }

  if (path === '/api/admin/password' && request.method === 'POST') {
    const auth = await verifyAdminToken(request, env, db);
    if (!auth.ok) {
      return jsonResponse(request, { error: 'Admin authentication required.' }, 401);
    }
    if ((env.ADMIN_PASSWORD || '').trim()) {
      return jsonResponse(
        request,
        { error: 'Admin password is managed by server ADMIN_PASSWORD environment secret.' },
        400
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      newPassword?: string;
    };
    const nextPwd = String(body.newPassword || '').trim();
    if (nextPwd.length < 6) {
      return jsonResponse(request, { error: 'Admin password must be at least 6 characters.' }, 400);
    }
    const hash = await hashPasswordPbkdf2(nextPwd);
    await writeSiteSettingJson(db, 'admin_auth', {
      hash,
      updatedAt: new Date().toISOString(),
    });
    return jsonResponse(request, { ok: true });
  }

  // PAYMENT REQUESTS (D1 vjemmadb.payment_requests)
  if (path === '/api/payment-requests' && request.method === 'GET') {
    try {
      const auth = await verifyAdminToken(request, env, db);
      const qPhone = String(url.searchParams.get('phone') || '').trim();
      const qEmail = String(url.searchParams.get('email') || '').trim().toLowerCase();

      if (!auth.ok && !qPhone && !qEmail) {
        return jsonResponse(
          request,
          { ok: false, error: 'Admin authentication required to list all payment requests.' },
          401
        );
      }

      const pMeta = await inspectPaymentTable(db);
      const orderCol = pMeta.columns.has('created_at') ? 'created_at DESC, rowid DESC' : 'rowid DESC';
      let rawRows: Record<string, unknown>[] = [];
      try {
        const result = await db.prepare(`SELECT * FROM payment_requests ORDER BY ${orderCol}`).all();
        rawRows = Array.isArray(result.results) ? result.results : [];
      } catch {
        const fallbackRes = await db.prepare('SELECT * FROM payment_requests').all();
        rawRows = Array.isArray(fallbackRes.results) ? fallbackRes.results : [];
      }

      let rows = rawRows.map((r) => normalizePaymentRow(r));
      if (!auth.ok) {
        rows = rows.filter(
          (r) =>
            (qPhone && r.client_phone === qPhone) ||
            (qEmail && r.email.toLowerCase() === qEmail)
        );
      }
      rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

      return jsonResponse(request, {
        ok: true,
        rows,
      });
    } catch (err) {
      return jsonResponse(
        request,
        { ok: false, error: err instanceof Error ? err.message : 'Failed to query D1 payment_requests.' },
        500
      );
    }
  }

  if (path === '/api/payment-requests' && request.method === 'POST') {
    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const clientNameRaw = String(body.client_name ?? body.name ?? '').trim();
      const clientPhone = String(body.client_phone ?? body.phone ?? '').trim();
      const email = String(body.email ?? '').trim();
      const plan = String(body.plan ?? '').trim();
      const amount = Number(body.amount ?? 0);
      const days = Math.max(1, Number(body.days || inferDaysFromPlan(plan || 'Subscription')));
      const rawMethod = String(body.method ?? body.paymentMethod ?? 'whatsapp').trim();

      if (!clientPhone) {
        return jsonResponse(request, { ok: false, error: 'client_phone is required.' }, 400);
      }
      if (!plan) {
        return jsonResponse(request, { ok: false, error: 'plan is required.' }, 400);
      }
      if (!Number.isFinite(amount) || amount < 0) {
        return jsonResponse(request, { ok: false, error: 'amount must be a valid number.' }, 400);
      }

      const auth = await verifyAdminToken(request, env, db);
      const requestedStatus = String(body.status || 'pending').trim().toLowerCase();
      // Only authenticated Admin ("Add Manual Payment") can directly create an 'approved' row;
      // customer submissions ALWAYS start as status='pending' with expiry=0.
      const finalStatus: 'pending' | 'approved' | 'blocked' =
        auth.ok && requestedStatus === 'approved' ? 'approved' : 'pending';
      const finalExpiry =
        finalStatus === 'approved'
          ? Math.max(Date.now() + days * 86400000, Number(body.expiry || 0))
          : 0;
      const finalMethod =
        rawMethod.toLowerCase() === 'whatsapp' || rawMethod.toLowerCase().includes('whatsapp')
          ? 'whatsapp'
          : rawMethod || (auth.ok ? 'manual' : 'whatsapp');

      const pMeta = await inspectPaymentTable(db);
      const row = await insertPaymentRowInD1(db, pMeta, {
        client_name: clientNameRaw || null,
        client_phone: clientPhone,
        email: email || `${clientPhone.replace(/[^a-zA-Z0-9]/g, '') || 'client'}@vjemma.site`,
        plan,
        amount,
        days,
        method: finalMethod,
        status: finalStatus,
        expiry: finalExpiry,
      });

      return jsonResponse(request, { ok: true, row }, 201);
    } catch (err) {
      return jsonResponse(
        request,
        { ok: false, error: err instanceof Error ? err.message : 'Failed to save payment_requests row to D1.' },
        500
      );
    }
  }

  if (path.startsWith('/api/payment-requests/') && (request.method === 'PATCH' || request.method === 'DELETE')) {
    const auth = await verifyAdminToken(request, env, db);
    if (!auth.ok) {
      return jsonResponse(request, { ok: false, error: 'Admin login required to modify payment requests.' }, 401);
    }

    const rawId = decodeURIComponent(path.slice('/api/payment-requests/'.length)).trim();
    if (!rawId) {
      return jsonResponse(request, { ok: false, error: 'Missing payment request id.' }, 400);
    }
    const pMeta = await inspectPaymentTable(db);
    const idParam: string | number = pMeta.idIsIntegerPk && /^\d+$/.test(rawId) ? Number(rawId) : rawId;

    if (request.method === 'DELETE') {
      try {
        await db.prepare('DELETE FROM payment_requests WHERE id = ?').bind(idParam).run();
        return jsonResponse(request, { ok: true });
      } catch (err) {
        return jsonResponse(
          request,
          { ok: false, error: err instanceof Error ? err.message : 'Failed to delete payment request from D1.' },
          500
        );
      }
    }

    // PATCH
    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const setClauses: string[] = [];
      const setValues: unknown[] = [];

      if (body.status !== undefined && pMeta.columns.has('status')) {
        const nextStatus =
          body.status === 'approved' || body.status === 'blocked' ? body.status : 'pending';
        setClauses.push('status = ?');
        setValues.push(nextStatus);
      }
      if (body.plan !== undefined && pMeta.columns.has('plan')) {
        setClauses.push('plan = ?');
        setValues.push(String(body.plan));
      }
      if (body.amount !== undefined && pMeta.columns.has('amount')) {
        setClauses.push('amount = ?');
        setValues.push(Number(body.amount || 0));
      }
      if (body.days !== undefined && pMeta.columns.has('days')) {
        setClauses.push('days = ?');
        setValues.push(Math.max(1, Number(body.days || 1)));
      }
      if (body.expiry !== undefined && pMeta.columns.has('expiry')) {
        setClauses.push('expiry = ?');
        setValues.push(Number(body.expiry || 0));
      }
      if (body.method !== undefined && pMeta.columns.has('method')) {
        setClauses.push('method = ?');
        setValues.push(String(body.method));
      }

      if (setClauses.length === 0) {
        return jsonResponse(request, { ok: false, error: 'No updatable columns provided.' }, 400);
      }

      await db
        .prepare(`UPDATE payment_requests SET ${setClauses.join(', ')} WHERE id = ?`)
        .bind(...setValues, idParam)
        .run();

      const updated = await db
        .prepare('SELECT * FROM payment_requests WHERE id = ?')
        .bind(idParam)
        .first();

      if (!updated) {
        return jsonResponse(request, { ok: false, error: 'Payment request not found.' }, 404);
      }
      return jsonResponse(request, { ok: true, row: normalizePaymentRow(updated) });
    } catch (err) {
      return jsonResponse(
        request,
        { ok: false, error: err instanceof Error ? err.message : 'Failed to update payment_requests row in D1.' },
        500
      );
    }
  }

  // PUBLIC CATALOG READ (movies, series, settings, banners, liveTvChannels, likes, comments)
  if (path === '/api/catalog' && request.method === 'GET') {
    try {
      const [moviesRes, seriesDoc, settingsDoc, mediaDoc, socialDoc] = await Promise.all([
        db.prepare('SELECT * FROM movies').all(),
        readSiteSettingJson<{ seasons?: unknown[]; episodes?: unknown[] }>(db, 'series_v1'),
        readSiteSettingJson<Record<string, unknown>>(db, 'settings_v1'),
        readSiteSettingJson<{ banners?: unknown[]; liveTvChannels?: unknown[] }>(db, 'media_v1'),
        readSiteSettingJson<{ likes?: Record<string, unknown>; comments?: Record<string, unknown> }>(
          db,
          'social_v1'
        ),
      ]);

      let movieRows = Array.isArray(moviesRes.results) ? moviesRes.results : [];
      let movies = movieRows
        .map((r) => normalizeMovieRowFromD1(r))
        .filter((x): x is Record<string, unknown> => Boolean(x));

      let seasons = Array.isArray(seriesDoc?.seasons) ? seriesDoc!.seasons : [];
      let episodes = Array.isArray(seriesDoc?.episodes) ? seriesDoc!.episodes : [];
      let settings = settingsDoc && typeof settingsDoc === 'object' ? settingsDoc : null;
      let banners = Array.isArray(mediaDoc?.banners) ? mediaDoc!.banners : [];
      let liveTvChannels = Array.isArray(mediaDoc?.liveTvChannels) ? mediaDoc!.liveTvChannels : [];
      let likes = socialDoc?.likes && typeof socialDoc.likes === 'object' ? socialDoc.likes : {};
      let comments =
        socialDoc?.comments && typeof socialDoc.comments === 'object' ? socialDoc.comments : {};

      // One-time automatic R2 cloud catalog bootstrap if D1 catalog tables are brand new & empty
      const isFreshD1Catalog =
        movies.length === 0 && seasons.length === 0 && !settings && banners.length === 0;
      if (isFreshD1Catalog) {
        const r2Base = (env.VITE_R2_UPLOAD_WORKER_URL || DEFAULT_R2_WORKER_URL)
          .trim()
          .replace(/\/upload\/?$/i, '')
          .replace(/\/+$/, '');
        const [r2Movies, r2Series, r2Settings, r2Media, r2Social] = await Promise.all([
          readR2JsonDocOptional<{ items?: Record<string, unknown>[] }>(r2Base, 'vjemma_db_movies_v1.json'),
          readR2JsonDocOptional<{ seasons?: unknown[]; episodes?: unknown[] }>(
            r2Base,
            'vjemma_db_series_v1.json'
          ),
          readR2JsonDocOptional<{ settings?: Record<string, unknown> }>(
            r2Base,
            'vjemma_db_settings_v1.json'
          ),
          readR2JsonDocOptional<{ banners?: unknown[]; liveTvChannels?: unknown[] }>(
            r2Base,
            'vjemma_db_media_v1.json'
          ),
          readR2JsonDocOptional<{
            likes?: Record<string, unknown>;
            comments?: Record<string, unknown>;
          }>(r2Base, 'vjemma_db_social_v1.json'),
        ]);

        const mMeta = await inspectMoviesTable(db);
        if (Array.isArray(r2Movies?.items) && r2Movies!.items.length > 0) {
          for (const item of r2Movies!.items) {
            await upsertMovieInD1(db, mMeta, item);
          }
          const seededRes = await db.prepare('SELECT * FROM movies').all();
          movieRows = Array.isArray(seededRes.results) ? seededRes.results : [];
          movies = movieRows
            .map((r) => normalizeMovieRowFromD1(r))
            .filter((x): x is Record<string, unknown> => Boolean(x));
        }
        if (r2Series && (Array.isArray(r2Series.seasons) || Array.isArray(r2Series.episodes))) {
          seasons = Array.isArray(r2Series.seasons) ? r2Series.seasons : [];
          episodes = Array.isArray(r2Series.episodes) ? r2Series.episodes : [];
          await writeSiteSettingJson(db, 'series_v1', { seasons, episodes });
        }
        if (r2Settings?.settings && typeof r2Settings.settings === 'object') {
          settings = r2Settings.settings;
          await writeSiteSettingJson(db, 'settings_v1', settings);
        }
        if (r2Media && (Array.isArray(r2Media.banners) || Array.isArray(r2Media.liveTvChannels))) {
          banners = Array.isArray(r2Media.banners) ? r2Media.banners : [];
          liveTvChannels = Array.isArray(r2Media.liveTvChannels) ? r2Media.liveTvChannels : [];
          await writeSiteSettingJson(db, 'media_v1', { banners, liveTvChannels });
        }
        if (r2Social && (r2Social.likes || r2Social.comments)) {
          likes = r2Social.likes || {};
          comments = r2Social.comments || {};
          await writeSiteSettingJson(db, 'social_v1', { likes, comments });
        }
      }

      movies.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

      return jsonResponse(request, {
        ok: true,
        movies,
        seasons,
        episodes,
        settings: settings || {},
        banners,
        liveTvChannels,
        likes,
        comments,
      });
    } catch (err) {
      return jsonResponse(
        request,
        { ok: false, error: err instanceof Error ? err.message : 'Failed to load catalog from D1.' },
        500
      );
    }
  }

  // PARTITIONED CATALOG SYNC TO D1
  if (path === '/api/catalog/sync' && request.method === 'POST') {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        changedMovies?: Record<string, unknown>[];
        deletedMovieIds?: string[];
        seasons?: unknown[];
        episodes?: unknown[];
        settingsPatch?: Record<string, unknown>;
        banners?: unknown[];
        liveTvChannels?: unknown[];
        likesPatch?: Record<string, unknown>;
        commentsPatch?: Record<string, unknown>;
      };

      const hasAdminMutations =
        (Array.isArray(body.changedMovies) && body.changedMovies.length > 0) ||
        (Array.isArray(body.deletedMovieIds) && body.deletedMovieIds.length > 0) ||
        Array.isArray(body.seasons) ||
        Array.isArray(body.episodes) ||
        (body.settingsPatch && Object.keys(body.settingsPatch).length > 0) ||
        Array.isArray(body.banners) ||
        Array.isArray(body.liveTvChannels);

      if (hasAdminMutations) {
        const auth = await verifyAdminToken(request, env, db);
        if (!auth.ok) {
          return jsonResponse(
            request,
            { ok: false, error: 'Admin authentication required to save catalog or settings.' },
            401
          );
        }
      }

      // 1. Movies (partitioned row-by-row upsert/delete)
      if (
        (Array.isArray(body.changedMovies) && body.changedMovies.length > 0) ||
        (Array.isArray(body.deletedMovieIds) && body.deletedMovieIds.length > 0)
      ) {
        const mMeta = await inspectMoviesTable(db);
        if (Array.isArray(body.changedMovies)) {
          for (const m of body.changedMovies) {
            await upsertMovieInD1(db, mMeta, m);
          }
        }
        if (Array.isArray(body.deletedMovieIds)) {
          for (const delId of body.deletedMovieIds) {
            await db.prepare('DELETE FROM movies WHERE id = ?').bind(String(delId)).run();
          }
        }
      }

      // 2. Series (Seasons & Episodes)
      if (Array.isArray(body.seasons) || Array.isArray(body.episodes)) {
        const existing =
          (await readSiteSettingJson<{ seasons?: unknown[]; episodes?: unknown[] }>(db, 'series_v1')) || {};
        await writeSiteSettingJson(db, 'series_v1', {
          seasons: Array.isArray(body.seasons) ? body.seasons : existing.seasons || [],
          episodes: Array.isArray(body.episodes) ? body.episodes : existing.episodes || [],
        });
      }

      // 3. Settings (Merge only changed keys, never overwrite movies or series)
      if (body.settingsPatch && typeof body.settingsPatch === 'object') {
        const existingSettings =
          (await readSiteSettingJson<Record<string, unknown>>(db, 'settings_v1')) || {};
        const merged = { ...existingSettings, ...body.settingsPatch };
        await writeSiteSettingJson(db, 'settings_v1', merged);
      }

      // 4. Media (Banners & Live TV)
      if (Array.isArray(body.banners) || Array.isArray(body.liveTvChannels)) {
        const existingMedia =
          (await readSiteSettingJson<{ banners?: unknown[]; liveTvChannels?: unknown[] }>(
            db,
            'media_v1'
          )) || {};
        await writeSiteSettingJson(db, 'media_v1', {
          banners: Array.isArray(body.banners) ? body.banners : existingMedia.banners || [],
          liveTvChannels: Array.isArray(body.liveTvChannels)
            ? body.liveTvChannels
            : existingMedia.liveTvChannels || [],
        });
      }

      // 5. Public Likes & Comments
      if (body.likesPatch || body.commentsPatch) {
        const existingSocial =
          (await readSiteSettingJson<{
            likes?: Record<string, unknown>;
            comments?: Record<string, unknown>;
          }>(db, 'social_v1')) || {};
        await writeSiteSettingJson(db, 'social_v1', {
          likes: { ...(existingSocial.likes || {}), ...(body.likesPatch || {}) },
          comments: { ...(existingSocial.comments || {}), ...(body.commentsPatch || {}) },
        });
      }

      return jsonResponse(request, { ok: true });
    } catch (err) {
      return jsonResponse(
        request,
        { ok: false, error: err instanceof Error ? err.message : 'Failed to sync changes to D1.' },
        500
      );
    }
  }

  return jsonResponse(request, { error: `Unknown API route: ${path}` }, 404);
}
