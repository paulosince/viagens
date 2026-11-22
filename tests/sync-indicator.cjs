const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const modelStart = source.indexOf('function syncIndicatorViewModel(');
const modelEnd = source.indexOf('\n// Authentication and data requests', modelStart);
assert(modelStart > 0 && modelEnd > modelStart, 'Pure status model must be defined');
const modelContext = {Intl, Date};
vm.createContext(modelContext);
vm.runInContext(source.slice(modelStart, modelEnd), modelContext);
const model = input => modelContext.syncIndicatorViewModel({
  online: true, pending: 0, snapshotAt: null, verifiedAt: null,
  checking: false, error: null, queueError: null, hasTrips: true, ...input
});
assert.equal(model({verifiedAt:'2026-11-22T08:30:00Z'}).kind, 'synced');
assert.match(model({verifiedAt:'2026-11-22T08:30:00Z'}).text, /Roteiro sincronizado às/);
assert.equal(model({snapshotAt:'2026-11-22T08:30:00Z'}).kind, 'pending',
  'Local snapshot alone must never advertise a green sync');
assert.equal(model({checking:true}).kind, 'syncing');
assert.equal(model({checking:true,online:false}).kind, 'offline',
  'Losing the network must dismiss a stale progress indication');
assert.equal(model({pending:3,verifiedAt:'2026-11-22T08:30:00Z'}).kind, 'pending',
  'Queued edits override prior success');
assert.equal(model({pending:1,queueError:'timeout'}).kind, 'error');
assert.equal(model({error:'network down',verifiedAt:'2026-11-22T08:30:00Z'}).kind, 'error');
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
  if (fresh) meta.set('complete_snapshot:user','2026-11-22T08:45:00Z');
  const records = [];
  let reads = 0;
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
    refreshSyncStatus:async()=>{},console,Date
  };
  vm.createContext(ctx);
  const start = source.indexOf('async function cacheCompleteWorkspace(');
  const end = source.indexOf('\nasync function refreshSharedTripOwners(',start);
  assert(start>0 && end>start);
  vm.runInContext(source.slice(start,end),ctx);
  const result = await ctx.cacheCompleteWorkspace({force});
  return {result,meta,records,reads,state};
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

  const localDay=await exerciseSnapshot({localDays:[{id:'offline-day',trip_id:'trip'}]}).then(
    ()=>null,error=>error);
  assert(localDay instanceof Error && /preservada/.test(localDay.message),
    'Never silently erase days that exist only on the phone');

  assert(source.includes('await cacheCompleteWorkspace({force:true})'),
    'Full sync must force a fresh read');
  assert(source.includes("dom.syncStatus.addEventListener('click', () => {\n  verifyWorkspaceSync()"),
    'Status touch must invoke the real verifier');
  console.log('PASS: verified sync model, actual remote checks, pending/error states and divergence preservation');
})().catch(error=>{console.error(error);process.exitCode=1;});
