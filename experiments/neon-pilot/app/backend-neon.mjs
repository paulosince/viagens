// Neon-only preview backend. No Supabase project or Supabase Auth calls.
// Transport: official @neondatabase/postgrest-js, JWTs: Managed Neon Auth.
// IMPORTANT: these are staging APIs. Never substitute project main URLs.
import {createNeonMediaClient} from './storage-neon.mjs?v=20261115-photos1';
import {createRouter} from './router-neon.mjs?v=20261024-home3';
import {createNeonIdentity} from './neon-identity.mjs';
export const API_ROOTS=Object.freeze({
  a:'https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1',
  b:'https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1'
});
const NEON_AUTH_UPSTREAM='https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth';
// On the custom domain, auth goes through the same-origin Cloudflare function
// (functions/api/auth) so the session cookie is first-party. GitHub Pages keeps
// calling Neon Auth directly.
export const NEON_AUTH_URL=(typeof location!=='undefined' && location.hostname==='ioviaggio.com.br')
  ? location.origin+'/api/auth'
  : NEON_AUTH_UPSTREAM;
// On the custom domain, Neon Function calls go through the same-origin
// Cloudflare function (functions/api/media), because the Neon Functions only
// accept the GitHub Pages origin. The user's JWT is still checked by Neon.
const viaSameOrigin=url=>{
 if(typeof location==='undefined'||location.hostname!=='ioviaggio.com.br')return url;
 const host=new URL(url).hostname;
 const suffix='.compute.c-14.us-east-1.aws.neon.tech';
 if(!host.endsWith(suffix))throw Error('Destino de mídia inesperado.');
 return location.origin+'/api/media/'+host.slice(0,-suffix.length)+'/';
};
const USAGE=Object.freeze({a:'https://br-silent-band-b80nklzl-appusage.compute.c-14.us-east-1.aws.neon.tech/',b:'https://br-falling-leaf-b8xuv1d0-appusage.compute.c-14.us-east-1.aws.neon.tech/'});
// Reads of every bucket (trip photos, profile photos, ticket attachments) go to
// the appmedia function on the same branch as the project's Data API. That
// branch's storage holds 100% of the files registered in its media manifest
// (verified 2026-11-15: A 84/84, B 5/5). The former main-branch endpoints were
// crossed between projects and held only 1 file each.
const MEDIA=Object.freeze({
 a:'https://br-silent-band-b80nklzl-appmedia.compute.c-14.us-east-1.aws.neon.tech/',
 b:'https://br-falling-leaf-b8xuv1d0-appmedia.compute.c-14.us-east-1.aws.neon.tech/'
});
const MEDIA_WRITE=Object.freeze({
 a:'https://br-silent-band-b80nklzl-appwrite.compute.c-14.us-east-1.aws.neon.tech/',
 b:'https://br-falling-leaf-b8xuv1d0-appmedia.compute.c-14.us-east-1.aws.neon.tech/'
});
// The Neon Functions have rejected missing and forged JWTs (401/403).
// Enable READ ONLY pending a positive real-user JWT authorization test.
// Never enable mutations until their separate positive and negative tests pass.

