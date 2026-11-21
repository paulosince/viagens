const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the real IndexedDB adapter without network or browser dependencies.
const stores = new Map();
const revoked = [];
let nextUrl = 0;
function createDb() {
  return {
    objectStoreNames: { contains(name) { return stores.has(name); } },
    createObjectStore(name) { stores.set(name, new Map()); },
    transaction(name) {
      const tx = { oncomplete:null, onerror:null, onabort:null };
      const map = stores.get(name);
      tx.objectStore = () => ({
        get(key) { const r = {}; queueMicrotask(() => { r.result = map.get(key); r.onsuccess?.(); }); return r; },
        getKey(key) { const r = {}; queueMicrotask(() => { r.result = map.has(key) ? key : undefined; r.onsuccess?.(); }); return r; },
        put(value) { map.set(value.key, value); queueMicrotask(() => tx.oncomplete?.()); },
        delete(key) { map.delete(key); queueMicrotask(() => tx.oncomplete?.()); }
      });
      return tx;
    }
  };
}
const db = createDb();
const indexedDB = {
  open() {
    const request = {result:db};
    queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
  }
};
const ctx = {
  indexedDB, Blob, Date, console,
  URL: {createObjectURL:() => 'blob:ticket-' + (++nextUrl), revokeObjectURL:url => revoked.push(url)}
};
const moduleSource = fs.readFileSync('experiments/neon-pilot/app/ticket-offline.mjs','utf8')
  .replace(/^export /gm,'');
vm.createContext(ctx);
vm.runInContext(moduleSource + '\nthis.adapter={readTicketManifest,writeTicketManifest,readTicketBlob,hasTicketBlob,writeTicketBlob,deleteTicketBlob,ticketObjectUrl,revokeTicketObjectUrls};',ctx);
const t = ctx.adapter;

(async () => {
  assert.equal(await t.readTicketManifest('alice','trip'),null,'Not-synced is different from empty');
  const doc = {id:'ticket',storage_path:'trip/general/ingresso.pdf',mime_type:'application/pdf',
    signedUrl:'blob:transient',cardSignedUrl:'blob:cover',offlineReady:true};
  await t.writeTicketManifest('alice','trip',[doc]);
  const manifest = await t.readTicketManifest('alice','trip');
  assert.equal(manifest.length,1);
  assert.equal(manifest[0].signedUrl,undefined,'Session blob URLs must not be persisted');
  assert.equal(manifest[0].offlineReady,undefined,'Availability must be derived from bytes');
  assert.equal(await t.readTicketManifest('bob','trip'),null,'Manifest must not cross accounts');
  await t.writeTicketManifest('alice','empty',[]);
  assert.equal((await t.readTicketManifest('alice','empty')).length,0);

  const file = new Blob(['%PDF-1.7\nViaggio test'],{type:'application/pdf'});
  const path = doc.storage_path;
  assert.equal(await t.hasTicketBlob('alice',path),false);
  await t.writeTicketBlob('alice',path,file);
  assert.equal(await t.hasTicketBlob('alice',path),true);
  assert.equal(await t.hasTicketBlob('bob',path),false,'Private bytes must not cross accounts');
  assert.equal((await t.readTicketBlob('alice',path)).size,file.size);
  assert.equal(await t.readTicketBlob('bob',path),null);
  const url = await t.ticketObjectUrl('alice',path);
  assert.equal(url,'blob:ticket-1');
  assert.equal(await t.ticketObjectUrl('alice',path),url,'Object URLs are reused in one session');
  t.revokeTicketObjectUrls();
  assert.deepEqual(revoked,[url],'Session URLs are revoked at logout');
  await t.deleteTicketBlob('alice',path);
  assert.equal(await t.hasTicketBlob('alice',path),false,'Deleted original bytes are purged');

  const main = fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
  const sw = fs.readFileSync('sw.js','utf8');
  assert(main.includes('async function restoreCachedTickets(tripId)'));
  assert(main.includes('const saved = await readTicketBlob(userId, file.storage_path)'));
  assert(main.includes('prefetchTripTickets(key, client)'));
  assert(main.includes('de ' + "' + available.length + ' documentos disponíveis offline'"));
  assert(sw.includes('./experiments/neon-pilot/app/ticket-offline.mjs?v=20261121-offline1'));
  console.log('PASS: private ticket manifests, persisted PDF bytes, account isolation and offline app wiring');
})().catch(error => {console.error(error);process.exitCode=1;});
