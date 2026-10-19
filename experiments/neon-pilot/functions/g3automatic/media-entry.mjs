// Production Viaggio remains on Supabase. Isolated lab media importer.
import {Pool} from 'pg';
import {attachDatabasePool} from '@neon/functions';
import {S3Client} from '@aws-sdk/client-s3';
import {copyOne,digest} from './media-core.mjs';
const ORIGIN='https://paulosince.github.io';
const API='https://ep-floral-sea-b829egtf.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1';
const CORS={'access-control-allow-origin':ORIGIN,'access-control-allow-headers':'authorization,content-type,x-viaggio-bucket,x-viaggio-path,x-viaggio-sha256','access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store','vary':'Origin'};
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{...CORS,'content-type':'application/json'}});
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:8000});
attachDatabasePool(pool);
const s3=new S3Client({region:process.env.AWS_REGION,endpoint:process.env.AWS_ENDPOINT_URL_S3,forcePathStyle:true,maxAttempts:2,credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,...(process.env.AWS_SESSION_TOKEN?{sessionToken:process.env.AWS_SESSION_TOKEN}:{})}});
async function owner(req){
 const auth=req.headers.get('authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(auth))return false;
 const r=await fetch(API+'/rpc/is_project_owner',{method:'POST',headers:{authorization:auth,'content-type':'application/json','content-profile':'viaggio_collab','accept-profile':'viaggio_collab'},body:'{}',signal:AbortSignal.timeout(10000)});
 return r.ok&&(await r.json())===true;
}
export default {async fetch(req){
 if(req.headers.get('origin')!==ORIGIN)return reply({ok:false,error:'ORIGIN_DENIED'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='POST')return reply({ok:false,error:'METHOD_DENIED'},405);
 if(!process.env.DATABASE_URL||!process.env.AWS_ACCESS_KEY_ID||!process.env.AWS_SECRET_ACCESS_KEY)return reply({ok:false,error:'UNCONFIGURED'},503);
 try{if(!await owner(req))return reply({ok:false,error:'NOT_AUTHORIZED'},403)}catch{return reply({ok:false,error:'AUTH_UNAVAILABLE'},503)}
 let client;
 try{
  client=await pool.connect();
  if(req.headers.get('content-type')==='application/json'){
   const r=await client.query("select bucket_id,object_key,expected_size,content_type from viaggio_shadow.media_inventory where bucket_id='trip-images' and source_metadata->>'neon_storage_key' is null order by expected_size limit 1");
   return reply({ok:true,remaining: Number((await client.query("select count(*) n from viaggio_shadow.media_inventory where source_metadata->>'neon_storage_key' is null")).rows[0].n),item:r.rows[0]||null});
  }
  if(req.headers.get('content-type')!=='application/octet-stream')return reply({ok:false,error:'INVALID_CONTENT_TYPE'},415);
  const sourceBucket=req.headers.get('x-viaggio-bucket')||'',encoded=req.headers.get('x-viaggio-path')||'',expectedHash=req.headers.get('x-viaggio-sha256')||'';
  let path;try{path=decodeURIComponent(encoded)}catch{return reply({ok:false,error:'INVALID_PATH'},400)}
  if(!path||path.length>1024||!['trip-images','profile-photos','day-attachments'].includes(sourceBucket))return reply({ok:false,error:'INVALID_KEY'},400);
  const size=Number(req.headers.get('content-length'));
  if(Number.isFinite(size)&&size>25000000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
  const data=Buffer.from(await req.arrayBuffer());
  if(data.length>25000000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
  if(!/^[a-f0-9]{64}$/.test(expectedHash)||digest(data)!==expectedHash)return reply({ok:false,error:'HASH_MISMATCH'},422);
  const result=await copyOne({client,store:s3,sourceBucket,path,sourceBytes:data,expectedHash});
  return reply(result,result.ok?200:result.error==='FILE_SIZE_UNSUPPORTED'?413:502);
 }catch(e){
  console.error('MEDIA_IMPORT_FAILURE',String(e?.code||e?.name||'ERR').slice(0,50));
  return reply({ok:false,error:'BACKEND_ERROR'},502);
 }finally{client?.release()}
}};
