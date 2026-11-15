// G3 lab A only; no arbitrary uploads. Never expose storage credentials.
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {attachDatabasePool} from '@neon/functions';
import {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {runStorageProbe} from './probe-core.mjs';
import {handleMediaMigration} from './media-copy.mjs';
const origin='https://paulosince.github.io';
const api='https://ep-floral-sea-b829egtf.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1';
const bucket='viaggio-lab-media';
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg6HhnDAADrAGq+UOxXAAAAABJRU5ErkJggg==','base64');
const cors={'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,content-type,x-content-sha256','access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store',vary:'origin'};
const reply=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,'content-type':'application/json'}});
// Use the designated lab DB, irrespective of the branch's injected default database.
const connectionUrl=new URL(process.env.DATABASE_URL);
connectionUrl.pathname='/viaggio_lab';
connectionUrl.searchParams.set('sslmode','verify-full');
const pool=new Pool({connectionString:connectionUrl.toString(),max:2,connectionTimeoutMillis:8000});
attachDatabasePool(pool);
const storage=new S3Client({region:process.env.AWS_REGION,endpoint:process.env.AWS_ENDPOINT_URL_S3,forcePathStyle:true,maxAttempts:2,credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,...(process.env.AWS_SESSION_TOKEN?{sessionToken:process.env.AWS_SESSION_TOKEN}:{})}});
const one=async(q,v=[])=>(await pool.query(q,v)).rows[0];
async function owner(req){
 const authorization=req.headers.get('authorization');
 if(!/^Bearer\s+\S+$/i.test(authorization||''))return false;
 const r=await fetch(api+'/rpc/is_project_owner',{method:'POST',headers:{authorization,'content-type':'application/json','content-profile':'viaggio_collab','accept-profile':'viaggio_collab'},body:'{}',signal:AbortSignal.timeout(10000)});
 return r.ok&&(await r.json())===true;
}
const db={
 reserve:async(id,n)=>(await one('select object_key from viaggio_lab.v2_reserve_upload($1::uuid,$2::bigint)',[id,n])).object_key,
 commit:(id,n)=>one('select viaggio_lab.v2_commit_upload($1::uuid,$2::bigint)',[id,n]),
 reclaim:id=>one('select viaggio_lab.v2_reclaim_after_verified_delete($1::uuid)',[id]),
 budget:()=>one('select reserved_bytes,committed_bytes,allowance_bytes from viaggio_lab.v2_storage_budget where singleton=1')
};
const objects={
 put:(key,data)=>storage.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:data,ContentLength:data.length,ContentType:'image/png'})),
 head:async(key)=>Number((await storage.send(new HeadObjectCommand({Bucket:bucket,Key:key}))).ContentLength),
 get:async(key)=>(await storage.send(new GetObjectCommand({Bucket:bucket,Key:key}))).Body.transformToByteArray(),
 remove:key=>storage.send(new DeleteObjectCommand({Bucket:bucket,Key:key})),
 absent:async(key)=>{try{await storage.send(new HeadObjectCommand({Bucket:bucket,Key:key}));return false;}catch(e){if(e?.$metadata?.httpStatusCode===404||['NoSuchKey','NotFound'].includes(e.name))return true;throw e;}}
};
export default {async fetch(req){
 if(req.headers.get('origin')!==origin)return reply({ok:false,error:'ORIGIN_DENIED'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({ok:false,error:'METHOD_DENIED'},405);
 let authenticated=false;
 try{authenticated=await owner(req)}catch{return reply({ok:false,error:'AUTH_UNAVAILABLE'},503)}
 if(!authenticated)return reply({ok:false,error:'NOT_OWNER'},403);
 if(!process.env.DATABASE_URL||!process.env.AWS_ENDPOINT_URL_S3||!process.env.AWS_ACCESS_KEY_ID||!process.env.AWS_SECRET_ACCESS_KEY)return reply({ok:false,error:'BACKEND_UNCONFIGURED'},503);
 if(new URL(req.url).searchParams.has('migration')){
  try{const r=await handleMediaMigration(req,{pool,store:storage,bucket});return reply(r.body,r.status)}
  catch(e){console.error('MEDIA_BACKFILL_ERROR',String(e?.code||e?.name||'UNKNOWN').slice(0,40));return reply({ok:false,error:'MEDIA_BACKFILL_FAILED'},502)}
 }
 let phase='DATABASE';
 try{
  const dbname=await one('select current_database() as db');
  if(dbname.db!=='viaggio_lab')return reply({ok:false,error:'WRONG_DATABASE'},503);
  phase='PROBE';
  const body=await req.text();
  if(body.length>512)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
  let payload;try{payload=JSON.parse(body||'{}')}catch{return reply({ok:false,error:'BAD_JSON'},400)}
  const mode=payload?.mode||'single';
  if(!['single','parallel','interrupted-read','object-cap'].includes(mode))return reply({ok:false,error:'INVALID_MODE'},400);
  if(mode==='single'){
   const result=await runStorageProbe({id:randomUUID(),image,...db,...objects});
   return reply(result,result.ok?200:result.error==='STORAGE_QUOTA_EXCEEDED'?413:502);
  }
  // All stress modes use fixed synthetic bytes, unique server-generated keys,
  // and verified deletion. No caller-defined byte sizes or object keys.
  const before=await db.budget();
  if(mode==='parallel'){
   const outcomes=await Promise.all(Array.from({length:6},()=>runStorageProbe({id:randomUUID(),image,...db,...objects})));
   const after=await db.budget();
   const balanced=['reserved_bytes','committed_bytes'].every(k=>String(before[k])===String(after[k]));
   const passed=outcomes.every(x=>x.ok===true)&&balanced;
   return reply({ok:passed,scenario:mode,attempts:outcomes.length,passed:outcomes.filter(x=>x.ok).length,balanced,bytesEach:image.length,budget:after},passed?200:502);
  }
  if(mode==='interrupted-read'){
   let reachedRead=false;
   const brokenGet=async key=>{await objects.get(key);reachedRead=true;throw new Error('INJECTED_READ_INTERRUPTION')};
   const outcome=await runStorageProbe({id:randomUUID(),image,...db,...objects,get:brokenGet});
   const after=await db.budget();
   const balanced=['reserved_bytes','committed_bytes'].every(k=>String(before[k])===String(after[k]));
   const passed=reachedRead&&outcome.error==='TRANSFER_FAILED'&&balanced;
   return reply({ok:passed,scenario:mode,readInterrupted:reachedRead,cleanupVerified:passed,balanced,budget:after},passed?200:502);
  }
  if(mode==='object-cap'){
   // Database must reject >25 MB per-file reservation before any PUT.
   let denied=false;
   try{await db.reserve(randomUUID(),25000001)}catch(e){denied=String(e?.message||'').includes('INVALID_UPLOAD_REQUEST')}
   const after=await db.budget();
   const balanced=['reserved_bytes','committed_bytes'].every(k=>String(before[k])===String(after[k]));
   const passed=denied&&balanced;
   return reply({ok:passed,scenario:mode,oversizedReservationDenied:denied,balanced,budget:after},passed?200:502);
  }
 }catch(e){
  // No connection strings, SQL parameters, bearer tokens, or storage secrets in logs.
  console.error('G3_LAB_FAILURE',phase,String(e?.code||e?.name||'UNKNOWN').slice(0,40));
  return reply({ok:false,error:'BACKEND_ERROR',phase,diagnostic:String(e?.code||e?.name||'UNKNOWN').slice(0,40)},502);
 }
}};
