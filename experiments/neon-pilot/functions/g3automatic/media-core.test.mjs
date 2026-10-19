import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyOne,digest} from './media-core.mjs';
function fixture(){
 const source=Buffer.from('one realistic synthetic media object');
 const sha=digest(source),objects=new Map();
 const log=[],values={key:null,hash:null};
 let reserved=0,used=0;
 const store={send:async cmd=>{
  const name=cmd.constructor.name,k=cmd.input.Key;
  log.push(name);
  if(name==='PutObjectCommand'){objects.set(k,Buffer.from(cmd.input.Body));return {}}
  if(name==='HeadObjectCommand'){if(!objects.has(k))throw Object.assign(new Error('NotFound'),{$metadata:{httpStatusCode:404}});return {ContentLength:objects.get(k).length}}
  if(name==='GetObjectCommand'){if(!objects.has(k))throw new Error('NotFound');return {Body:{transformToByteArray:async()=>objects.get(k)}}}
  if(name==='DeleteObjectCommand'){objects.delete(k);return {}}
  throw Error('Unexpected command: '+name)
 }};
 const client={query:async(sql,args=[])=>{
  if(sql.includes('pg_advisory_'))return {rows:[],rowCount:1};
  if(sql.includes('from viaggio_shadow.media_inventory'))return {rows:[{expected_size:source.length,content_type:'image/jpeg',source_metadata:values.key?{neon_storage_key:values.key,neon_sha256:values.hash}:{}}],rowCount:1};
  if(sql.includes('v2_reserve_upload')){reserved+=args[1];return {rows:[{object_key:'uploads/12345678-1234-4234-8234-123456789abc'}],rowCount:1}};
  if(sql.includes('v2_commit_upload')){reserved-=args[1];used+=args[1];return {rows:[],rowCount:1}};
  if(sql.includes('update viaggio_shadow.media_inventory')){values.key=args[2];values.hash=args[3];return {rows:[{object_key:'synthetic.jpeg'}],rowCount:1}};
  if(sql.includes('v2_reclaim_after_verified_delete')){reserved=0;used=0;return {rows:[],rowCount:1}};
  throw Error('Unrecognized SQL')
 }};
 return {source,sha,objects,values,log,store,client,state:()=>({reserved,used})};
}
test('copies and verifies exactly one source image',async()=>{
 const f=fixture();
 const r=await copyOne({client:f.client,store:f.store,sourceBucket:'trip-images',path:'synthetic.jpeg',sourceBytes:f.source,expectedHash:f.sha});
 assert.equal(r.ok,true);
 assert.equal(f.objects.size,1);
 assert.equal(f.state().used,f.source.length);
 assert.equal(f.values.hash,f.sha);
 const retry=await copyOne({client:f.client,store:f.store,sourceBucket:'trip-images',path:'synthetic.jpeg',sourceBytes:f.source,expectedHash:f.sha});
 assert.equal(retry.ok,true);assert.equal(retry.already,true);assert.equal(f.objects.size,1);
});
test('rejects tampered bytes before using quota or storage',async()=>{
 const f=fixture();
 const r=await copyOne({client:f.client,store:f.store,sourceBucket:'trip-images',path:'synthetic.jpeg',sourceBytes:Buffer.from('tampered'),expectedHash:f.sha});
 assert.equal(r.error,'CONTENT_MISMATCH');assert.equal(f.objects.size,0);assert.equal(f.state().reserved,0);
});
test('rejects unauthorized bucket',async()=>{
 const f=fixture();
 const r=await copyOne({client:f.client,store:f.store,sourceBucket:'not-a-real-bucket',path:'synthetic.jpeg',sourceBytes:f.source,expectedHash:f.sha});
 assert.equal(r.error,'BUCKET_DENIED');assert.equal(f.objects.size,0);
});
