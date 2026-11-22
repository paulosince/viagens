const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');

function sourceBetween(a,b){
  const x=source.indexOf(a),y=source.indexOf(b,x+1);
  assert(x>=0&&y>x,'Missing production function: '+a);
  return source.slice(x,y);
}

const recoveryCode=sourceBetween('async function loadSyncRecovery(', '\nfunction renderSyncConflicts(');
const cacheCode=sourceBetween('async function cacheCompleteWorkspace(', '\nasync function refreshSharedTripOwners(');

async function exercise({allowBackup=true,pending=0,reconcile=false}={}){
  const data={
    days:[{id:'day',trip_id:'trip',position:0,title:'Torre Eiffel'}],
    activities:[
      {id:'local-1',day_id:'day',title:'Bilheteria Eiffel',place_name:'Torre Eiffel'},
      {id:'local-2',day_id:'day',title:'Bateaux-Mouches',place_name:'Rio Sena'}
    ],
    locations:[{id:'local-place',day_id:'day',name:'Pont de l’Alma'}]
  };
  const metadata=new Map();
  const saved=[];
  const state={user:{id:'account'},trips:[{id:'trip',name:'Paris & Lisboa'}],tripDataCache:new Map()};
  const context={
    state, dom:{syncLogDialog:{open:false}},navigator:{onLine:true},Date,Intl,console,
    syncRecoveryOwner:null,syncRecoveryItems:[],SYNC_LOG_LIMIT:30,
    workspaceConflictOwner:null,workspaceConflictDetails:[],workspaceSyncWarning:null,
    offlineStore:{
      countOutbox:async()=>pending,
      hasPendingForTrip:async()=>pending>0,
      getMeta:async key=>metadata.get(key)||null,
      setMeta:async(key,value)=>{
        if(!allowBackup&&key.startsWith('sync_recovery:'))throw Error('No space for archive');
        metadata.set(key,value);
      },
      deleteMeta:async key=>metadata.delete(key),
      loadTripData:async()=>data,
      replaceTripData:async(...values)=>saved.push(values)
    },
    tryNeon:async()=>({from(table){
      assert.equal(table,'trip_days');
      return {select(){return this;},in(){return this;},async order(){
        return {data:data.days,error:null};
      }};
    }}),
    supportsOrderedDaySchema:async()=>true,
    normalizeDayRecord:x=>x,
    loadDayRecords:async()=>({activities:[],locations:[]}),
    adoptLegacyTripMedia:async()=>{},
    groupByDay:()=>new Map(),
    verifiedSyncKey:id=>'verified_sync:'+id,
    scheduleTripMediaCache:()=>{},
    refreshSyncStatus:async()=>{}
  };
  vm.createContext(context);
  vm.runInContext(recoveryCode+'\n'+cacheCode,context);
  let ok=null,error=null;
  try{ok=await context.cacheCompleteWorkspace({force:true,resolveFromServer:reconcile});}
  catch(e){error=e;}
  return {ok,error,metadata,saved,context,data};
}

(async()=>{
  const first=await exercise();
  assert.equal(first.ok,false,'Local-only records must NOT be silently discarded');
  assert.equal(first.saved.length,1);
  assert.equal(first.saved[0][2].length,2,'Both local activities remain in the live copy');
  assert.equal(first.saved[0][3].length,1,'Local location remains in the live copy');
  assert(!first.metadata.has('verified_sync:account'),'No false green on unresolved differences');
  const conflicts=first.metadata.get('sync_conflicts:account');
  assert.equal(conflicts.length,3);
  assert.deepEqual(Array.from(conflicts,x=>x.title),
    ['Bilheteria Eiffel','Bateaux-Mouches','Pont de l’Alma']);
  assert(conflicts.every(x=>x.tripName==='Paris & Lisboa'&&x.dayLabel==='Torre Eiffel'));
  assert.equal(first.metadata.has('sync_recovery:account'),false,'No archive without explicit choice');

  const reconciled=await exercise({reconcile:true});
  assert.equal(reconciled.ok,true,'After explicit choice the current server itinerary is authoritative');
  assert.equal(reconciled.saved.length,1);
  assert.equal(reconciled.saved[0][2].length,0);
  assert.equal(reconciled.saved[0][3].length,0);
  const archives=reconciled.metadata.get('sync_recovery:account');
  assert.equal(archives.length,1,'Complete local backup persisted');
  assert.equal(archives[0].data.activities.length,2);
  assert.equal(archives[0].data.locations.length,1);
  assert.equal(archives[0].differences.length,3);
  assert.equal(reconciled.metadata.get('sync_conflicts:account').length,0);
  assert(reconciled.metadata.has('verified_sync:account'),'Green only after successful protected reconciliation');

  const rejected=await exercise({reconcile:true,allowBackup:false});
  assert(rejected.error && /No space/.test(rejected.error.message));
  assert.equal(rejected.saved.length,0,
    'No local bytes may be replaced if backup failed');
  assert(!rejected.metadata.has('verified_sync:account'));

  const pending=await exercise({reconcile:true,pending:1});
  assert.equal(pending.ok,false);
  assert.equal(pending.saved.length,0,'Never resolve while outbox holds unsent edits');

  assert(html.includes('id="sync_conflict_items"')&&html.includes('id="sync_recovery_restore"'));
  assert(css.includes('.sync-log-item[data-status="pending"]') &&
    css.includes('border-left:4px solid #f2b400'),
    'Yellow pending log must match yellow badge, not brown text');
  assert(css.includes('.sync-log-item[data-status="synced"]') &&
    css.includes('border-left:4px solid #28a651'),
    'Success log must use the same green semantics as badge');
  assert(source.includes('window.confirm('),'Remote replacement must be approved by user');
  console.log('PASS: 2 activities + 1 place diagnosed, backup before reconcile, rollback on storage failure, consistent semantic colors');
})().catch(error=>{console.error(error);process.exitCode=1;});
