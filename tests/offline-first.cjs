const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sw = fs.readFileSync('sw.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const main = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
const manager = fs.readFileSync('src/update-manager-neon.js', 'utf8');
const shell = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1];
assert.ok(shell, 'Missing app shell');

function inShell(url) {
  assert.ok(shell.includes("'" + url + "'"), 'Not pre-cached: ' + url);
}
const mainVersion = index.match(/main-neon\.js\?v=([^'"]+)/)?.[1];
assert.ok(mainVersion, 'Missing versioned Neon main');
inShell('./experiments/neon-pilot/app/main-neon.js?v=' + mainVersion);
for (const [,name,version] of main.matchAll(/^import .*?from ['"]\.\/([^'"]+)(\?v=[^'"]+)?['"]/gm)) {
  inShell('./experiments/neon-pilot/app/' + name + (version || ''));
}
inShell('./experiments/neon-pilot/app/food-panel.mjs?v=20261117-food4');
inShell('./experiments/neon-pilot/app/ticket-image-zoom.mjs?v=20261115-zoom1');
const storeVersion = manager.match(/offline-store-neon\.js\?v=([^'"]+)/)?.[1];
assert.ok(storeVersion);
inShell('./experiments/neon-pilot/app/offline-store-neon.js?v=' + storeVersion);
assert.match(manager, /SW_URL = '\.\/sw\.js\?v=20261122-sync-status1'/);

// Execute the actual boot + session verification functions with fake IndexedDB,
// networking and DOM; do not depend on live Neon or user credentials.
const bootSource = main.slice(main.indexOf('async function verifyOnlineSession('), main.indexOf("\nwindow.addEventListener('offline'"));
assert.match(bootSource, /async function boot\(\)/);

async function exercise({ online, cached, hasWorkspace, remote }) {
  const views = [], calls = [], state = {user:null,trips:[],passengers:new Map(),tripRoles:new Map(),tripOwners:new Map(),
    sharedByMe:new Map(),tripDataCache:new Map(),tripDataLoads:new Map(),budgetByTrip:new Map(),tripFilesByTrip:new Map(),
    tripFileDeckIndexes:new Map(),tripTabScroll:new Map()};
  const ctx = {
    document:{body:{dataset:{appReady:'false'}}},
    navigator:{onLine:online,storage:{persist:async()=>true}}, state, HISTORY_RESET_AT:'2026-09-27',
    offlineStore:{open:async()=>{},discardHistoryBefore:async()=>{},getCachedSession:async()=>cached,
      cacheSession:async()=>{},clearSession:async()=>calls.push('cleared')},
    loadLocalWorkspace:async user=>{calls.push('local:' + user.id);state.trips=hasWorkspace?[{id:'trip'}]:[];return hasWorkspace;},
    tryNeon:async()=>remote ?? null, loadProfile:async()=>calls.push('profile'),
    loadTrips:async()=>calls.push('trips'), setSessionView:s=>views.push(s),
    setSplashStatus:()=>{}, refreshSyncStatus:async()=>{}, refreshWorkspaceInBackground:()=>calls.push('refresh'),
    syncTripList:()=>{}, dom:{authMessage:{textContent:''}}, console,
    setTimeout:()=>1, clearTimeout:()=>{}, Date
  };
  vm.createContext(ctx);
  vm.runInContext(bootSource + '\nthis.startBoot = boot;',ctx);
  await ctx.startBoot();
  await Promise.resolve(); await Promise.resolve();
  return {views,calls,state};
}
const user={id:'neon-user',neon_subject:'verified-neon-id'};
(async()=>{
  const offline=await exercise({online:false,cached:user,hasWorkspace:true});
  assert.deepEqual(offline.views,['authenticated']);
  assert(!offline.calls.includes('cleared'));

  // navigator.onLine may be true on a phone even without working connectivity.
  const fakeOnline=await exercise({online:true,cached:user,hasWorkspace:true,remote:null});
  assert.deepEqual(fakeOnline.views,['authenticated']);
  assert(!fakeOnline.calls.includes('cleared'));

  const noLocal=await exercise({online:false,cached:null,hasWorkspace:false});
  assert.deepEqual(noLocal.views,['anonymous']);

  const remote={auth:{getSession:async()=>({data:{session:{user}}})}};
  const firstLogin=await exercise({online:true,cached:null,hasWorkspace:false,remote});
  assert(firstLogin.views.includes('authenticated'));
  assert(firstLogin.calls.includes('trips'));
  console.log('PASS: offline startup, false-online fallback, online sign-in, and complete static module precache');
})().catch(e=>{console.error(e);process.exitCode=1;});
