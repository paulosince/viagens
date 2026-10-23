// Neon-only Viaggio lab. Read-only private media with RLS verified by Neon Data API.
// No Supabase calls, secrets or credentials exposed to browser.
import { createHash } from 'node:crypto';
import { signedReadUrl } from './storage-sign.mjs';
import {writeMedia} from './media-write.mjs';

const ORIGIN = 'https://paulosince.github.io';
const API = 'https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1';
const BUCKETS = new Set(['trip-images','profile-photos','day-attachments']);
const headers = {
  'access-control-allow-origin': ORIGIN,
  'access-control-allow-headers': 'authorization, content-type, x-upsert',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'cache-control': 'private, no-store',
  'vary': 'Origin'
};
const json = (data, status=200) => Response.json(data,{status,headers});
const fail = (code,status) => json({error:code},status);

async function authorizedManifest(jwt,bucket,path) {
  const response = await fetch(API + '/rpc/media_read_manifest',{
    method:'POST',redirect:'error',cache:'no-store',
    headers:{
      authorization:'Bearer ' + jwt,
      'content-type':'application/json',
      'content-profile':'viaggio_app',
      'accept-profile':'viaggio_app'
    },
    body:JSON.stringify({p_bucket:bucket,p_path:path}),
    signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const problem=await response.json().catch(()=>({}));
    if (response.status===401 || response.status===403 || problem.code==='42501')
      return {error:'ACCESS_DENIED',status:403};
    if (problem.code==='P0002') return {error:'FILE_NOT_FOUND',status:404};
    return {error:'MEDIA_AUTH_BACKEND_UNAVAILABLE',status:503};
  }
  const item=await response.json();
  if (!item || typeof item.storage_key!=='string'
    || !/^[a-f0-9]{64}$/i.test(item.sha256||'')
    || !Number.isSafeInteger(Number(item.bytes))
    || Number(item.bytes)<1 || Number(item.bytes)>25000000)
    return {error:'INVALID_MEDIA_REFERENCE',status:503};
  return {item};
}

export default {
 async fetch(req) {
  const origin=req.headers.get('origin');
  if (origin && origin!==ORIGIN) return fail('ORIGIN_DENIED',403);
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers});

  const url=new URL(req.url);
  const action=url.pathname.replace(/^\/+|\/+$/g,'');
  if (!['download','sign','upload','remove'].includes(action)) return fail('NOT_FOUND',404);
  if(req.method!==(['download','sign'].includes(action)?'GET':'POST')) return fail('METHOD_DENIED',405);
  const auth=req.headers.get('authorization')||'';
  if (!/^Bearer [\w.-]+$/i.test(auth)) return fail('AUTH_REQUIRED',401);
  const jwt=auth.slice(7);
  if (jwt.split('.').length!==3) return fail('AUTH_REQUIRED',401);
  const bucket=url.searchParams.get('bucket')||'';
  const path=url.searchParams.get('path')||'';
  if (!BUCKETS.has(bucket) || (action!=='remove'&&(!path || path.length>1024
    || path.includes('\\') || path.split('/').some(v=>!v||v==='.'||v==='..'))))
    return fail('INVALID_PATH',400);
  const ttl=action==='sign'?Number(url.searchParams.get('expires')):60;
  if (action==='sign'&&(!Number.isInteger(ttl)||ttl<1||ttl>3600)) return fail('INVALID_EXPIRATION',400);

  try {
    if(action==='upload'||action==='remove') return await writeMedia({request:req,route:action,bucket,path,jwt,api:API,error:fail,success:json});
    const record=await authorizedManifest(jwt,bucket,path);
    if (record.error) return fail(record.error,record.status);
    const file=record.item;
    const signed=signedReadUrl(file.storage_key,ttl);
    if (action==='sign') return json({data:{signedUrl:signed}});
    const upstream=await fetch(signed,{
      method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)
    });
    if (upstream.status===404) return fail('FILE_NOT_FOUND',404);
    if (!upstream.ok) return fail('PRIVATE_STORAGE_UNAVAILABLE',503);
    const bytes=Buffer.from(await upstream.arrayBuffer());
    const digest=createHash('sha256').update(bytes).digest('hex');
    if (bytes.length!==Number(file.bytes) || digest!==file.sha256.toLowerCase())
      return fail('PHYSICAL_HASH_MISMATCH',502);
    const mime=/^(image\/(png|jpeg|webp|gif|avif)|application\/pdf)$/.test(file.content_type||'')
      ?file.content_type:'application/octet-stream';
    return new Response(bytes,{headers:{
      ...headers,'content-type':mime,'content-length':String(bytes.length),
      'x-content-type-options':'nosniff'
    }});
  } catch(e) {
    console.error('MEDIA_READ_GATEWAY_ERROR',String(e?.code||e?.name||'UNKNOWN').slice(0,40));
    return fail('MEDIA_GATEWAY_UNAVAILABLE',503);
  }
 }
};
