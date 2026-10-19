import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runStorageProbe} from '../probe-core.mjs';
const cap=4000000000;
function memoryStorage(){
 const blobs=new Map();let reserved=0,committed=0,maxUsed=0,cleared=0;
 const checks=[];
 const api={
  reserve:async (id,n)=>{
   if(n>25000000)throw Error('INVALID_UPLOAD_REQUEST');
   if(reserved+committed+n>cap)throw Error('STORAGE_QUOTA_EXCEEDED');
   reserved+=n;maxUsed=Math.max(maxUsed,reserved+committed);return 'uploads/'+id;
  },
  put:async(k,b)=>{blobs.set(k,Buffer.from(b));checks.push('put')},
  head:async k=>blobs.get(k)?.length,
  get:async k=>blobs.get(k),
  commit:async(_,n)=>{reserved-=n;committed+=n},
  remove:async k=>{blobs.delete(k);checks.push('delete')},
  absent:async k=>!blobs.has(k),
  reclaim:async()=>{committed=0;cleared++},
  budget:async()=>({reserved_bytes:reserved,committed_bytes:committed})
 };
 return {api,stats:()=>({reserved,committed,maxUsed,objects:blobs.size,cleared,checks})};
}
test('six parallel synthetic uploads always leave zero physical bytes',async()=>{
 const {api,stats}=memoryStorage();
 const results=await Promise.all(Array.from({length:6},(_,i)=>runStorageProbe({
  ...api,id:'11111111-1111-4111-8111-'+String(i+1).padStart(12,'0'),
  image:Buffer.from('synthetic-70'.padEnd(70,'_'))
 })));
 assert.equal(results.filter(r=>r.ok).length,6);
 assert.equal(stats().objects,0);
 assert.equal(stats().reserved,0);
 assert.equal(stats().committed,0);
 assert.equal(stats().cleared,6);
});
test('interrupted read after upload performs DELETE before reclaim',async()=>{
 const {api,stats}=memoryStorage();
 let readDone=false;
 const outcome=await runStorageProbe({...api,id:'22222222-2222-4222-8222-222222222222',image:Buffer.alloc(70),
  get:async key=>{await api.get(key);readDone=true;throw Error('NETWORK_INTERRUPTED')}});
 assert.equal(readDone,true);
 assert.equal(outcome.error,'TRANSFER_FAILED');
 assert.equal(stats().objects,0);
 assert.deepEqual(stats().checks,['put','delete']);
 assert.equal(stats().reserved+stats().committed,0);
});
test('object-cap denies 25,000,001 bytes before writing',async()=>{
 const {api,stats}=memoryStorage();
 await assert.rejects(api.reserve('33333333-3333-4333-8333-333333333333',25000001),/INVALID_UPLOAD_REQUEST/);
 assert.equal(stats().objects,0);assert.equal(stats().reserved,0);
});
