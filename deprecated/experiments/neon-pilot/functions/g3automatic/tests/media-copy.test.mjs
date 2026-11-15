import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleMediaMigration} from '../media-copy.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
function setup({missing=false,failPut=false}={}){
 const path='one/photograph.jpg',bucket='trip-images';
 const data=Buffer.from('fake-test-photo-content');
 const catalog={bucket_id:bucket,object_key:path,expected_size:data.length,content_type:'image/jpeg',source_metadata:{}};
 const objects=new Map(),ledger=new Map();
 let reserved=0,committed=0,puts=0,deletes=0,failOnce=failPut;
 const client={
  release(){},
  async query(sql,args=[]){
   if(sql.includes('pg_try_advisory_lock'))return {rows:[{obtained:true}],rowCount:1};
   if(sql.includes('pg_advisory_unlock'))return {rows:[],rowCount:0};
   if(sql.includes('select bucket_id,object_key,expected_size,content_type'))return {rows:missing?[]:[{...catalog,copied:!!catalog.source_metadata.neon_key}],rowCount:missing?0:1};
   if(sql.includes('select expected_size,content_type,source_metadata'))return {rows:missing?[]:[catalog],rowCount:missing?0:1};
   if(sql.includes('select expected_size,source_metadata from viaggio_shadow.media_inventory'))return {rows:missing?[]:[catalog],rowCount:missing?0:1};
   if(sql.includes('v2_reserve_upload')){
    const [id,size]=args;reserved+=size;ledger.set(id,{size,state:'reserved'});
    return {rows:[{object_key:'uploads/'+id}],rowCount:1};
   }
   if(sql.includes('v2_commit_upload')){
    const [id,size]=args;reserved-=size;committed+=size;ledger.get(id).state='committed';return {rows:[{}],rowCount:1};
   }
   if(sql.includes('v2_reclaim_after_verified_delete')){
    const entry=ledger.get(args[0]);if(entry?.state==='committed')committed-=entry.size;
    else if(entry?.state==='reserved')reserved-=entry.size;
    ledger.delete(args[0]);return {rows:[{}],rowCount:1};
   }
   if(sql.includes('update viaggio_shadow.media_inventory')){
    const [b,k,key,digest,size]=args;
    if(b!==bucket||k!==path||catalog.source_metadata.neon_key)return {rows:[],rowCount:0};
    catalog.source_metadata={neon_key:key,neon_sha256:digest,neon_verified_bytes:size};
    return {rows:[{object_key:path}],rowCount:1};
   }
   throw Error('unexpected SQL '+sql.slice(0,70));
  }
 };
 const pool={async connect(){return client}};
 const store={async send(cmd){
  const name=cmd.constructor.name,key=cmd.input.Key;
  if(name==='PutObjectCommand'){if(failOnce){failOnce=false;throw Error('injected PUT failure')}
   puts++;objects.set(key,Buffer.from(cmd.input.Body));return {};}
  if(name==='HeadObjectCommand'){
   if(!objects.has(key)){const e=new Error('NotFound');e.$metadata={httpStatusCode:404};throw e}
   return {ContentLength:objects.get(key).length};
  }
  if(name==='GetObjectCommand'){
   if(!objects.has(key))throw Error('not stored');
   return {Body:{transformToByteArray:async()=>objects.get(key)}};
  }
  if(name==='DeleteObjectCommand'){objects.delete(key);deletes++;return {};}
  throw Error('unknown S3 command '+name);
 }};
 function request(body=data,hash=sha(body),action='upload'){
  const url=new URL('https://example.net/');
  url.searchParams.set('migration',action);
  url.searchParams.set('bucket',bucket);url.searchParams.set('path',path);
  return new Request(url,{method:'POST',headers:{'x-content-sha256':hash},body:action==='list'?undefined:body});
 }
 return {pool,store,bucket,data,request,stats:()=>({reserved,committed,puts,deletes,objects:objects.size,copied:!!catalog.source_metadata.neon_key})};
}
test('copies exact bytes, preserves quota, and records verified metadata',async()=>{
 const s=setup();
 const r=await handleMediaMigration(s.request(),s);
 assert.equal(r.status,200);assert.equal(r.body.ok,true);
 assert.equal(r.body.bytes,s.data.length);
 assert.deepEqual(s.stats(),{reserved:0,committed:s.data.length,puts:1,deletes:0,objects:1,copied:true});
});
test('retry of the same bytes is idempotent',async()=>{
 const s=setup();
 await handleMediaMigration(s.request(),s);
 const r=await handleMediaMigration(s.request(),s);
 assert.equal(r.body.already,true);assert.equal(s.stats().puts,1);
});
test('source checksum mismatch rejects before any reservation',async()=>{
 const s=setup();const r=await handleMediaMigration(s.request(s.data,'0'.repeat(64)),s);
 assert.equal(r.status,422);assert.equal(s.stats().puts,0);assert.equal(s.stats().reserved,0);
});
test('source path missing from inventory rejects',async()=>{
 const s=setup({missing:true});const r=await handleMediaMigration(s.request(),s);
 assert.equal(r.status,404);assert.equal(s.stats().puts,0);
});
test('PUT failure releases bytes only after verified physical absence',async()=>{
 const s=setup({failPut:true});const r=await handleMediaMigration(s.request(),s);
 assert.equal(r.status,502);assert.equal(r.body.error,'UPLOAD_COPY_FAILED');
 assert.equal(s.stats().reserved,0);assert.equal(s.stats().committed,0);
 assert.equal(s.stats().objects,0);assert.equal(s.stats().deletes,1);
});
test('lists inventoried source file without reading it',async()=>{
 const s=setup();const r=await handleMediaMigration(s.request(undefined,undefined,'list'),s);
 assert.equal(r.status,200);assert.equal(r.body.items.length,1);
 assert.equal(r.body.items[0].copied,false);assert.equal(s.stats().puts,0);
});

test('independent verification rereads the stored physical bytes',async()=>{
 const s=setup();await handleMediaMigration(s.request(),s);
 const r=await handleMediaMigration(s.request(undefined,undefined,'verify'),s);
 assert.equal(r.status,200);assert.equal(r.body.bytes,s.data.length);
 assert.equal(r.body.sha256,sha(s.data));
});
test('verification rejects a missing physical copy',async()=>{
 const s=setup();const r=await handleMediaMigration(s.request(undefined,undefined,'verify'),s);
 assert.equal(r.status,404);assert.equal(r.body.error,'NO_VERIFIED_COPY');
});
