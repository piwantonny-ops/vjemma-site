import express from 'express';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handleD1ApiRequest } from './functions/_shared/d1Api';
import type { D1Env } from './functions/_shared/d1Types';
import { createNodeSqliteD1Adapter } from './server/nodeD1Adapter';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  const localD1 = createNodeSqliteD1Adapter(path.resolve(__dirname, '.data', 'vjemmadb.sqlite'));

  const d1Env: D1Env = {
    DB: localD1,
    vjemmadb: localD1,
    APP_URL: process.env.APP_URL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    VITE_R2_UPLOAD_WORKER_URL: process.env.VITE_R2_UPLOAD_WORKER_URL,
  };

  app.use('/api', express.raw({ type: '*/*', limit: '6mb' }), async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
        .split(',')[0]
        .trim();
      const host = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`)
        .split(',')[0]
        .trim();
      const fullUrl = `${proto}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') {
          headers.set(k, v);
        } else if (Array.isArray(v)) {
          headers.set(k, v.join(', '));
        }
      }

      const hasBody =
        req.method !== 'GET' &&
        req.method !== 'HEAD' &&
        req.method !== 'OPTIONS' &&
        Buffer.isBuffer(req.body) &&
        req.body.length > 0;

      const webRequest = new Request(fullUrl, {
        method: req.method,
        headers,
        body: hasBody ? new Uint8Array(req.body) : undefined,
      });

      const webResponse = await handleD1ApiRequest(webRequest, d1Env);
      res.status(webResponse.status);
      webResponse.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });
      const outBuf = Buffer.from(await webResponse.arrayBuffer());
      res.send(outBuf);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal API server error',
      });
    }
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
              return code
                .replace(
                  'transport.connect(createHMRHandler(handleMessage));',
                  '/* HMR WebSocket disabled in preview */'
                )
                .replace(
                  'else throw new SendBeforeConnectError("send was called before connect");',
                  'else return;'
                )
                .replace(
                  'else throw new SendBeforeConnectError("invoke was called before connect");',
                  'else return;'
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
    app.get('*', (_req: ExpressRequest, res: ExpressResponse) => {
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