export function adminPhotoSources(accounts,snapshots){
 const ids=new Set(accounts.users.map(u=>String(u.id))),sources=new Map();
 for(const [index,snapshot] of snapshots.entries()){
  for(const photo of snapshot.profile_photos||[]){
   const id=String(photo.id),path=photo.path;
   if(!ids.has(id)||typeof path!=='string'||!path||path.length>900||path.split('/').some(x=>!x||x==='.'||x==='..')||/[\\?#\x00-\x1f\x7f]/.test(path))continue;
   const list=sources.get(id)||[];list.push({index,path,isHome:photo.is_home===true});sources.set(id,list);
  }
 }
 for(const list of sources.values())list.sort((a,b)=>Number(b.isHome)-Number(a.isHome));
 return sources;
}

export function createNeonPreview({authSdk,NeonPostgrestClient,fetchWithToken,enableMediaWrites=false}){
 if(!authSdk?.auth||!NeonPostgrestClient||!fetchWithToken)throw Error('Neon SDK não inicializado.');
 // Token-provider calls the official Neon Auth adapter, which manages
 // refresh and session persistence. No legacy Supabase session fallback.
 const rawAuth=authSdk.auth;
 const getToken=async()=>{
  const result=await rawAuth.getSession();
  if(result.error)throw result.error;
  if(!result.data?.session)return null;
  const bearer=result.data.session.access_token;
  if(typeof bearer!=='string'||bearer.split('.').length!==3)
    throw Error('JWT central indisponível.');
  return bearer;
 };
 const projects=Object.entries(API_ROOTS).map(([id,url])=>{
   const pg=new NeonPostgrestClient({
      dataApiUrl:url,
      options:{global:{fetch:fetchWithToken(getToken)}}
   });
   return {id,media:viaSameOrigin(MEDIA[id]),attachmentMedia:viaSameOrigin(MEDIA[id]),mediaWrite:viaSameOrigin(MEDIA_WRITE[id]),client:pg.schema('viaggio_app')};
 });
 const facade=createNeonIdentity({sdkAuth:rawAuth,projects});
 // Keep the existing preview's generic RPC router, but never silently send
 // old Supabase Edge Functions (Unsplash, deletion etc.) to Supabase.
 const functions={async invoke(){return {data:null,error:new Error('Serviço ainda não disponível na prévia Neon.')};}};
 const storage=createNeonMediaClient({projects,accessToken:getToken,allowMutations:enableMediaWrites===true});
 const readUsage=async project=>{
   const jwt=await getToken();
   if(!jwt)throw Error('Sessão indisponível para medir armazenamento.');
   const response=await fetch(viaSameOrigin(USAGE[project.id]),{headers:{authorization:'Bearer '+jwt},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Não foi possível medir o armazenamento ('+response.status+').');
   const body=await response.json();
   if(!Array.isArray(body.data)||body.data.length!==1||body.data[0]?.measurement_version!==2)
     throw Error('Medição incompleta.');
   return {data:body.data,error:null};
 };
 const router=createRouter({projects,auth:facade.auth,functions,storage,readUsage});
 const centralAdmin=new NeonPostgrestClient({dataApiUrl:'https://ep-small-bread-b7uq0zva.apirest.c-13.us-east-1.aws.neon.tech/viaggio_auth/rest/v1',options:{global:{fetch:fetchWithToken(getToken)}}}).schema('viaggio_admin');
 const checked=async request=>{const r=await request;if(r.error)throw r.error;return r.data;};
 const admin={
   async allowed(){return (await checked(centralAdmin.rpc('admin_access_allowed')))===true;},
   async recordAccess(){await checked(centralAdmin.rpc('record_access'));},
   async overview(){
     // Fail closed: all three server-authorized sources must return successfully.
     const [accounts,...snapshots]=await Promise.all([checked(centralAdmin.rpc('admin_accounts')),...projects.map(p=>checked(p.client.rpc('viaggio_admin_snapshot')))]);
     if(!accounts||!Array.isArray(accounts.users)||snapshots.some(s=>!s||!Array.isArray(s.identities)||!Array.isArray(s.trips)||!Array.isArray(s.memberships)))throw Error('Resposta administrativa incompleta.');
     // Fetch the private bytes through the existing JWT-verified media gateway.
     // Never create public URLs, cache the pictures, or grant access to other buckets.
     const photoBlobs=new Map(), sources=adminPhotoSources(accounts,snapshots);
     const queue=[...sources.entries()];
     const jwt=queue.length?await getToken():null;
     if(jwt)await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{
       while(queue.length){
         const [id,candidates]=queue.shift();
         for(const candidate of candidates){
           try{
             const endpoint=projects[candidate.index]?.media;if(!endpoint)continue;
             const url=new URL('download',endpoint);
             url.searchParams.set('bucket','profile-photos');url.searchParams.set('path',candidate.path);
             const r=await fetch(url.href,{headers:{authorization:'Bearer '+jwt},cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
             if(!r.ok)continue;
             const blob=await r.blob();
             if(blob.size>0&&blob.size<=25000000&&/^image\/(jpeg|png|webp|gif|avif)$/i.test(blob.type)){photoBlobs.set(id,blob);break;}
           }catch{/* An unavailable avatar must not hide the dashboard. */}
         }
       }
     }));
     return {accounts,snapshots,photoBlobs};
   }
 };
 // No user data operation succeeds unless Neon JWT is presented.
 return {...router,admin,accessToken:facade.accessToken,provider:'neon-auth-central'};
}
