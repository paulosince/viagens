// Neon G3: test-only object transfer. Not a public upload API.
// Protected by Supabase JWKS and exact owner identity. Never stores user files.
import {createHash,createHmac,createPublicKey,verify,randomUUID} from 'node:crypto';
const ORIGIN='https://paulosince.github.io';
const ISS='https://siabldasqinpfmxslwji.supabase.co/auth/v1';
const OWNER='0230b922-c20a-4be2-8869-0296cb01f1ae';
const BUCKET='viaggio-lab-media';
const IMAGE=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7c0AAAAASUVORK5CYII=','base64');
const sha=b=>createHash('sha256').update(b).digest('hex');
const mac=(key,s)=>createHmac('sha256',key).update(s).digest();
const CORS={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}});
let jwks=null,jwksAt=0;
async function authorize(request){
 const bearer=request.headers.get('authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(bearer))throw Error('MISSING_TOKEN');
 const [a,b,c,...rest]=bearer.slice(7).trim().split('.');
 if(!a||!b||!c||rest.length)throw Error('INVALID_TOKEN');
 const header=JSON.parse(Buffer.from(a,'base64url').toString());
 const claim=JSON.parse(Buffer.from(b,'base64url').toString());
 const now=Math.floor(Date.now()/1000);
 if(!['RS256','ES256'].includes(header.alg)||!header.kid)throw Error('UNSUPPORTED_SIGNING');
 if(claim.iss!==ISS||claim.aud!=='authenticated'||claim.role!=='authenticated'||
    claim.sub!==OWNER||!Number.isFinite(claim.exp)||claim.exp<=now||
    (claim.nbf!==undefined&&claim.nbf>now))throw Error('INVALID_IDENTITY');
 if(!jwks||Date.now()-jwksAt>300000){
   const r=await fetch(ISS+'/.well-known/jwks.json',{signal:AbortSignal.timeout(9000)});
   if(!r.ok)throw Error('JWKS_UNAVAILABLE');
   jwks=await r.json();jwksAt=Date.now();
 }
 let key=jwks.keys?.find(k=>k.kid===header.kid&&(!k.alg||k.alg===header.alg));
 if(!key){
   jwks=null;
   const r=await fetch(ISS+'/.well-known/jwks.json',{signal:AbortSignal.timeout(9000)});
   if(!r.ok)throw Error('JWKS_UNAVAILABLE');
   jwks=await r.json();jwksAt=Date.now();
   key=jwks.keys?.find(k=>k.kid===header.kid&&(!k.alg||k.alg===header.alg));
 }
 if(!key)throw Error('JWT_KEY_MISSING');
 const publicKey=createPublicKey({key,format:'jwk'});
 const good=header.alg==='ES256'
  ?verify('sha256',Buffer.from(a+'.'+b),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(c,'base64url'))
  :verify('RSA-SHA256',Buffer.from(a+'.'+b),publicKey,Buffer.from(c,'base64url'));
 if(!good)throw Error('INVALID_SIGNATURE');
}
async function s3(method,key,bytes=Buffer.alloc(0)){
 const {AWS_ENDPOINT_URL_S3:ep,AWS_REGION:region,AWS_ACCESS_KEY_ID:access,AWS_SECRET_ACCESS_KEY:secret,AWS_SESSION_TOKEN:token}=process.env;
 if(!ep||!region||!access||!secret)throw Error('STORAGE_NOT_CONFIGURED');
 const url=new URL(ep);
 url.pathname=url.pathname.replace(/\/$/,'')+'/'+BUCKET+'/'+key.split('/').map(encodeURIComponent).join('/');
 const path=url.pathname, now=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=now.slice(0,8);
 const contentHash=sha(bytes);
 const headers={'host':url.host,'x-amz-content-sha256':contentHash,'x-amz-date':now};
 if(token)headers['x-amz-security-token']=token;
 const keys=Object.keys(headers).sort();
 const headerNames=keys.join(';');
 const canonHeaders=keys.map(k=>k+':'+headers[k]+'\n').join('');
 const canonical=[method,path,'',canonHeaders,headerNames,contentHash].join('\n');
 const scope=day+'/'+region+'/s3/aws4_request';
 const dateKey=mac(Buffer.from('AWS4'+secret),day);
 const regionKey=mac(dateKey,region),serviceKey=mac(regionKey,'s3'),signingKey=mac(serviceKey,'aws4_request');
 const signature=mac(signingKey,['AWS4-HMAC-SHA256',now,scope,sha(canonical)].join('\n')).toString('hex');
 const h={...headers,Authorization:'AWS4-HMAC-SHA256 Credential='+access+'/'+scope+', SignedHeaders='+headerNames+', Signature='+signature};
 if(method==='PUT')h['Content-Type']='image/png';
 return fetch(url,{method,headers:h,body:method==='PUT'?bytes:undefined,signal:AbortSignal.timeout(15000)});
}
export default {
 async fetch(request){
  if(request.headers.get('origin')!==ORIGIN)return reply({error:'ORIGIN_DENIED'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(request.method!=='POST')return reply({error:'METHOD_DENIED'},405);
  try{await authorize(request)}catch(e){return reply({error:'AUTH_DENIED',detail:String(e.message||e)},401)}
  const key='g3-physical-probe/'+randomUUID()+'.png';let uploaded=false;
  try{
   const put=await s3('PUT',key,IMAGE);
   if(!put.ok)throw Error('PUT_'+put.status+':'+(await put.text()).slice(0,180));
   uploaded=true;
   const head=await s3('HEAD',key);
   if(!head.ok)throw Error('HEAD_'+head.status);
   if(Number(head.headers.get('content-length'))!==IMAGE.length)throw Error('BAD_PHYSICAL_SIZE');
   const get=await s3('GET',key);
   if(!get.ok)throw Error('GET_'+get.status);
   const retrieved=Buffer.from(await get.arrayBuffer());
   if(!retrieved.equals(IMAGE))throw Error('BYTES_DIFFER');
   const del=await s3('DELETE',key);
   if(!del.ok)throw Error('DELETE_'+del.status);
   uploaded=false;
   const confirm=await s3('HEAD',key);
   if(confirm.status!==404)throw Error('DELETE_NOT_CONFIRMED_'+confirm.status);
   return reply({ok:true,bytes:IMAGE.length,sha256:sha(retrieved),checks:['PUT','HEAD_LENGTH','GET','BYTES_MATCH','DELETE','NOT_FOUND']});
  }catch(e){
   if(uploaded)try{await s3('DELETE',key)}catch{}
   return reply({ok:false,error:String(e.message||e).slice(0,250)},502);
  }
 }
};
