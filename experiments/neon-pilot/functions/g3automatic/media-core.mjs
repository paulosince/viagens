import {createHash,randomUUID} from 'node:crypto';
import {PutObjectCommand,HeadObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
export const digest=x=>createHash('sha256').update(x).digest('hex');
const bucket='viaggio-lab-media';
export async function matched(store,key,size,hash){
 try{
  const h=await store.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
  if(Number(h.ContentLength)!==size)return false;
  const obj=await store.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  const contents=Buffer.from(await obj.Body.transformToByteArray());
  return contents.length===size&&digest(contents)===hash;
 }catch(e){if(e?.$metadata?.httpStatusCode===404)return false;throw e}
}
export async function absent(store,key){
 try{await store.send(new HeadObjectCommand({Bucket:bucket,Key:key}));return false}
 catch(e){if(e?.$metadata?.httpStatusCode===404||['NoSuchKey','NotFound'].includes(e?.name))return true;throw e}
}
export async function copyOne({client,store,sourceBucket,path,sourceBytes,expectedHash}){
 if(!['trip-images','profile-photos','day-attachments'].includes(sourceBucket))return {ok:false,error:'BUCKET_DENIED'};
 if(!path||path.length>1024||!/^[a-f0-9]{64}$/.test(expectedHash))return {ok:false,error:'INVALID_INPUT'};
 const lock='media-copy:'+sourceBucket+'/'+path;
 await client.query('select pg_advisory_lock(hashtext($1))',[lock]);
 try{
  const response=await client.query('select expected_size,content_type,source_metadata from viaggio_shadow.media_inventory where bucket_id=$1 and object_key=$2',[sourceBucket,path]);
  if(response.rowCount!==1)return {ok:false,error:'NOT_IN_INVENTORY'};
  const item=response.rows[0],size=Number(item.expected_size);
  if(!Number.isSafeInteger(size)||size<=0||size>25000000)return {ok:false,error:'FILE_SIZE_UNSUPPORTED'};
  const existingKey=item.source_metadata?.neon_key||item.source_metadata?.neon_storage_key;
  if(existingKey){
   const key=existingKey;
   if(item.source_metadata.neon_sha256===expectedHash&&await matched(store,key,size,expectedHash))return {ok:true,already:true,bytes:size};
   return {ok:false,error:'EXISTING_COPY_CONFLICT'};
  }
  if(sourceBytes.length!==size||digest(sourceBytes)!==expectedHash)return {ok:false,error:'CONTENT_MISMATCH'};
  const id=randomUUID();let key=null,recorded=false;
  try{
   const reserved=await client.query('select object_key from viaggio_lab.v2_reserve_upload($1::uuid,$2::bigint)',[id,size]);
   key=reserved.rows[0]?.object_key;
   if(!/^uploads\/[a-f0-9-]{36}$/.test(key||''))throw Error('RESERVATION_FAILED');
   await store.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:sourceBytes,ContentLength:size,ContentType:item.content_type||'application/octet-stream'}));
   if(!await matched(store,key,size,expectedHash))throw Error('PHYSICAL_CHECK_FAILED');
   await client.query('select viaggio_lab.v2_commit_upload($1::uuid,$2::bigint)',[id,size]);
   const set=await client.query("update viaggio_shadow.media_inventory set source_metadata=source_metadata||jsonb_build_object('neon_key',$3::text,'neon_sha256',$4::text,'neon_verified_bytes',$5::bigint) where bucket_id=$1 and object_key=$2 and coalesce(source_metadata->>'neon_key',source_metadata->>'neon_storage_key') is null returning object_key",[sourceBucket,path,key,expectedHash,size]);
   if(set.rowCount!==1)throw Error('CONCURRENT_STATE_CHANGE');
   recorded=true;
   return {ok:true,bytes:size,sha256:expectedHash};
  }catch(err){
   if(key&&!recorded){
    try{
     await store.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));
     if(!await absent(store,key))return {ok:false,error:'RECONCILIATION_REQUIRED'};
     await client.query('select viaggio_lab.v2_reclaim_after_verified_delete($1::uuid)',[id]);
    }catch{return {ok:false,error:'RECONCILIATION_REQUIRED'}}
   }
   return {ok:false,error:'COPY_FAILED'};
  }
 }finally{await client.query('select pg_advisory_unlock(hashtext($1))',[lock]).catch(()=>{})}
}
