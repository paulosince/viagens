export function createHandler({env,manifest,fetcher=fetch,now=()=>Date.now()}) {
 const origin='https://paulosince.github.io';
 const target='https://br-dawn-bread-b83r0ztn-g3auto.compute.c-14.us-east-1.aws.neon.tech/';
 const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store','content-type':'application/json','vary':'Origin'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 return async req=>{
  if(req.headers.get('origin')!==origin)return reply({error:'ORIGIN_DENIED'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'METHOD_DENIED'},405);
  if(now()>Date.parse('2026-10-20T00:00:00Z'))return reply({error:'MIGRATION_CLOSED'},410);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(auth))return reply({error:'AUTH_REQUIRED'},401);
  const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!key)return reply({error:'UNCONFIGURED'},503);
  try {
   const userResponse=await fetcher(base+'/auth/v1/user',{headers:{authorization:auth,apikey:key},signal:AbortSignal.timeout(15000)});
   if(!userResponse.ok)return reply({error:'INVALID_SESSION'},401);
   const user=await userResponse.json();
   if(user.id!=='0230b922-c20a-4be2-8869-0296cb01f1ae')return reply({error:'ADMIN_REQUIRED'},403);
   const text=await req.text(); if(text.length>128)return reply({error:'INVALID_INPUT'},400);
   const input=JSON.parse(text);
   if(input.action==='status')return reply({ok:true,total:manifest.length});
   if(input.action!=='copy'||!Number.isInteger(input.index)||input.index<0||input.index>=manifest.length)return reply({error:'INVALID_ITEM'},400);
   const item=manifest[input.index];
   const source=await fetcher(base+'/storage/v1/object/authenticated/'+item.bucket_id+'/'+item.object_key.split('/').map(encodeURIComponent).join('/'),{headers:{authorization:'Bearer '+key,apikey:key},signal:AbortSignal.timeout(60000)});
   if(!source.ok)return reply({error:'SOURCE_READ_FAILED'},502);
   const bytes=await source.arrayBuffer();
   if(bytes.byteLength!==Number(item.expected_size))return reply({error:'SOURCE_SIZE_MISMATCH'},409);
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const url=new URL(target);url.searchParams.set('migration','upload');url.searchParams.set('bucket',item.bucket_id);url.searchParams.set('path',item.object_key);
   const copied=await fetcher(url,{method:'POST',headers:{origin,authorization:auth,'content-type':'application/octet-stream','x-content-sha256':hash},body:bytes,signal:AbortSignal.timeout(90000)});
   const result=await copied.json();
   if(!copied.ok||!result.ok)return reply({error:'DESTINATION_COPY_FAILED',detail:result.error},502);
   url.searchParams.set('migration','verify');
   const check=await fetcher(url,{method:'POST',headers:{origin,authorization:auth,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});
   const verified=await check.json();
   if(!check.ok||!verified.ok||verified.sha256!==hash||Number(verified.bytes)!==bytes.byteLength)return reply({error:'DESTINATION_VERIFICATION_FAILED'},502);
   return reply({ok:true,index:input.index,bytes:bytes.byteLength,sha256:hash});
  }catch{return reply({error:'MIGRATION_FAILED'},502)}
 };
}
