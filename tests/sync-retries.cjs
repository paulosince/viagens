const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const main=fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');
const start=main.indexOf('function safeSyncLogMessage(');
const end=main.indexOf('\nfunction tripNameForLog(',start);
assert(start>0 && end>start,'Bounded sync history/retry functions must exist');
assert(html.includes('id="sync_log_dialog"') && html.includes('id="sync_log_entries"'));
assert(css.includes('.sync-log-dialog'));
assert(main.includes("dom.syncStatus.addEventListener('click', () => {\n  openSyncLog()"),
  'Tapping must ONLY open the history');

const meta=new Map();
const calls=[];
const delays=[];
const user={id:'account-A'};
const dom={syncLogDialog:{open:false},syncLogSummary:{textContent:''},
  syncLogEntries:{replaceChildren(){},append(){} }};
const ctx={
  state:{user}, dom, navigator:{onLine:true},
  SYNC_MAX_ATTEMPTS:3, SYNC_RETRY_DELAYS_MS:[0,1500,3500],
  SYNC_RETRY_COOLDOWN_MS:10*60*1000, SYNC_LOG_LIMIT:30,
  syncRetryPromise:null,syncRetryWaiting:false,syncRetryNumber:0,syncRetryLastStartedAt:0,syncRetryOwnerId:null,
  syncLogOwnerId:null,syncLogRecords:null,syncLogLoading:null,
  workspaceSyncChecking:false,workspaceSyncError:null,workspaceSyncWarning:null,
  workspaceSyncPhase:'',workspaceSyncFailureStage:'agenda',
  offlineStore:{
    getMeta:async key=>meta.get(key)||null,
    setMeta:async(key,value)=>{meta.set(key,value);},
  },
  refreshSyncStatus:async()=>{},
  verifyWorkspaceSync:async()=>{
    calls.push(user.id);
    ctx.workspaceSyncWarning='Divergência entre cópias locais e servidor';
    return false;
  },
  console,
  Date,
  Intl,
  setTimeout:(fn,delay)=>{delays.push(delay);queueMicrotask(fn);return 1;}
};
vm.createContext(ctx);
vm.runInContext(main.slice(start,end)+'\nthis.testSync={runAutomaticSync,loadSyncLog,openSyncLog,safeSyncLogMessage};',ctx);
const sync=ctx.testSync;
(async()=>{
  assert.equal(await sync.runAutomaticSync(),false);
  assert.equal(calls.length,3,'Exactly three attempts are made for a persistent discrepancy');
  assert.deepEqual(delays,[1500,3500],'Retries have bounded progressive intervals');
  const entries=meta.get('sync_log:account-A');
  assert.equal(entries.length,3,'Every attempt is persisted');
  assert.deepEqual(entries.map(e=>e.attempt),[3,2,1]);
  assert(entries.every(e=>e.status==='pending'),'Local divergence is pending, not a network failure');
  assert(entries.every(e=>e.message.includes('Divergência')));
  assert.equal(ctx.syncRetryNumber,0,'Attempt counter clears after a cycle');
  assert.equal(ctx.syncRetryPromise,null,'Cycle single-flight lock clears');
  await sync.runAutomaticSync();
  assert.equal(calls.length,3,'No immediate fourth attempt after exhaustion');

  const before=calls.length;
  // The log itself never requests network synchronization.
  assert.equal(dom.syncLogDialog.open,false);
  assert.equal((await sync.loadSyncLog('account-A')).length,3);
  assert.equal(calls.length,before);

  ctx.syncRetryLastStartedAt=0;
  ctx.verifyWorkspaceSync=async()=>{calls.push(user.id);ctx.workspaceSyncWarning=null;return true;};
  assert.equal(await sync.runAutomaticSync(),true);
  assert.equal(calls.length,4,'A successful first attempt stops the retry cycle');
  assert.equal(meta.get('sync_log:account-A')[0].status,'synced');

  ctx.state.user={id:'account-B'};
  ctx.syncRetryLastStartedAt=0;
  ctx.verifyWorkspaceSync=async()=>{calls.push('account-B');return true;};
  assert.equal(await sync.runAutomaticSync(),true);
  assert.equal(meta.get('sync_log:account-B').length,1);
  assert.equal(meta.get('sync_log:account-A').length,4,
    'Different accounts cannot inherit the same synchronization log');

  assert(!sync.safeSyncLogMessage('Bearer secret-token Neon https://private.test/path').includes('secret-token'));
  assert(!sync.safeSyncLogMessage('Bearer secret-token Neon https://private.test/path').includes('Neon'));

  ctx.navigator.onLine=false;
  const count=calls.length;
  assert.equal(await sync.runAutomaticSync(),false);
  assert.equal(calls.length,count,'Offline mode does not initiate retries');

  console.log('PASS: max 3 automatic attempts, deduplication cooldown, persistent account log, no tap retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
