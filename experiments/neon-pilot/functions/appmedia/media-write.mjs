// Staging-only media writes. Authorization uses JWT and viaggio_app.media_access.
// S3 PUT/GET are verified before registering a visible object in Postgres.
// Removes tombstone a reference; physical bytes remain available for recovery.
import {createHash,randomUUID} from 'node:crypto';
import {signedObjectUrl} from './storage-sign.mjs';
const MAX=25000000;
const MIME=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif','application/pdf']);
const sha=data=>createHash('sha256').update(data).digest('hex');

async function rpc(api,jwt,name,payload){
 const r=await fetch(api+'/rpc/'+name,{
  method:'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json',
   'content-profile':'viaggio_app','accept-profile':'viaggio_app'},
  body:JSON.stringify(payload),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)
 });
 if(r.ok)return {data:await r.json().catch(()=>null)};
 const error=await r.json().catch(()=>({}));
 const code=error?.code;
 if(r.status===401||r.status===403||code==='42501')return {error:'ACCESS_DENIED',status:403};
 if(code==='23505')return {error:'FILE_ALREADY_EXISTS',status:409};
 if(code==='P0002')return {error:'FILE_NOT_FOUND',status:404};
 if(code==='22023')return {error:'INVALID_FILE_METADATA',status:400};
 return {error:'MEDIA_DATABASE_ERROR',status:503};
}
async function s3(method,key,body){
 return fetch(signedObjectUrl(method,key,90),{
  method,body,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(45000)
 });
}
const valid=(type,bytes)=>{
 const str=(a,b)=>bytes.toString('ascii',a,b);
 const h=bytes.subarray(0,12).toString('hex');
 return type==='image/png'?h.startsWith('89504e470d0a1a0a')
  :type==='image/jpeg'?h.startsWith('ffd8ff')
  :type==='image/gif'?['GIF87a','GIF89a'].includes(str(0,6))
  :type==='image/webp'?str(0,4)==='RIFF'&&str(8,12)==='WEBP'
  :type==='image/avif'?str(4,8)==='ftyp'&&['avif','avis'].includes(str(8,12))
  :type==='application/pdf'?str(0,5)==='%PDF-':false;
};
export async function writeMedia({request,route,bucket,path,jwt,api,error,success}){
 if(route==='upload'){
  const allowed=await rpc(api,jwt,'media_access',{p_bucket:bucket,p_path:path,p_write:true});
  if(allowed.error)return error(allowed.error,allowed.status);
  const type=(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!MIME.has(type))return error('UNSUPPORTED_MEDIA_TYPE',415);
  if(Number(request.headers.get('content-length')||0)>MAX)return error('FILE_TOO_LARGE',413);
  const bytes=Buffer.from(await request.arrayBuffer());
  if(!bytes.length||bytes.length>MAX)return error('FILE_TOO_LARGE',413);
  if(!valid(type,bytes))return error('INVALID_FILE_CONTENT',415);
  const key='uploads/'+randomUUID(),digest=sha(bytes);
  let stored=false,recorded=false;
  try{
   const put=await s3('PUT',key,bytes);
   if(!put.ok)return error('S3_UPLOAD_FAILED',503);
   stored=true;
   const got=await s3('GET',key);
   if(!got.ok)return error('S3_READBACK_FAILED',503);
   const physical=Buffer.from(await got.arrayBuffer());
   if(physical.length!==bytes.length||sha(physical)!==digest)return error('S3_SHA256_MISMATCH',502);
   const save=await rpc(api,jwt,'media_register_upload',{
    p_bucket:bucket,p_path:path,p_storage_key:key,p_bytes:bytes.length,
    p_sha256:digest,p_content_type:type,p_upsert:request.headers.get('x-upsert')==='true'
   });
   if(save.error)return error(save.error,save.status);
   recorded=true;
   return success({data:{path,fullPath:path,sha256:digest,bytes:bytes.length}});
  }finally{
   if(stored&&!recorded){try{await s3('DELETE',key)}catch{}}
  }
 }
 if(route==='remove'){
  const payload=await request.json().catch(()=>null);
  const paths=payload?.paths;
  if(!Array.isArray(paths)||!paths.length||paths.length>25||new Set(paths).size!==paths.length)
   return error('INVALID_REMOVE_REQUEST',400);
  if(paths.some(p=>typeof p!=='string'||p.length>900||p.includes('\\')||p.startsWith('/')
    ||p.split('/').some(s=>!s||s==='.'||s==='..')))return error('INVALID_REMOVE_PATH',400);
  for(const p of paths){
   const auth=await rpc(api,jwt,'media_access',{p_bucket:bucket,p_path:p,p_write:true});
   if(auth.error)return error(auth.error,auth.status);
  }
  let count=0;
  for(const p of paths){
   const r=await rpc(api,jwt,'media_mark_deleted',{p_bucket:bucket,p_path:p});
   if(r.error)return error('REMOVE_PARTIALLY_FAILED',503);
   if(r.data?.deleted)count++;
  }
  return success({data:{paths,deleted:count,logical:true}});
 }
 return error('INVALID_WRITE_ROUTE',404);
}
