import {measureStorage} from './storage.mjs';
const ORIGIN='https://paulosince.github.io';
const headers={'access-control-allow-origin':ORIGIN,'access-control-allow-headers':'authorization, content-type','access-control-allow-methods':'GET, OPTIONS','cache-control':'private, no-store','vary':'Origin'};
const json=(data,status=200)=>Response.json(data,{status,headers});
export function createUsageHandler({fetcher=fetch,measure=measureStorage,api=process.env.VIAGGIO_USAGE_API}={}) {
 return {async fetch(req){
  if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return json({error:'ORIGIN_DENIED'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(new URL(req.url).pathname!=='/')return json({error:'NOT_FOUND'},404);
  if(req.method!=='GET')return json({error:'METHOD_DENIED'},405);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth))return json({error:'AUTH_REQUIRED'},401);
  try {
   if(!api?.startsWith('https://'))throw Error('USAGE_NOT_CONFIGURED');
   // Data API verifies the JWT; the RPC also requires the project's owner.
   const r=await fetcher(api+'/rpc/viaggio_my_usage',{method:'POST',redirect:'error',cache:'no-store',headers:{authorization:auth,'content-type':'application/json','content-profile':'viaggio_app','accept-profile':'viaggio_app'},body:'{}',signal:AbortSignal.timeout(15000)});
   if(!r.ok){const e=await r.json().catch(()=>({}));console.warn('USAGE_RPC_FAILED',r.status,String(e.code||'NO_CODE').slice(0,40),String(e.message||'').slice(0,180));return json({error:'USAGE_AUTH_FAILED'},[401,403].includes(r.status)||e.code==='42501'?403:503);}
   const rows=await r.json();const row=rows?.[0];
   if(!Array.isArray(rows)||rows.length!==1||!row)throw Error('INVALID_USAGE_RESPONSE');
   for(const key of ['database_bytes','database_quota_bytes','storage_quota_bytes','image_bytes','attachment_bytes']){
    if(row[key]===null||row[key]===undefined||!Number.isSafeInteger(Number(row[key]))||Number(row[key])<0)throw Error('INVALID_USAGE_RESPONSE');
   }
   if(Number(row.database_quota_bytes)<=0||Number(row.storage_quota_bytes)<=0)throw Error('INVALID_USAGE_LIMIT');
   const physical=await measure();
   return json({data:[{...row,...physical,measurement_version:2,storage_measurement:'physical_bucket',measured_at:new Date().toISOString()}]});
  }catch(e){console.warn('USAGE_UNAVAILABLE',String(e.message).slice(0,60));return json({error:'USAGE_UNAVAILABLE'},503);}
 }};
}
export default createUsageHandler();
