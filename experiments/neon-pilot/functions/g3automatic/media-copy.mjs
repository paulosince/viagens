// Private, owner-authenticated copy of one inventoried Supabase media object.
// Called only after the main Neon handler has verified Supabase JWT via Data API.
import {createHash,randomUUID} from 'node:crypto';
import {PutObjectCommand,HeadObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
const digest=b=>createHash('sha256').update(b).digest('hex');
const safeError=(code,status=502)=>({status,body:{ok:false,error:code}});
async function verified(store,bucket,key,size,checksum){
 const head=await store.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
 if(Number(head.ContentLength)!==size)return false;
 const file=await store.send(new GetObjectCommand({Bucket:bucket,Key:key}));
 const received=Buffer.from(await file.Body.transformToByteArray());
 return received.length===size&&digest(received)===checksum;
}
async function absent(store,bucket,key){
 try{await store.send(new HeadObjectCommand({Bucket:bucket,Key:key}));return false}
 catch(e){if(e?.$metadata?.httpStatusCode===404||['NotFound','NoSuchKey'].includes(e?.name))return true;throw e}
}
export async function handleMediaMigration(request,{pool,store,bucket}){
 const u=new URL(request.url),action=u.searchParams.get('migration');
 if(!['list','upload','verify'].includes(action))return safeError('INVALID_MIGRATION_ACTION',400);
 const client=await pool.connect();
 try{
  if(action==='list'){
   const q=await client.query("select bucket_id,object_key,expected_size,content_type,(source_metadata ? 'neon_key') as copied from viaggio_shadow.media_inventory order by bucket_id,object_key");
   return {status:200,body:{ok:true,items:q.rows.map(r=>({bucket:r.bucket_id,path:r.object_key,bytes:Number(r.expected_size),mime:r.content_type,copied:r.copied}))}};
  }
  const sourceBucket=u.searchParams.get('bucket')||'',path=u.searchParams.get('path')||'';
  if(!['trip-images','profile-photos','day-attachments'].includes(sourceBucket)||!path||path.length>1000||path.includes('\0'))return safeError('INVALID_SOURCE',400);
  if(action==='verify'){
   const stored=await client.query('select expected_size,source_metadata from viaggio_shadow.media_inventory where bucket_id=$1 and object_key=$2',[sourceBucket,path]);
   const record=stored.rows[0];
   if(!record?.source_metadata?.neon_key)return safeError('NO_VERIFIED_COPY',404);
   const valid=await verified(store,bucket,record.source_metadata.neon_key,Number(record.expected_size),record.source_metadata.neon_sha256);
   return valid?{status:200,body:{ok:true,bytes:Number(record.expected_size),sha256:record.source_metadata.neon_sha256}}:safeError('PHYSICAL_COPY_INVALID',409);
  }
  const hash=request.headers.get('x-content-sha256')||'';
  if(!/^[a-f0-9]{64}$/.test(hash))return safeError('INVALID_CHECKSUM',400);
  const keyLock=sourceBucket+'/'+path;
  const lock=await client.query('select pg_try_advisory_lock(hashtext($1)) as obtained',[keyLock]);
  if(!lock.rows[0]?.obtained)return safeError('COPY_IN_PROGRESS',409);
  try{
   const inventory=await client.query('select expected_size,content_type,source_metadata from viaggio_shadow.media_inventory where bucket_id=$1 and object_key=$2',[sourceBucket,path]);
   if(inventory.rowCount!==1)return safeError('NOT_IN_INVENTORY',404);
   const src=inventory.rows[0],length=Number(src.expected_size);
   if(!Number.isSafeInteger(length)||length<1||length>25000000)return safeError('UNSUPPORTED_FILE_SIZE',413);
   if(src.source_metadata?.neon_key){
    if(src.source_metadata.neon_sha256!==hash)return safeError('COPIED_HASH_DIFFERENT',409);
    const good=await verified(store,bucket,src.source_metadata.neon_key,length,hash);
    return good?{status:200,body:{ok:true,already:true,bytes:length}}:safeError('STORED_COPY_INVALID',409);
   }
   const chunks=[];let size=0;
   for await(const chunk of request.body){
    size+=chunk.length;
    if(size>length)return safeError('SOURCE_SIZE_MISMATCH',413);
    chunks.push(Buffer.from(chunk));
   }
   const body=Buffer.concat(chunks);
   if(size!==length||digest(body)!==hash)return safeError('SOURCE_CHECKSUM_MISMATCH',422);
   const id=randomUUID();
   let key=null,done=false;
   try{
    const reservation=await client.query('select object_key from viaggio_lab.v2_reserve_upload($1::uuid,$2::bigint)',[id,size]);
    key=reservation.rows[0]?.object_key;
    if(!key)throw Error('RESERVATION_NOT_FOUND');
    await store.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentLength:size,ContentType:src.content_type||'application/octet-stream'}));
    if(!await verified(store,bucket,key,size,hash))throw Error('BYTE_VERIFICATION_FAILED');
    await client.query('select viaggio_lab.v2_commit_upload($1::uuid,$2::bigint)',[id,size]);
    const written=await client.query("update viaggio_shadow.media_inventory set source_metadata=source_metadata||jsonb_build_object('neon_key',$3::text,'neon_sha256',$4::text,'neon_verified_bytes',$5::bigint) where bucket_id=$1 and object_key=$2 and not (source_metadata ? 'neon_key') returning object_key",[sourceBucket,path,key,hash,size]);
    if(written.rowCount!==1)throw Error('INVENTORY_WRITE_CONFLICT');
    done=true;
    return {status:200,body:{ok:true,bytes:size,sha256:hash}};
   }catch(e){
    if(key&&!done){
     try{
      await store.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));
      if(!await absent(store,bucket,key))return safeError('MANUAL_RECONCILIATION_REQUIRED');
      await client.query('select viaggio_lab.v2_reclaim_after_verified_delete($1::uuid)',[id]);
     }catch{return safeError('MANUAL_RECONCILIATION_REQUIRED')}
    }
    return safeError('UPLOAD_COPY_FAILED');
   }
  }finally{await client.query('select pg_advisory_unlock(hashtext($1))',[keyLock])}
 }finally{client.release()}
}
