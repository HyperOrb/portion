import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer as createViteServer } from 'vite';
import config, { assertPublicEnvironment } from '../vite.config.ts';
import { createAppServer } from '../server/index.js';

test('build refuses browser-prefixed server secrets before they can enter a bundle', () => {
  assert.doesNotThrow(() => assertPublicEnvironment({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public', GEMINI_API_KEY: 'server-only', VITE_VERCEL_URL: 'public-site.vercel.app' }));
  for (const env of [{ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' }, { VITE_GEMINI_API_KEY: 'private' }, { VITE_SUPABASE_SECRET_KEY: 'private' }]) assert.throws(() => assertPublicEnvironment(env), /secret/i);
});

test('Vite forwards browser origin intact so real meal POSTs reach the API', async (t) => {
  const api = createAppServer({ env: {} });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  t.after(async () => { api.closeAllConnections(); await new Promise(done => api.close(done)); });
  const vite = await createViteServer({
    ...config, configFile: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null,
      proxy: { '/api': { ...config.server.proxy['/api'], target: `http://127.0.0.1:${api.address().port}` } } },
  });
  t.after(() => vite.close());
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const request = (from) => fetch(`${origin}/api/parse`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: from }, body: JSON.stringify({ description: '200 g cooked rice' }) });
  const response = await request(origin);
  assert.equal(response.status, 503); // Reaches missing-key setup, rather than a proxy-origin rejection.
  assert.equal((await response.json()).code, 'GEMINI_NOT_CONFIGURED');
  assert.equal((await request('https://foreign.example')).status, 403);
});
