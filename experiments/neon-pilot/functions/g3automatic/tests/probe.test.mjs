import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runStorageProbe} from '../probe-core.mjs';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(fail='',limit=4e9){
 const image=Buffer.from('synthetic'),state={reserved:0,committed:0,deleted:false,events:[]};
 const s=x=>{state.events.push(x);if(fail===x)throw Error(x)};
 const opts={id,image,
  reserve:async(i,n)=>{s('reserve');if(n>limit)throw Error('STORAGE_QUOTA_EXCEEDED');state.reserved=n;return 'uploads/'+i},
  put:async(_,b)=>{s('put');state.content=Buffer.from(b)},
  head:async()=>{s('head');return state.content.length},
  get:async()=>{s('get');return state.content},
  commit:async()=>{s('commit');state.committed=state.reserved;state.reserved=0},
  remove:async()=>{s('delete');state.deleted=true},
  absent:async()=>{s('absent');return state.deleted},
  reclaim:async()=>{s('reclaim');state.reserved=0;state.committed=0},
  budget:async()=>({reserved_bytes:state.reserved,committed_bytes:state.committed})
 };
 return {opts,state};
}
test('transfer and verified cleanup',async()=>{
 const {opts,state}=fixture();const r=await runStorageProbe(opts);
 assert.equal(r.ok,true);assert.equal(state.reserved+state.committed,0);
 assert.deepEqual(state.events,['reserve','put','head','get','commit','delete','absent','reclaim']);
});
test('quota denial does not access storage',async()=>{
 const {opts,state}=fixture('',1);const r=await runStorageProbe(opts);
 assert.equal(r.error,'STORAGE_QUOTA_EXCEEDED');assert.deepEqual(state.events,['reserve']);
});
for(const where of ['put','head','get','commit']){
 test('failure on '+where+' reclaims only after verified removal',async()=>{
  const {opts,state}=fixture(where);const r=await runStorageProbe(opts);
  assert.equal(r.ok,false);assert.equal(r.error,'TRANSFER_FAILED');
  assert.deepEqual(state.events.slice(-3),['delete','absent','reclaim']);
 });
}
for(const where of ['delete','absent','reclaim']){
 test('failure on '+where+' requires reconciliation',async()=>{
  const {opts,state}=fixture(where);const r=await runStorageProbe(opts);
  assert.equal(r.error,'RECONCILIATION_REQUIRED');assert.ok(!state.events.includes('reclaim')||where==='reclaim');
 });
}
test('incorrect size is rejected',async()=>{
 const {opts}=fixture();opts.head=async()=>123;
 const r=await runStorageProbe(opts);assert.equal(r.error,'TRANSFER_FAILED');
});
test('incorrect bytes are rejected',async()=>{
 const {opts}=fixture();opts.get=async()=>Buffer.from('wrong');
 const r=await runStorageProbe(opts);assert.equal(r.error,'TRANSFER_FAILED');
});
