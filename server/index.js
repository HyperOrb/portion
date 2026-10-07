import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, GEMINI_MODEL, parseMeal } from './gemini.js';
import { searchFoods, getFood } from './nutrition.js';
import { cloudRequired, createCloud, requireUser, reserveParse, releaseParse } from './cloud.js';

const DEFAULT_DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function boundedNumber(value, fallback, max) {
  const number = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(number) && number >= 0 && number <= max ? Math.floor(number) : fallback;
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

function assertOrigin(req, env) {
  const requestOrigin = new URL(`${env.VERCEL ? 'https' : 'http'}://${req.headers.host || 'localhost'}`);
  const host = requestOrigin.hostname.replace(/^\[|\]$/g, '');
  let configuredOrigin;
  try { const configured = env.APP_ORIGIN ? new URL(env.APP_ORIGIN) : null; if (configured && !['http:', 'https:'].includes(configured.protocol)) throw new Error(); configuredOrigin = configured?.origin || null; } catch { throw new ApiError(503, 'INVALID_SERVER_ORIGIN', 'APP_ORIGIN must be a complete http or https origin.'); }
  const configuredHost = configuredOrigin ? new URL(configuredOrigin).hostname.replace(/^\[|\]$/g, '') : null;
  // Prevent arbitrary Host names from rebinding a local server through a foreign site.
  const deploymentHosts = env.VERCEL ? [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean) : [];
  const isAllowedHost = host === 'localhost' ||
    isIP(host) ||
    host === configuredHost ||
    (configuredHost && (host === `www.${configuredHost}` || configuredHost === `www.${host}`)) ||
    deploymentHosts.includes(host);
  if (!isAllowedHost) throw new ApiError(403, 'UNTRUSTED_HOST', 'Use localhost, the computer’s local IP address, or the configured APP_ORIGIN.');
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'CROSS_SITE_REQUEST', 'Open the app directly to make this request.');
  if (!req.headers.origin) return;
  let origin;
  try { origin = new URL(req.headers.origin); } catch { throw new ApiError(403, 'INVALID_ORIGIN', 'Open the app directly to make this request.'); }
  const direct = origin.origin === requestOrigin.origin;
  const configured = origin.origin === configuredOrigin;
  const configuredWww = configuredOrigin ? (origin.hostname === `www.${configuredHost}` || configuredHost === `www.${origin.hostname}`) : false;
  const dev = env.NODE_ENV !== 'production' && origin.protocol === 'http:' && origin.hostname === requestOrigin.hostname && ['5173', '4173'].includes(origin.port);
  if (!direct && !configured && !configuredWww && !dev) throw new ApiError(403, 'CROSS_SITE_REQUEST', 'Requests must come from this app’s origin.');
}

function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    req.resume();
    throw new ApiError(415, 'JSON_REQUIRED', 'Send the request as application/json.');
  }
  // Vercel's Node adapter may already have parsed the request body.
  let parsedBody;
  try { parsedBody = req.body; }
  catch { throw new ApiError(400, 'INVALID_JSON', 'Send a valid JSON object.'); }
  if (parsedBody !== undefined) {
    let value;
    try {
      const serialized = typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody);
      if (Buffer.byteLength(serialized, 'utf8') > 20000) throw new ApiError(413, 'REQUEST_TOO_LARGE', 'Meal descriptions must be under 4,000 characters.');
      value = JSON.parse(serialized);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, 'INVALID_JSON', 'Send a valid JSON object.');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'INVALID_JSON', 'Send a valid JSON object.');
    return Promise.resolve(value);
  }
  return new Promise((resolveBody, reject) => {
    req.setEncoding('utf8');
    let bytes = 0;
    let body = '';
    let oversized = false;
    req.on('data', (chunk) => {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > 20000) {
        oversized = true;
        body = '';
        reject(new ApiError(413, 'REQUEST_TOO_LARGE', 'Meal descriptions must be under 4,000 characters.'));
      } else if (!oversized) body += chunk;
    });
    req.on('end', () => {
      if (oversized) return;
      try {
        const value = JSON.parse(body);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body');
        resolveBody(value);
      } catch { reject(new ApiError(400, 'INVALID_JSON', 'Send a valid JSON object.')); }
    });
    req.on('error', () => reject(new ApiError(400, 'REQUEST_INTERRUPTED', 'The request was interrupted. Please try again.')));
    req.on('aborted', () => reject(new ApiError(400, 'REQUEST_INTERRUPTED', 'The request was interrupted. Please try again.')));
  });
}

async function serveFile(req, res, pathname, distPath) {
  const decodedPath = decodeURIComponent(pathname);
  if (decodedPath.split('/').some((part) => part.startsWith('.'))) throw new ApiError(404, 'NOT_FOUND', 'File not found.');
  let filename = resolve(distPath, `.${decodedPath}`);
  if (filename !== resolve(distPath) && !filename.startsWith(resolve(distPath) + sep)) throw new ApiError(404, 'NOT_FOUND', 'Page not found.');
  try {
    if (!(await stat(filename)).isFile()) filename = resolve(distPath, 'index.html');
  } catch {
    if (extname(filename)) throw new ApiError(404, 'NOT_FOUND', 'File not found.');
    filename = resolve(distPath, 'index.html');
  }
  let contents;
  try { contents = await readFile(filename); } catch { throw new ApiError(503, 'CLIENT_NOT_BUILT', 'Run npm run build, then npm start; for development use npm run dev.'); }
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(filename)] || 'application/octet-stream',
    'Cache-Control': extname(filename) === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(req.method === 'HEAD' ? undefined : contents);
}

