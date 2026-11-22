const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const modelStart = source.indexOf('function syncIndicatorViewModel(');
const modelEnd = source.indexOf('\nasync function ensureNeon(', modelStart);
assert(modelStart > 0 && modelEnd > modelStart, 'Pure status model must be defined');
const modelContext = {Intl, Date};
vm.createContext(modelContext);
vm.runInContext(source.slice(modelStart, modelEnd), modelContext);
const model = input => modelContext.syncIndicatorViewModel({
  online: true, pending: 0, snapshotAt: null, verifiedAt: null,
  checking: false, error: null, warning: null, queueError: null, hasTrips: true, ...input
});
assert.equal(model({verifiedAt:'2026-11-22T08:30:00Z'}).kind, 'synced');
assert.match(model({verifiedAt:'2026-11-22T08:30:00Z'}).text, /Roteiro sincronizado às/);
assert.equal(model({snapshotAt:'2026-11-22T08:30:00Z'}).kind, 'pending',
  'Local snapshot alone must never advertise a green sync');
assert.equal(model({checking:true}).kind, 'syncing');
assert.equal(model({checking:true,phase:'Verificando agenda…'}).text, 'Verificando agenda…');
assert(!model({warning:'Divergência'}).text.includes('toque'), 'Badge must not ask the user to retry');
assert(!model({error:'conexão'}).text.includes('toque'), 'Failed badge must not ask for retry');
assert.equal(model({checking:true,online:false}).kind, 'offline',
  'Losing the network must dismiss a stale progress indication');
assert.equal(model({pending:3,verifiedAt:'2026-11-22T08:30:00Z'}).kind, 'pending',
  'Queued edits override prior success');
assert.equal(model({pending:1,queueError:'timeout'}).kind, 'error');
assert.equal(model({error:'network down',verifiedAt:'2026-11-22T08:30:00Z'}).kind, 'error');
assert.equal(model({warning:'Local-only records',verifiedAt:'2026-11-22T08:30:00Z'}).kind, 'pending');
assert.equal(model({warning:'Local-only records',conflictCount:3}).text, '3 itens locais para revisar');
assert.equal(model({pending:null}).kind, 'error', 'Unreadable local outbox cannot be treated as empty');
for(const state of [{},{checking:true},{verifiedAt:'2026-11-22T08:30:00Z'},{online:false},{error:'failure'}]){
  assert(!/Neon|Supabase/i.test(model(state).text),'UI must not expose the backend product');
}
for (const kind of ['synced','syncing','pending','offline','error']) {
  assert(css.includes('.home-bottom .sync-status[data-kind="'+kind+'"]'),
    'Bottom status must have a meaningful color for '+kind);
}

