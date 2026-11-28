import { handleD1ApiRequest } from './_shared/d1Api';
import type { D1Env } from './_shared/d1Types';

interface WorkerEnv extends D1Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleD1ApiRequest(request, env);
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};
