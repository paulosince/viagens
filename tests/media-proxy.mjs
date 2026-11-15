// Tests for the same-origin Neon Functions pass-through (functions/api/media/[[path]].js)
// and for the client-side endpoint validation. Mocked upstream; no real credentials.
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/media/[[path]].js';

const site = 'https://ioviaggio.com.br';
const call = (path, init = {}, host = site) => {
  const request = new Request(`${host}/api/media/${path}`, init);
  return onRequest({request, params: {path: path.split('?')[0].split('/')}});
};

const nativeFetch = globalThis.fetch;
const seen = [];
globalThis.fetch = async (input, init) => {
  seen.push({url: new URL(input), init, headers: new Headers(init.headers)});
  return new Response('{"data":{"signedUrl":"https://storage.example/x"}}', {status: 200, headers: {
    'content-type': 'application/json', 'access-control-allow-origin': 'https://paulosince.github.io', 'vary': 'Origin'
  }});
};

try {
  const jwt = {authorization: 'Bearer a.b.c'};
  // Rejections never reach the upstream.
  assert.equal((await call('br-proud-paper-b83l1z7d-appmedia/sign', {headers: jwt}, 'https://paulosince.github.io')).status, 403);
  assert.equal((await call('evil-host/sign', {headers: jwt})).status, 404, 'unknown target');
  assert.equal((await call('br-proud-paper-b83l1z7d-appmedia/admin', {headers: jwt})).status, 404, 'unknown action');
  assert.equal((await call('br-silent-band-b80nklzl-appusage/sign', {headers: jwt})).status, 404, 'usage has no media actions');
  assert.equal((await call('br-proud-paper-b83l1z7d-appmedia/upload', {headers: jwt})).status, 405);
  assert.equal((await call('br-proud-paper-b83l1z7d-appmedia/sign', {headers: {...jwt, origin: 'https://evil.example'}})).status, 403);
  assert.equal((await call('br-silent-band-b80nklzl-appwrite/upload', {method: 'POST', headers: jwt, body: 'x'})).status, 403, 'POST needs Origin');
  assert.equal(seen.length, 0);

  // Allowed read: fixed host, same action and query, JWT kept, no Origin/cookie forwarded.
  const read = await call('br-proud-paper-b83l1z7d-appmedia/sign?bucket=trip-images&path=p&expires=60',
    {headers: {...jwt, origin: site, cookie: 'secret=1'}});
  assert.equal(read.status, 200);
  assert.equal(seen[0].url.href, 'https://br-proud-paper-b83l1z7d-appmedia.compute.c-14.us-east-1.aws.neon.tech/sign?bucket=trip-images&path=p&expires=60');
  assert.equal(seen[0].headers.get('authorization'), 'Bearer a.b.c');
  assert.equal(seen[0].headers.get('origin'), null);
  assert.equal(seen[0].headers.get('cookie'), null);
  assert.equal(read.headers.get('access-control-allow-origin'), null);
  assert.equal(read.headers.get('cache-control'), 'private, no-store');

  // Upload: body and content-type forwarded.
  const upload = await call('br-silent-band-b80nklzl-appwrite/upload?bucket=day-attachments&path=p',
    {method: 'POST', headers: {...jwt, origin: site, 'content-type': 'image/jpeg', 'x-upsert': 'false'}, body: new Uint8Array([1, 2, 3])});
  assert.equal(upload.status, 200);
  assert.deepEqual([...new Uint8Array(seen[1].init.body)], [1, 2, 3]);
  assert.equal(seen[1].headers.get('content-type'), 'image/jpeg');
  assert.equal(seen[1].headers.get('x-upsert'), 'false');

  // Usage root.
  await call('br-falling-leaf-b8xuv1d0-appusage/', {headers: jwt});
  assert.equal(seen[2].url.href, 'https://br-falling-leaf-b8xuv1d0-appusage.compute.c-14.us-east-1.aws.neon.tech/');
} finally {
  globalThis.fetch = nativeFetch;
}

// Client: on the custom domain, the media client accepts only the exact
// same-origin pass-through shape, and still accepts plain function roots.
globalThis.location = new URL('https://ioviaggio.com.br/');
const {createNeonMediaClient} = await import('../experiments/neon-pilot/app/storage-neon.mjs');
const requested = [];
const project = (media) => ({id: 'a', media, attachmentMedia: media, mediaWrite: media, client: {
  from: () => ({select: () => ({eq: () => ({limit: async () => ({data: [{id: 'x'}], error: null})})})})
}});
const fakeFetch = async (u) => { requested.push(u); return new Response('{"data":{"signedUrl":"https://s.example/x"}}', {headers: {'content-type': 'application/json'}}); };
const otherProject = {...project('https://x.example/'), client: {from: () => ({select: () => ({eq: () => ({limit: async () => ({data: [], error: null})})})})}};
const tripPath = '11111111-1111-4111-8111-111111111111/cover.jpg';
const ok = createNeonMediaClient({projects: [project(site + '/api/media/br-proud-paper-b83l1z7d-appmedia/'), otherProject], accessToken: async () => 'a.b.c', fetcher: fakeFetch});
const good = await ok.from('trip-images').createSignedUrl(tripPath, 60);
assert.equal(good.error, null);
assert.match(requested[0], /^https:\/\/ioviaggio\.com\.br\/api\/media\/br-proud-paper-b83l1z7d-appmedia\/sign\?/);
for (const bad of [site + '/api/other/x/', 'https://evil.example/api/media/x/', site + '/api/media/../x/']) {
  const client = createNeonMediaClient({projects: [project(bad), otherProject], accessToken: async () => 'a.b.c', fetcher: fakeFetch});
  const result = await client.from('trip-images').createSignedUrl(tripPath, 60);
  assert.ok(result.error, 'must reject ' + bad);
}
delete globalThis.location;
console.log('media-proxy: ok');
