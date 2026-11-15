// Cloudflare Pages Function: same-origin pass-through to Neon Auth.
//
// Why: the app runs on ioviaggio.com.br while Neon Auth lives on *.neon.tech.
// Safari (notably iPad home-screen web apps) may refuse the cross-site session
// cookie, so sign-in succeeds but get-session comes back empty. Serving the auth
// routes from the app's own origin turns the session cookie into a first-party,
// host-only cookie. Tokens are still issued and signed by Neon Auth.
//
// Deliberately narrow: fixed upstream, allow-listed routes and methods,
// same-origin callers only, no caching, no logging of bodies or cookies.

const UPSTREAM = 'https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth';
const ALLOWED_ORIGINS = new Set(['https://ioviaggio.com.br']);
const ROUTES = new Map([
  ['sign-in/email', 'POST'],
  ['get-session', 'GET'],
  ['token', 'GET'],
  ['sign-out', 'POST']
]);
const MAX_BODY = 16384;
// Hop-by-hop or Cloudflare-specific request headers that must not be forwarded.
const DROP_REQUEST_HEADERS = ['host', 'content-length', 'connection', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip'];

const fail = (status, message) => Response.json({message}, {status, headers: {'cache-control': 'no-store'}});

// Make an upstream cookie first-party: host-only, Lax, never partitioned.
export function rewriteSetCookie(value) {
  const [pair, ...attributes] = value.split(';');
  const kept = [];
  for (const raw of attributes) {
    const attribute = raw.trim();
    const name = attribute.split('=')[0].trim().toLowerCase();
    if (!attribute || name === 'domain' || name === 'partitioned' || name === 'samesite') continue;
    kept.push(attribute);
  }
  if (!kept.some(a => a.toLowerCase() === 'secure')) kept.push('Secure');
  kept.push('SameSite=Lax');
  return [pair.trim(), ...kept].join('; ');
}

export async function onRequest({request, params}) {
  const url = new URL(request.url);
  if (!ALLOWED_ORIGINS.has(url.origin)) return fail(403, 'Invalid host');
  const route = [].concat(params?.path ?? url.pathname.replace(/^\/api\/auth\/?/, '').split('/')).filter(Boolean).join('/');
  if (!ROUTES.has(route)) return fail(404, 'Not found');
  if (request.method !== ROUTES.get(route)) return fail(405, 'Method not allowed');

  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return fail(403, 'Invalid origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site') return fail(403, 'Invalid origin');
  if (request.method === 'POST' && origin !== url.origin) return fail(403, 'Origin required');

  const headers = new Headers(request.headers);
  for (const name of DROP_REQUEST_HEADERS) headers.delete(name);
  headers.set('origin', url.origin);

  let body;
  if (request.method === 'POST') {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > MAX_BODY) return fail(413, 'Request too large');
    body = bytes;
  }

  let upstream;
  try {
    upstream = await fetch(`${UPSTREAM}/${route}${url.search}`, {method: request.method, headers, body, redirect: 'manual'});
  } catch {
    return fail(502, 'Authentication service unavailable');
  }

  const responseHeaders = new Headers();
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (lower === 'set-cookie' || lower.startsWith('access-control-') || lower === 'content-encoding' || lower === 'content-length') continue;
    responseHeaders.append(name, value);
  }
  const cookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
  for (const cookie of cookies) responseHeaders.append('set-cookie', rewriteSetCookie(cookie));
  responseHeaders.set('cache-control', 'no-store');
  return new Response(upstream.body, {status: upstream.status, statusText: upstream.statusText, headers: responseHeaders});
}
