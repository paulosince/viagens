import {createHmac,createHash,randomUUID} from 'node:crypto';
const origin='https://paulosince.github.io';
const dataApi='https://ep-floral-sea-b829egtf.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1';
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg6HhnDAADrAGq+UOxXAAAAABJRU5ErkJggg==','base64');
const sha=v=>createHash('sha256').update(v).digest('hex');
const mac=(k,v)=>createHmac('sha256',k).update(v).digest();
const cors={'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store'};
const reply=(x,n=200)=>new Response(JSON.stringify(x),{status:n,headers:{...cors,'content-type':'application/json'}});
async function authenticate(req){
 const token=req.headers.get('authorization');
 if(!token?.startsWith('Bearer '))return false;
 const resp=await fetch(dataApi+'/rpc/is_project_owner',{method:'POST',headers:{authorization:token,'content-type':'application/json','content-profile':'viaggio_collab','accept-profile':'viaggio_collab'},body:'{}'});
 return resp.ok&&(await resp.json())===true;
}
async function object(method,key,body){
 const e=process.env;
 const {AWS_ENDPOINT_URL_S3:endpoint,AWS_REGION:region,AWS_ACCESS_KEY_ID:access,AWS_SECRET_ACCESS_KEY:secret}=e;
 if(!endpoint||!region||!access||!secret)throw Error('STORAGE_NOT_CONFIGURED');
 const url=new URL(endpoint);
 url.pathname='/viaggio-lab-media/'+key;
 const now=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=now.slice(0,8),hash=sha(body||Buffer.alloc(0));
 const h={host:url.host,'x-amz-content-sha256':hash,'x-amz-date':now};
 const names=Object.keys(h).sort(),signed=names.join(';');
 const canonical=[method,url.pathname,'',names.map(k=>k+':'+h[k]+'\n').join(''),signed,hash].join('\n');
 const scope=day+'/'+region+'/s3/aws4_request';
 const key4=mac(mac(mac(mac(Buffer.from('AWS4'+secret),day),region),'s3'),'aws4_request');
 const signature=mac(key4,['AWS4-HMAC-SHA256',now,scope,sha(canonical)].join('\n')).toString('hex');
 return fetch(url,{method,headers:{...h,authorization:'AWS4-HMAC-SHA256 Credential='+access+'/'+scope+', SignedHeaders='+signed+', Signature='+signature,...(method==='PUT'?{'content-type':'image/png'}:{})},body:method==='PUT'?body:undefined,signal:AbortSignal.timeout(15000)});
}
export default {async fetch(req){
 if(req.headers.get('origin')!==origin)return reply({error:'ORIGIN_DENIED'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'METHOD_DENIED'},405);
 try{if(!await authenticate(req))return reply({error:'AUTH_DENIED'},403)}catch{return reply({error:'AUTH_UNAVAILABLE'},503)}
 const key='g3-probe/'+randomUUID()+'.png';let uploaded=false;
 try{
  let r=await object('PUT',key,image);if(!r.ok)throw Error('PUT_'+r.status);uploaded=true;
  r=await object('HEAD',key);if(!r.ok||Number(r.headers.get('content-length'))!==image.length)throw Error('HEAD_SIZE_'+r.status);
  r=await object('GET',key);if(!r.ok||!Buffer.from(await r.arrayBuffer()).equals(image))throw Error('CONTENT_CHECK_'+r.status);
  r=await object('DELETE',key);if(!r.ok)throw Error('DELETE_'+r.status);uploaded=false;
  r=await object('HEAD',key);if(r.status!==404)throw Error('NOT_DELETED_'+r.status);
  return reply({ok:true,bytes:image.length,checks:['PUT','HEAD','GET','MATCH','DELETE','HEAD_404']});
 }catch(e){if(uploaded)try{await object('DELETE',key)}catch{}return reply({ok:false,error:String(e.message||e).slice(0,110)},502)}
}};
