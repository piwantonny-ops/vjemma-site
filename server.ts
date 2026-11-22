import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PESAPAL_LIVE_BASE_URL = 'https://pay.pesapal.com/v3/api';

let cachedPesapalToken: { token: string; expiresAt: number } | null = null;
let cachedIpnId: string | null = process.env.PESAPAL_IPN_ID?.trim() || null;

// In-memory public catalog mirror for same-origin fast sync (non-sensitive public fields only)
let latestPublicCatalogSnapshot: Record<string, unknown> | null = null;

function getPesapalCredentials(): { key: string; secret: string } {
  const key = (process.env.PESAPAL_CONSUMER_KEY || '').trim();
  const secret = (process.env.PESAPAL_CONSUMER_SECRET || '').trim();
  return { key, secret };
}

function getSafeOriginFromRequest(req: Request): string {
  const envUrl = (process.env.APP_URL || '').trim();
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      // Fallback to request headers
    }
  }
  const protoHeader = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
    .split(',')[0]
    .trim();
  const proto = protoHeader === 'http' ? 'http' : 'https';
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}`;
}

function buildSafeCallbackUrl(req: Request, requestedCallback?: unknown): string {
  const origin = getSafeOriginFromRequest(req);
  const fallback = `${origin}/payment-success`;
  if (typeof requestedCallback !== 'string' || !requestedCallback.trim()) {
    return fallback;
  }
  try {
    const parsed = new URL(requestedCallback.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fallback;
    }
    const hostname = parsed.hostname.toLowerCase();
    // Allow same origin or official domain vjemma.site
    if (
      parsed.origin === origin ||
      hostname === 'vjemma.site' ||
      hostname.endsWith('.vjemma.site')
    ) {
      return `${parsed.origin}/payment-success`;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function getLivePesapalToken(): Promise<string> {
  const { key, secret } = getPesapalCredentials();
  if (!key || !secret) {
    throw new Error(
      'Missing PESAPAL_CONSUMER_KEY or PESAPAL_CONSUMER_SECRET environment variables on server.'
    );
  }

  if (cachedPesapalToken && Date.now() < cachedPesapalToken.expiresAt) {
    return cachedPesapalToken.token;
  }

  const res = await fetch(`${PESAPAL_LIVE_BASE_URL}/Auth/RequestToken`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consumer_key: key,
      consumer_secret: secret,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    error?: { message?: string } | string;
    message?: string;
  };

  if (!res.ok || !data.token) {
    const errMsg =
      (typeof data.error === 'object' && data.error?.message) ||
      (typeof data.error === 'string' && data.error) ||
      data.message ||
      `Pesapal LIVE auth failed (HTTP ${res.status})`;
    throw new Error(errMsg);
  }

  // Tokens typically last 5 minutes; cache safely for 4 minutes
  cachedPesapalToken = {
    token: data.token,
    expiresAt: Date.now() + 4 * 60 * 1000,
  };
  return data.token;
}

async function ensureLiveIpnId(token: string, origin: string): Promise<string> {
  if (cachedIpnId) return cachedIpnId;

  const ipnUrl = `${origin}/api/pesapal/ipn`;
  const res = await fetch(`${PESAPAL_LIVE_BASE_URL}/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: ipnUrl,
      ipn_notification_type: 'GET',
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ipn_id?: string;
    error?: { message?: string } | string;
    message?: string;
  };

  if (!res.ok || !data.ipn_id) {
    const errMsg =
      (typeof data.error === 'object' && data.error?.message) ||
      (typeof data.error === 'string' && data.error) ||
      data.message ||
      `Pesapal IPN registration failed (HTTP ${res.status})`;
    throw new Error(errMsg);
  }

  cachedIpnId = data.ipn_id;
  return data.ipn_id;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Customer', lastName: 'VJEmma' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'VJEmma' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    const { key, secret } = getPesapalCredentials();
    res.json({
      ok: true,
      pesapalLiveConfigured: Boolean(key && secret),
      pesapalMode: 'LIVE',
    });
  });

  // Cross-device public catalog mirror (public fields only)
  app.get('/api/public-state', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!latestPublicCatalogSnapshot) {
      res.status(404).json({ error: 'No cached public snapshot yet' });
      return;
    }
    res.json(latestPublicCatalogSnapshot);
  });

  app.post('/api/public-state', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || typeof body.updatedAt !== 'number') {
      res.status(400).json({ error: 'Invalid public catalog snapshot' });
      return;
    }
    // Strip any accidental sensitive keys before keeping in memory
    const safeSnapshot: Record<string, unknown> = {
      version: Number(body.version || 1),
      updatedAt: Number(body.updatedAt),
      deletedMovieIds: Array.isArray(body.deletedMovieIds) ? body.deletedMovieIds : [],
      movies: Array.isArray(body.movies) ? body.movies : [],
      seasons: Array.isArray(body.seasons) ? body.seasons : [],
      episodes: Array.isArray(body.episodes) ? body.episodes : [],
      banners: Array.isArray(body.banners) ? body.banners : [],
      liveTvChannels: Array.isArray(body.liveTvChannels) ? body.liveTvChannels : [],
      likes: body.likes && typeof body.likes === 'object' ? body.likes : {},
      comments: body.comments && typeof body.comments === 'object' ? body.comments : {},
      settings: body.settings && typeof body.settings === 'object' ? body.settings : {},
    };
    latestPublicCatalogSnapshot = safeSnapshot;
    res.json({ ok: true, updatedAt: safeSnapshot.updatedAt });
  });

  // LIVE Pesapal v3 Order Creation
  app.post('/api/pesapal/pay', async (req: Request, res: Response) => {
    try {
      const { amount, name, email, phone, planName, callback_url } = (req.body || {}) as {
        amount?: number | string;
        name?: string;
        email?: string;
        phone?: string;
        planName?: string;
        callback_url?: string;
      };

      const numAmount = Number(amount);
      const cleanEmail = String(email || '').trim();
      const cleanPhone = String(phone || '').trim();
      const cleanName = String(name || '').trim();
      const cleanPlan = String(planName || 'VIP Subscription').trim();

      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        res.status(400).json({ error: 'Invalid payment amount.' });
        return;
      }
      if (!cleanEmail || !cleanPhone) {
        res.status(400).json({ error: 'Email and phone number are required.' });
        return;
      }

      const { key, secret } = getPesapalCredentials();
      if (!key || !secret) {
        res.status(503).json({
          code: 'PESAPAL_KEYS_MISSING',
          error:
            'PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET are missing on the backend.',
        });
        return;
      }

      const token = await getLivePesapalToken();
      const origin = getSafeOriginFromRequest(req);
      const notificationId = await ensureLiveIpnId(token, origin);
      const safeCallbackUrl = buildSafeCallbackUrl(req, callback_url);
      const merchantRef = `VJEMMA_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const { firstName, lastName } = splitFullName(cleanName || cleanEmail.split('@')[0]);

      const orderRes = await fetch(`${PESAPAL_LIVE_BASE_URL}/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: merchantRef,
          currency: 'UGX',
          amount: Math.round(numAmount),
          description: `VJ Emma ${cleanPlan} Plan`.slice(0, 100),
          callback_url: safeCallbackUrl,
          notification_id: notificationId,
          billing_address: {
            email_address: cleanEmail,
            phone_number: cleanPhone,
            country_code: 'UG',
            first_name: firstName,
            last_name: lastName,
          },
        }),
      });

      const orderData = (await orderRes.json().catch(() => ({}))) as {
        order_tracking_id?: string;
        merchant_reference?: string;
        redirect_url?: string;
        error?: { message?: string } | string;
        message?: string;
      };

      if (!orderRes.ok || !orderData.redirect_url) {
        const errMsg =
          (typeof orderData.error === 'object' && orderData.error?.message) ||
          (typeof orderData.error === 'string' && orderData.error) ||
          orderData.message ||
          `Pesapal LIVE order failed (HTTP ${orderRes.status})`;
        res.status(502).json({ error: errMsg });
        return;
      }

      res.json({
        redirect_url: orderData.redirect_url,
        orderId: orderData.order_tracking_id || merchantRef,
        order_tracking_id: orderData.order_tracking_id || '',
        merchant_reference: orderData.merchant_reference || merchantRef,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pesapal LIVE order request failed';
      res.status(500).json({ error: msg });
    }
  });

  // LIVE Pesapal v3 Transaction Status Check
  app.get('/api/pesapal/status', async (req: Request, res: Response) => {
    try {
      const orderId = String(req.query.orderId || req.query.OrderTrackingId || '').trim();
      if (!orderId || !/^[A-Za-z0-9._-]{4,140}$/.test(orderId)) {
        res.status(400).json({ error: 'Valid orderId is required.' });
        return;
      }

      const { key, secret } = getPesapalCredentials();
      if (!key || !secret) {
        res.status(503).json({
          code: 'PESAPAL_KEYS_MISSING',
          error: 'PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET are missing on the backend.',
        });
        return;
      }

      const token = await getLivePesapalToken();
      const statusRes = await fetch(
        `${PESAPAL_LIVE_BASE_URL}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderId)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const statusData = (await statusRes.json().catch(() => ({}))) as {
        payment_status_description?: string;
        status_code?: number;
        amount?: number;
        confirmation_code?: string;
        payment_method?: string;
        description?: string;
        error?: { message?: string } | string;
        message?: string;
      };

      if (!statusRes.ok) {
        const errMsg =
          (typeof statusData.error === 'object' && statusData.error?.message) ||
          (typeof statusData.error === 'string' && statusData.error) ||
          statusData.message ||
          `Pesapal status check failed (HTTP ${statusRes.status})`;
        res.status(502).json({ error: errMsg });
        return;
      }

      const desc = String(statusData.payment_status_description || '').trim().toUpperCase();
      const code = Number(statusData.status_code);
      const normalizedStatus =
        desc === 'COMPLETED' || code === 1
          ? 'COMPLETED'
          : desc === 'FAILED' || desc === 'REVERSED' || code === 2 || code === 3
            ? 'FAILED'
            : desc || 'PENDING';

      res.json({
        status: normalizedStatus,
        payment_status_description: statusData.payment_status_description || normalizedStatus,
        orderId,
        order_tracking_id: orderId,
        amount: statusData.amount,
        confirmation_code: statusData.confirmation_code,
        payment_method: statusData.payment_method,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify Pesapal status';
      res.status(500).json({ error: msg });
    }
  });

  // Pesapal IPN Notification Endpoint (LIVE)
  app.all('/api/pesapal/ipn', (req: Request, res: Response) => {
    const orderTrackingId = String(
      req.query.OrderTrackingId || req.body?.OrderTrackingId || ''
    ).trim();
    const orderMerchantReference = String(
      req.query.OrderMerchantReference || req.body?.OrderMerchantReference || ''
    ).trim();
    const orderNotificationType = String(
      req.query.OrderNotificationType || req.body?.OrderNotificationType || 'IPNCHANGE'
    ).trim();

    res.json({
      orderNotificationType,
      orderTrackingId,
      orderMerchantReference,
      status: 200,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        allowedHosts: true,
      },
      plugins: [
        {
          name: 'disable-hmr-ws-client',
          transform(code: string, id: string) {
            if (id.includes('vite/dist/client/client.mjs') || id.endsWith('/@vite/client')) {
              return code.replace(
                'transport.connect(createHMRHandler(handleMessage));',
                '/* HMR WebSocket disabled in preview */'
              );
            }
          },
        },
      ],
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VJ Emma server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