async function exerciseSnapshot({localActivities=[],localDays=[],force=true,fresh=false}={}) {
  const meta = new Map();
  if (fresh) meta.set('complete_snapshot:user',new Date().toISOString());
  const records = [];
  let reads = 0, mediaCalls = 0;
  const state = {
    user:{id:'user'}, trips:[{id:'trip'}], tripDataCache:new Map()
  };
  const client = {from(table) {
    assert.equal(table,'trip_days');
    return {select(){return this;},in(){return this;},async order() {
      reads++;
      return {data:[{id:'day',trip_id:'trip'}],error:null};
    }};
  }};
  const ctx = {
    state, navigator:{onLine:true},
    offlineStore:{
      countOutbox:async()=>0,hasPendingForTrip:async()=>false,
      getMeta:async key=>meta.get(key)||null,
      setMeta:async(k,v)=>{meta.set(k,v);},
      deleteMeta:async k=>{meta.delete(k);},
      loadTripData:async()=>({days:localDays,activities:localActivities,locations:[]}),
      replaceTripData:async (...args)=>records.push(args)
    },
    tryNeon:async()=>client,supportsOrderedDaySchema:async()=>true,
    normalizeDayRecord:x=>x,
    loadDayRecords:async()=>({activities:[],locations:[]}),
    adoptLegacyTripMedia:async()=>{},cacheTripMedia:async()=>{},
    groupByDay:()=>new Map(),verifiedSyncKey:id=>'verified_sync:'+id,
    scheduleTripMediaCache:()=>{mediaCalls++;},
    dom:{syncLogDialog:{open:false}},
    refreshSyncStatus:async()=>{},console,Date
  };
  vm.createContext(ctx);
  const start = source.indexOf('async function cacheCompleteWorkspace(');
  const end = source.indexOf('\nasync function refreshSharedTripOwners(',start);
  assert(start>0 && end>start);
  vm.runInContext(source.slice(start,end),ctx);
  const result = await ctx.cacheCompleteWorkspace({force});
  return {result,meta,records,reads,state,mediaCalls};
}
(async()=>{
  const good=await exerciseSnapshot();
  assert.equal(good.result,true);
  assert(good.meta.has('verified_sync:user'),'Verified timestamp is persisted');
  assert.equal(good.state.tripDataCache.get('trip').remoteVerified,true);

  const divergent=await exerciseSnapshot({localActivities:[{id:'local',day_id:'day'}]});
  assert.equal(divergent.result,false,'Local-only entries disqualify green success');
  assert(!divergent.meta.has('verified_sync:user'));
  assert.equal(divergent.state.tripDataCache.get('trip').remoteVerified,false);
  assert.equal(divergent.records[0][2].length,1,'Local-only activity must be preserved');

  const stale=await exerciseSnapshot({force:false,fresh:true});
  assert.equal(stale.result,false);
  assert.equal(stale.reads,0,'Normal background cache may honor freshness guard');

  const forced=await exerciseSnapshot({force:true,fresh:true});
  assert.equal(forced.result,true);
  assert.equal(forced.reads,1,'User-initiated sync must bypass 30 minute cache guard');

  const localDay=await exerciseSnapshot({localDays:[{id:'offline-day',trip_id:'trip'}]});
  assert.equal(localDay.result,false,'Unreconciled local days must block green success');
  assert.equal(localDay.records.length,0,'Local-only days must not be overwritten');
  assert(!localDay.meta.has('verified_sync:user'));
  const media=await exerciseSnapshot();
  assert.equal(media.result,true,'Optional media must not block a completed itinerary snapshot');
  assert.equal(media.mediaCalls,1,'Photos are scheduled after the itinerary check');

  // Use the actual media-precache loop: one missing photo must not interrupt
  // other media, and cannot change the confirmed itinerary result.
  const photoStart=source.indexOf('async function cacheTripMedia(');
  const photoEnd=source.indexOf('\nfunction scheduleTripMediaCache(',photoStart);
  assert(photoStart>0 && photoEnd>photoStart);
  const attempted=[];
  const photoContext={
    navigator:{onLine:true},console:{warn(){}},
    cacheManagedMedia:async record=>{
      attempted.push(record.id);
      if(record.id==='missing')throw new Error('HTTP 404');
    }
  };
  vm.createContext(photoContext);
  vm.runInContext(source.slice(photoStart,photoEnd),photoContext);
  await photoContext.cacheTripMedia([{id:'missing'}],[{id:'ok'}],[{id:'also-ok'}],{});
  assert.deepEqual(attempted,['missing','ok','also-ok'],
    'One missing image must not stop the remaining downloads');

  assert(source.includes('await cacheCompleteWorkspace({force:true})'),
    'Full sync must force a fresh read');
  assert(source.includes("dom.syncStatus.addEventListener('click', () => {\n  openSyncLog()"),
    'Touching the status opens the history without starting synchronization');
  assert(!source.includes("dom.syncStatus.addEventListener('click', () => {\n  verifyWorkspaceSync()"),
    'Status touch must not manually restart syncing');
  assert(source.includes("await runAutomaticSync()"),
    'Background startup must schedule automatic retries');
  assert(source.includes("if (navigator.onLine) runAutomaticSync()"),
    'Returning to the app must schedule automatic retries');
  console.log('PASS: verified sync model, actual remote checks, pending/error states and divergence preservation');
})().catch(error=>{console.error(error);process.exitCode=1;});
