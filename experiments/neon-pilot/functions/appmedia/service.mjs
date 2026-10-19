const ORIGIN = 'https://paulosince.github.io';
const headers = { 'access-control-allow-origin': ORIGIN, 'vary': 'Origin', 'cache-control': 'no-store',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-upsert',
  'x-content-type-options': 'nosniff' };
const reply = (data, status = 200) => Response.json(data, { status, headers });
const fail = (message, status) => Object.assign(new Error(message), { status });
export async function boundedBytes(request, max) {
  if (Number(request.headers.get('content-length')) > max) throw fail('FILE_TOO_LARGE', 413);
  const reader = request.body?.getReader();
  if (!reader) throw fail('EMPTY_FILE', 400);
  const chunks=[]; let size=0;
  for (;;) {
    const {value,done}=await reader.read(); if(done)break;
    size+=value.length;
    if(size>max){await reader.cancel();throw fail('FILE_TOO_LARGE',413)}
    chunks.push(value);
  }
  if (!size) throw fail('EMPTY_FILE',400);
  return Buffer.concat(chunks,size);
}
export function validKey(bucket, path) {
  return ['trip-images','profile-photos','day-attachments'].includes(bucket) && typeof path==='string'
    && path.length<=1024 && /^[0-9a-f-]{36}\/.+/i.test(path) && !/(^|\/)\.\.(\/|$)/.test(path)
    && !/[\x00-\x1f\\]/.test(path);
}
export function makeHandler(deps) {
  return async function(request) {
    try {
      if (request.headers.get('origin') && request.headers.get('origin')!==ORIGIN) return reply({error:'ORIGIN_DENIED'},403);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      const token=request.headers.get('authorization')||'';
      if(!/^Bearer\s+\S+$/i.test(token))return reply({error:'AUTH_REQUIRED'},401);
      const url=new URL(request.url), route=url.pathname, bucket=url.searchParams.get('bucket'), path=url.searchParams.get('path');
      if(route==='/remove' && request.method==='POST') {
        const payload=JSON.parse((await boundedBytes(request,32768)).toString());
        if(!Array.isArray(payload.paths)||!payload.paths.length||payload.paths.length>20)throw fail('INVALID_PATHS',400);
        for(const item of payload.paths){if(!validKey(bucket,item))throw fail('INVALID_PATH',400);await deps.authorize(token,bucket,item,true)}
        return reply({data:await deps.remove(bucket,payload.paths)});
      }
      if(!['/download','/sign','/upload'].includes(route))return reply({error:'NOT_FOUND'},404);
      if(!validKey(bucket,path))throw fail('INVALID_PATH',400);
      const write=route==='/upload';
      if(request.method!==(write?'POST':'GET'))throw fail('METHOD_NOT_ALLOWED',405);
      await deps.authorize(token,bucket,path,write);
      if(write){
        const max=bucket==='day-attachments'?6291456:25000000;
        const bytes=await boundedBytes(request,max);
        const type=(request.headers.get('content-type')||'application/octet-stream').split(';')[0];
        return reply({data:await deps.upload(bucket,path,bytes,type,request.headers.get('x-upsert')==='true')});
      }
      const row=await deps.read(bucket,path);
      if(!row)throw fail('FILE_NOT_FOUND',404);
      if(route==='/sign'){
        const seconds=Math.max(30,Math.min(3600,Number(url.searchParams.get('expires'))||300));
        return reply({data:{signedUrl:await deps.sign(row,seconds)}});
      }
      return new Response(await deps.download(row),{headers:{...headers,'content-type':row.content_type,'content-length':String(row.bytes)}});
    } catch(e) { return reply({error:e.status?e.message:'MEDIA_BACKEND_UNAVAILABLE'},e.status||503); }
  };
}
