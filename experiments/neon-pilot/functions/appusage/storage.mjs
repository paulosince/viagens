import {createHash,createHmac} from 'node:crypto';
const encode=x=>encodeURIComponent(x).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const hmac=(k,v)=>createHmac('sha256',k).update(v).digest();
// Dedicated read-only signer: no caller-selected bucket, key or host.
export function signedListUrl(token='',env=process.env,now=new Date()) {
 const {AWS_ENDPOINT_URL_S3:endpoint,AWS_ACCESS_KEY_ID:access,AWS_SECRET_ACCESS_KEY:secret,AWS_REGION:region}=env;
 if(!endpoint||!access||!secret||!region)throw Error('STORAGE_NOT_CONFIGURED');
 const base=new URL(endpoint);if(base.protocol!=='https:')throw Error('INVALID_STORAGE_HOST');
 const time=now.toISOString().replace(/[-:]|\.\d{3}/g,'');const day=time.slice(0,8);
 const scope=`${day}/${region}/s3/aws4_request`;
 const params={'list-type':'2','max-keys':'1000','X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':`${access}/${scope}`,'X-Amz-Date':time,'X-Amz-Expires':'60','X-Amz-SignedHeaders':'host'};
 if(token)params['continuation-token']=token;
 if(env.AWS_SESSION_TOKEN)params['X-Amz-Security-Token']=env.AWS_SESSION_TOKEN;
 const query=Object.entries(params).map(([k,v])=>[encode(k),encode(v)]).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('&');
 const path='/viaggio-lab-media/';
 const canonical=['GET',path,query,`host:${base.host}\n`,'host','UNSIGNED-PAYLOAD'].join('\n');
 const digest=createHash('sha256').update(canonical).digest('hex');
 const key=hmac(hmac(hmac(hmac('AWS4'+secret,day),region),'s3'),'aws4_request');
 const signature=createHmac('sha256',key).update(['AWS4-HMAC-SHA256',time,scope,digest].join('\n')).digest('hex');
 return `${base.origin}${path}?${query}&X-Amz-Signature=${signature}`;
}
const xmlText=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
export function parseList(xml) {
 if(!/<ListBucketResult\b/.test(xml)||!/<IsTruncated>(true|false)<\/IsTruncated>/.test(xml))throw Error('INVALID_STORAGE_LIST');
 const blocks=[...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)];
 let bytes=0;
 for(const [,block] of blocks){const raw=block.match(/<Size>(\d+)<\/Size>/)?.[1];if(raw===undefined)throw Error('INVALID_STORAGE_SIZE');const n=Number(raw);if(!Number.isSafeInteger(n)||!Number.isSafeInteger(bytes+n))throw Error('INVALID_STORAGE_SIZE');bytes+=n;}
 const truncated=xml.includes('<IsTruncated>true</IsTruncated>');
 const next=xmlText(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1]||'');
 if(truncated&&!next)throw Error('INCOMPLETE_STORAGE_LIST');
 return {bytes,count:blocks.length,next:truncated?next:''};
}
export async function measureStorage({fetcher=fetch,sign=signedListUrl}={}) {
 let bytes=0,count=0,token='';const seen=new Set();
 for(let page=0;page<1000;page++){
  const r=await fetcher(sign(token),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('STORAGE_MEASUREMENT_FAILED');
  const data=parseList(await r.text());bytes+=data.bytes;count+=data.count;
  if(!data.next)return {storage_bytes:bytes,object_count:count};
  if(seen.has(data.next))throw Error('REPEATED_STORAGE_PAGE');seen.add(data.next);token=data.next;
 }
 throw Error('STORAGE_LIST_LIMIT');
}
