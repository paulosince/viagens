// Tests for the same-origin Neon Auth pass-through (functions/api/auth/[[path]].js).
// Uses a mocked upstream; no real credentials or network.
import assert from 'node:assert/strict';
import {onRequest, rewriteSetCookie} from '../functions/api/auth/[[path]].js';

const site = 'https://ioviaggio.com.br';
const call = (path, init = {}, host = site) => {
  const request = new Request(`${host}/api/auth/${path}`, init);
  return onRequest({request, params: {path: path.split('?')[0].split('/')}});
};

const nativeFetch = globalThis.fetch;
const seen = [];
globalThis.fetch = async (input, init) => {
  const url = new URL(input);
  seen.push({url, init, headers: new Headers(init.headers)});
  const headers = new Headers({'content-type': 'application/json', 'set-auth-jwt': 'synthetic.jwt.value', 'access-control-allow-origin': site});
  headers.append('set-cookie', '__Secure-neon-auth.session_token=abc; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Domain=neon.tech');
  return new Response('{"ok":true}', {status: 200, headers});
};

try {
  // Rejections never reach the upstream.
  assert.equal((await call('get-session', {}, 'https://paulosince.github.io')).status, 403);
  assert.equal((await call('admin/list-users')).status, 404);
  assert.equal((await call('sign-in/email')).status, 405);
  assert.equal((await call('sign-in/email', {method: 'POST', body: '{}'})).status, 403, 'POST without Origin');
  assert.equal((await call('sign-in/email', {method: 'POST', headers: {origin: 'https://evil.example'}, body: '{}'})).status, 403);
  assert.equal((await call('get-session', {headers: {'sec-fetch-site': 'cross-site'}})).status, 403);
  assert.equal((await call('sign-in/email', {method: 'POST', headers: {origin: site}, body: 'x'.repeat(20000)})).status, 413);
  assert.equal(seen.length, 0);

  // Allowed sign-in: forwarded to the fixed upstream with the app origin and body.
  const login = await call('sign-in/email', {method: 'POST', headers: {origin: site, 'content-type': 'application/json', cookie: 'a=b'}, body: '{"email":"x"}'});
  assert.equal(login.status, 200);
  assert.equal(seen[0].url.href, 'https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth/sign-in/email');
  assert.equal(seen[0].headers.get('origin'), site);
  assert.equal(seen[0].headers.get('cookie'), 'a=b');
  assert.equal(seen[0].headers.get('host'), null);
  assert.equal(new TextDecoder().decode(seen[0].init.body), '{"email":"x"}');
  const cookie = login.headers.getSetCookie()[0];
  assert.match(cookie, /^__Secure-neon-auth\.session_token=abc; /);
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Partitioned|Domain=|SameSite=None/i);
  assert.equal(login.headers.get('set-auth-jwt'), 'synthetic.jwt.value', 'JWT header must reach the SDK');
  assert.equal(login.headers.get('access-control-allow-origin'), null);
  assert.equal(login.headers.get('cache-control'), 'no-store');

  // get-session keeps its query string.
  await call('get-session?disableCookieCache=true', {headers: {cookie: '__Secure-neon-auth.session_token=abc'}});
  assert.equal(seen[1].url.search, '?disableCookieCache=true');
  assert.equal(seen[1].headers.get('cookie'), '__Secure-neon-auth.session_token=abc');

  assert.equal(rewriteSetCookie('a=1; Path=/'), 'a=1; Path=/; Secure; SameSite=Lax');
  console.log('auth-proxy: ok');
} finally {
  globalThis.fetch = nativeFetch;
}
