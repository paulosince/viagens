const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function testManager() {
  let outbox = 0;
  const body = { dataset: {
    appReady: 'true', session: 'authenticated', activeSheet: 'none', editing: 'false',
    tripPage: 'closed', dayPage: 'closed', budgetPage: 'closed', dayAttachments: 'closed'
  } };
  const doc = { body, visibilityState: 'visible', activeElement: { matches: () => false }, querySelector: () => null };
  const ctx = {
    navigator: { onLine: true, serviceWorker: { controller: {} } },
    document: doc,
    offlineStore: { countOutbox: async () => outbox },
    window: {}, console, Date, setInterval, setTimeout
  };
  const source = fs.readFileSync('src/update-manager.js', 'utf8')
    .replace(/^import\s+\{\s*offlineStore\s*\}[^\n]*\n/, '')
    .replace(/\nstart\(\);\s*$/, '');
  assert(!source.includes('start();'), 'Manager must not start during gate tests');
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  async function safe() { return vm.runInContext('canSwitchVersions()', ctx); }
  assert.equal(await safe(), true, 'Authenticated idle Home is safe');
  outbox = 1;
  assert.equal(await safe(), false, 'Pending offline edits must block updates');
  outbox = 0;
  body.dataset.activeSheet = 'profile';
  assert.equal(await safe(), false, 'Open editor must block updates');
  body.dataset.activeSheet = 'none';
  body.dataset.tripPage = 'open';
  assert.equal(await safe(), false, 'Open trip view must not be interrupted');
  body.dataset.tripPage = 'closed';
  body.dataset.editing = 'true';
  assert.equal(await safe(), false, 'Selection/edit mode must block updates');
  body.dataset.editing = 'false';
  doc.activeElement.matches = () => true;
  assert.equal(await safe(), false, 'Focused text input must block updates');
  doc.activeElement.matches = () => false;
  ctx.navigator.onLine = false;
  assert.equal(await safe(), false, 'Offline app must not reload');
  ctx.navigator.onLine = true;
  body.dataset.session = 'anonymous';
  assert.equal(await safe(), false, 'Login/signup form must not be interrupted');
  body.dataset.session = 'authenticated';
  ctx.offlineStore.countOutbox = async () => { throw Error('blocked'); };
  assert.equal(await safe(), false, 'Uncertain local persistence must block updates');
}

async function testServiceWorker() {
  const hooks = {};
  let skipCalls = 0;
  const storage = new Map();
  const ctx = {
    self: {
      location: { origin: 'https://example.test' },
      addEventListener: (name, callback) => { hooks[name] = callback; },
      skipWaiting: async () => { skipCalls++; },
      clients: { claim: async () => {} }
    },
    caches: {
      open: async name => ({
        addAll: async () => { storage.set(name, true); },
        add: async () => {}
      }),
      keys: async () => [...storage.keys()],
      delete: async name => storage.delete(name)
    },
    fetch: async () => ({}), URL, Promise
  };
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), ctx);
  assert.equal(typeof hooks.install, 'function');
  assert.equal(typeof hooks.message, 'function');
  let installation;
  hooks.install({ waitUntil: p => { installation = p; } });
  await installation;
  assert.equal(skipCalls, 0, 'New cache must install without immediately replacing the active worker');
  let activation;
  hooks.message({ data: { type: 'VIAGGIO_ACTIVATE_UPDATE' }, waitUntil: p => { activation = p; } });
  await activation;
  assert.equal(skipCalls, 1, 'Explicit safe-activation message should release waiting worker');
  const sw = fs.readFileSync('sw.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const script = /src\/update-manager\.js\?v=([^"']+)/.exec(index)?.[1];
  const style = /src\/update-manager\.css\?v=([^"']+)/.exec(index)?.[1];
  assert(script && style && script === style, 'Update manager resources must share a release version');
  assert(sw.includes(`./src/update-manager.js?v=${script}`), 'Worker should precache new manager');
  assert(sw.includes(`./src/update-manager.css?v=${style}`), 'Worker should precache new style');
}

(async () => {
  await testManager();
  await testServiceWorker();
  console.log('Safe PWA updates: all gating, offline, and lifecycle checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
