import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
function worker() {
  const listeners = {};
  const calls = [];
  const context = {
    URL,
    self: {location: {origin: 'https://ioviaggio.com.br'},
      addEventListener: (name, fn) => {listeners[name] = fn;}},
    caches: {match: async () => {calls.push('cache'); return new Response('cached');},
      open: async () => ({put: async () => {calls.push('put');}})},
    fetch: async () => {calls.push('fetch'); return new Response('fresh');}
  };
  vm.runInNewContext(source, context);
  return {listeners, calls};
}
test('auth/API requests bypass all SW caching and offline HTML fallbacks', () => {
  for (const path of ['/api/auth/get-session', '/api/auth/token', '/api/data/trips', '/viagens/api/auth/get-session']) {
    const {listeners, calls} = worker();
    let intercepted = false;
    listeners.fetch({request: new Request('https://ioviaggio.com.br' + path),
      respondWith: () => {intercepted = true;}});
    assert.equal(intercepted, false, path);
    assert.deepEqual(calls, []);
  }
});
test('bearer-authenticated requests bypass caches irrespective of path', () => {
  const {listeners, calls} = worker();
  listeners.fetch({request: new Request('https://ioviaggio.com.br/private', {
    headers: {authorization: 'Bearer synthetic-test-token'}}),
    respondWith: () => assert.fail('protected request intercepted')});
  assert.deepEqual(calls, []);
});
test('static shell still supports cached responses', async () => {
  const {listeners, calls} = worker();
  let response;
  listeners.fetch({request: new Request('https://ioviaggio.com.br/viagens/style.css'),
    respondWith: value => {response = value;}});
  assert.equal(await (await response).text(), 'cached');
  assert.ok(calls.includes('cache'));
});