export function createRequestHandler({ env = process.env, parse = parseMeal, search = searchFoods, food = getFood, now = Date.now, distPath = DEFAULT_DIST, cloud = createCloud(env), apiOnly = false } = {}) {
  const authRequired = cloudRequired(env);
  const dailyLimit = boundedNumber(env.GEMINI_DAILY_LIMIT, 20, 1000);
  const minIntervalMs = boundedNumber(env.GEMINI_MIN_INTERVAL_SECONDS, 3, 3600) * 1000;
  let usageDay = '';
  let usageCount = 0;
  let lastAttempt = -Infinity;
  let inFlight = false;
  const resetDay = () => {
    const today = new Date(now()).toISOString().slice(0, 10);
    if (usageDay !== today) { usageDay = today; usageCount = 0; }
  };
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      const { pathname } = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (pathname.startsWith('/api/')) {
        assertOrigin(req, env);
        if (pathname === '/api/config' && req.method === 'GET') {
          resetDay();
          const model = env.GEMINI_MODEL?.trim() || GEMINI_MODEL;
          return json(res, 200, { geminiConfigured: Boolean(env.GEMINI_API_KEY?.trim()), model, dailyLimit, remainingToday: authRequired ? null : Math.max(0, dailyLimit - usageCount), authRequired, cloudConfigured: Boolean(cloud), nutritionMode: env.USDA_API_KEY?.trim() ? 'personal-key' : 'shared-demo-key' });
        }
        if (authRequired) await requireUser(req, cloud);
        if (pathname === '/api/parse' && req.method === 'POST') {
          const body = await readJson(req);
          if (typeof body.description !== 'string' || body.description.trim().length < 3 || body.description.length > 4000) throw new ApiError(400, 'INVALID_DESCRIPTION', 'Describe one meal using 3 to 4,000 characters. Include amounts when you know them.');
          if (!env.GEMINI_API_KEY?.trim()) throw new ApiError(503, 'GEMINI_NOT_CONFIGURED', 'Set GEMINI_API_KEY in the server .env file using a Free Tier Google AI Studio project, then restart. Never paste your key into this app or chat.');
          const lease = randomUUID();
          if (authRequired) await reserveParse(cloud, dailyLimit, minIntervalMs / 1000, lease);
          else {
            resetDay();
            if (usageCount >= dailyLimit) throw new ApiError(429, 'DAILY_SAFEGUARD', `The app’s ${dailyLimit}-request daily safeguard has been reached. It resets at midnight UTC. You can still log usual meals or enter foods manually.`);
            const remaining = minIntervalMs - (now() - lastAttempt);
            if (inFlight || remaining > 0) throw new ApiError(429, 'REQUEST_PACING', 'Please wait a moment before estimating another meal.', Math.max(1, Math.ceil(remaining / 1000)));
            // ponytail: device-only development uses one process; hosted requests always use the durable SQL budget.
            usageCount += 1; lastAttempt = now(); inFlight = true;
          }
          try { return json(res, 200, await parse(body.description.trim(), { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL?.trim() || GEMINI_MODEL })); }
          finally { if (authRequired) await releaseParse(cloud, lease); else inFlight = false; }
        }
        if (pathname === '/api/foods/search' && req.method === 'POST') {
          const body = await readJson(req);
          const cookingState = body.cookingState ?? 'unknown';
          return json(res, 200, { foods: await search({ query: body.query, name: body.name ?? '', cookingState, brand: body.brand ?? '', source: body.source ?? 'auto' }) });
        }
        if (/^\/api\/foods\/(?:\d{1,10}|off-\d{8,14})$/.test(pathname) && req.method === 'GET') return json(res, 200, { food: await food(pathname.split('/').at(-1)) });
        throw new ApiError(404, 'NOT_FOUND', 'API endpoint not found.');
      }
      if (apiOnly) throw new ApiError(404, 'NOT_FOUND', 'API endpoint not found.');
      if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      await serveFile(req, res, pathname, distPath);
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      const expected = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599;
      const status = expected ? error.status : 500;
      if (error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
      json(res, status, { error: expected ? error.message : 'The server could not complete this request. Please try again.', code: expected ? error.code || 'API_ERROR' : 'SERVER_ERROR', ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) });
    }
  };
}

export function createAppServer(options = {}) {
  const server = createServer(createRequestHandler(options));
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '127.0.0.1';
  createAppServer().listen(port, host, () => {
    // Startup status only. No request logging, descriptions, API keys or provider bodies.
    console.log(`Portion server listening on http://${host}:${port}`);
  });
}
