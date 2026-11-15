// Cloudflare Pages Function: same-origin pass-through to the Viaggio Neon
// Functions (photos, ticket attachments, uploads and storage usage).
//
// The Neon Functions only allow the GitHub Pages origin, and reject any other
// Origin header. Requests without an Origin header are evaluated normally:
// the user's JWT and the database permissions (RLS) still decide access.
// This function forwards only to a fixed list of Neon Function hosts, only
// for the app's own origin, without cookies and without an Origin header.
//
// URL shape: /api/media/<function-host-prefix>/<action>?<query>

const HOST_SUFFIX = '.compute.c-14.us-east-1.aws.neon.tech';
const ALLOWED_ORIGINS = new Set(['https://ioviaggio.com.br']);
const MEDIA_ACTIONS = new Map([['sign', 'GET'], ['download', 'GET'], ['upload', 'POST'], ['remove', 'POST']]);
export const TARGETS = new Map([
  ['br-proud-paper-b83l1z7d-appmedia', MEDIA_ACTIONS],
  ['br-dawn-bread-b83r0ztn-appmedia', MEDIA_ACTIONS],
  ['br-silent-band-b80nklzl-appmedia', MEDIA_ACTIONS],
  ['br-falling-leaf-b8xuv1d0-appmedia', MEDIA_ACTIONS],
  ['br-silent-band-b80nklzl-appwrite', MEDIA_ACTIONS],
  ['br-silent-band-b80nklzl-appusage', new Map([['', 'GET']])],
  ['br-falling-leaf-b8xuv1d0-appusage', new Map([['', 'GET']])]
]);
const FORWARD_HEADERS = ['authorization', 'content-type', 'x-upsert'];
const MAX_UPLOAD = 25000000;

const fail = (status, error) => Response.json({error}, {status, headers: {'cache-control': 'no-store'}});

export async function onRequest({request, params}) {
  const url = new URL(request.url);
  if (!ALLOWED_ORIGINS.has(url.origin)) return fail(403, 'INVALID_HOST');
  const parts = [].concat(params?.path ?? url.pathname.replace(/^\/api\/media\/?/, '').split('/')).filter(Boolean);
  const target = parts[0] || '';
  const action = parts.slice(1).join('/');
  const actions = TARGETS.get(target);
  if (!actions || !actions.has(action)) return fail(404, 'NOT_FOUND');
  if (request.method !== actions.get(action)) return fail(405, 'METHOD_DENIED');

  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return fail(403, 'ORIGIN_DENIED');
  if (request.headers.get('sec-fetch-site') === 'cross-site') return fail(403, 'ORIGIN_DENIED');
  if (request.method === 'POST' && origin !== url.origin) return fail(403, 'ORIGIN_REQUIRED');

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body;
  if (request.method === 'POST') {
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_UPLOAD) return fail(413, 'FILE_TOO_LARGE');
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_UPLOAD) return fail(413, 'FILE_TOO_LARGE');
  }

  let upstream;
  try {
    upstream = await fetch(`https://${target}${HOST_SUFFIX}/${action}${url.search}`, {
      method: request.method, headers, body, redirect: 'manual'
    });
  } catch {
    return fail(502, 'MEDIA_SERVICE_UNAVAILABLE');
  }

  const responseHeaders = new Headers();
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (lower.startsWith('access-control-') || lower === 'set-cookie' || lower === 'content-encoding' || lower === 'content-length' || lower === 'vary') continue;
    responseHeaders.append(name, value);
  }
  responseHeaders.set('cache-control', 'private, no-store');
  return new Response(upstream.body, {status: upstream.status, statusText: upstream.statusText, headers: responseHeaders});
}
