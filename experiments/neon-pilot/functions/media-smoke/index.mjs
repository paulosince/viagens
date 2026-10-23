// Isolated stage-3 storage smoke test: only the logged-in owner of Neon project B.
// Upload, physical SHA256 readback and delete are completed inside one request.
// This endpoint does NOT accept arbitrary object keys or expose S3 credentials.
import { createHash, createHmac, randomUUID } from 'node:crypto';

const ORIGIN='https://paulosince.github.io';
const API='https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1';
const BUCKET='viaggio-lab-media';
const LIMIT=131072;
const CORS={
 'access-control-allow-origin':ORIGIN,
 'access-control-allow-headers':'authorization,content-type',
 'access-control-allow-methods':'POST,OPTIONS',
 'cache-control':'no-store',
 'vary':'Origin'
};
const json=(data,status=200)=>Response.json(data,{status,headers:CORS});
const hash=data=>createHash('sha256').update(data).digest('hex');
const hmac=(key,str)=>createHmac('sha256',key).update(str).digest();
const enc=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());

function sign(method,key,ttl=80){
 const endpoint=process.env.AWS_ENDPOINT_URL_S3,access=process.env.AWS_ACCESS_KEY_ID;
 const secret=process.env.AWS_SECRET_ACCESS_KEY,region=process.env.AWS_REGION;
 if(!endpoint||!access||!secret||!region)throw Error('S3_ENV_MISSING');
 const base=new URL(endpoint);
 if(base.protocol!=='https:'||!/^tests\/[a-f0-9-]{36}$/.test(key))throw Error('S3_INVALID_TARGET');
 const time=new Date().toISOString().replace(/[-:]|\.\d{3}/g,'');
 const day=time.slice(0,8);
 const scope=day+'/'+region+'/s3/aws4_request';
 const path='/'+enc(BUCKET)+'/'+key.split('/').map(enc).join('/');
 const q={
 'X-Amz-Algorithm':'AWS4-HMAC-SHA256',
 'X-Amz-Credential':access+'/'+scope,
 'X-Amz-Date':time,
 'X-Amz-Expires':String(ttl),
 'X-Amz-SignedHeaders':'host'
 };
 if(process.env.AWS_SESSION_TOKEN)q['X-Amz-Security-Token']=process.env.AWS_SESSION_TOKEN;
 const query=Object.entries(q).sort(([a],[b])=>a<b?-1:a>b?1:0)
   .map(([a,b])=>enc(a)+'='+enc(b)).join('&');
 const canonical=[method,path,query,'host:'+base.host+'\n','host','UNSIGNED-PAYLOAD'].join('\n');
 const stringToSign=['AWS4-HMAC-SHA256',time,scope,hash(canonical)].join('\n');
 const signature=createHmac('sha256',hmac(hmac(hmac(hmac('AWS4'+secret,day),region),'s3'),'aws4_request')).update(stringToSign).digest('hex');
 return base.origin+path+'?'+query+'&X-Amz-Signature='+signature;
}

async function ownerAuthorized(jwt){
 const r=await fetch(API+'/rpc/project_context',{
   method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
   headers:{authorization:'Bearer '+jwt,'content-type':'application/json','content-profile':'viaggio_app','accept-profile':'viaggio_app'},
   body:'{}'
 });
 if(!r.ok)return false;
 const value=await r.json().catch(()=>null);
 return value?.is_home===true;
}

export default {
 async fetch(req){
  const origin=req.headers.get('origin');
  if(origin!==ORIGIN)return json({error:'ORIGIN_NOT_ALLOWED'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST'||new URL(req.url).pathname.replace(/^\/+|\/+$/g,'')!=='trial')
    return json({error:'TEST_ONLY'},405);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer [a-zA-Z0-9_.-]+$/.test(auth)||auth.slice(7).split('.').length!==3)
    return json({error:'NEON_AUTH_REQUIRED'},401);
  try{
   if(!await ownerAuthorized(auth.slice(7)))return json({error:'NOT_PROJECT_B_OWNER'},403);
  }catch{return json({error:'NEON_AUTH_BACKEND_ERROR'},503)}
  if(req.headers.get('content-type')!=='image/png')return json({error:'PNG_REQUIRED'},415);
  if(Number(req.headers.get('content-length')||0)>LIMIT)return json({error:'FILE_TOO_LARGE'},413);
  let bytes;
  try{bytes=Buffer.from(await req.arrayBuffer())}catch{return json({error:'INVALID_BODY'},400)}
  if(bytes.length<40||bytes.length>LIMIT
     ||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
    return json({error:'INVALID_PNG'},400);
  const key='tests/'+randomUUID();
  let uploaded=false,deleted=false,error=null;
  let size=bytes.length,originalHash=hash(bytes),readHash=null,readSize=null;
  try{
   const put=await fetch(sign('PUT',key),{
    method:'PUT',headers:{'content-type':'image/png'},body:bytes,redirect:'error',
    signal:AbortSignal.timeout(15000)
   });
   if(!put.ok)throw Error('S3_PUT_'+put.status);
   uploaded=true;
   const get=await fetch(sign('GET',key),{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)
   });
   if(!get.ok)throw Error('S3_GET_'+get.status);
   const received=Buffer.from(await get.arrayBuffer());
   readHash=hash(received);readSize=received.length;
   if(originalHash!==readHash||size!==readSize)throw Error('PHYSICAL_INTEGRITY_MISMATCH');
   const drop=await fetch(sign('DELETE',key),{
    method:'DELETE',redirect:'error',signal:AbortSignal.timeout(15000)
   });
   if(!drop.ok && drop.status!==204)throw Error('S3_DELETE_'+drop.status);
   deleted=true;
   const gone=await fetch(sign('GET',key),{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)
   });
   if(gone.status!==404)throw Error('DELETION_NOT_CONFIRMED_'+gone.status);
  }catch(e){error=String(e?.message||'TEST_ERROR').slice(0,64)}
  finally{
   if(uploaded&&!deleted){
     try{
      const retry=await fetch(sign('DELETE',key),{
       method:'DELETE',redirect:'error',signal:AbortSignal.timeout(15000)
      });
      deleted=retry.ok;
     }catch{}
   }
  }
  if(error)return json({ok:false,error,cleanup_attempted:uploaded},503);
  return json({ok:true,project:'B',uploaded:true,downloaded:true,sha256_verified:true,
   deleted:true,delete_confirmed:true,bytes:size},200);
 }
};
