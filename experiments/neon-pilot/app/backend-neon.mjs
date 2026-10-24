// Neon-only preview backend. No Supabase project or Supabase Auth calls.
// Transport: official @neondatabase/postgrest-js, JWTs: Managed Neon Auth.
// IMPORTANT: these are staging APIs. Never substitute project main URLs.
import {createNeonMediaClient} from './storage-neon.mjs';
import {createRouter} from './router-neon.mjs?v=20261024-home3';
import {createNeonIdentity} from './neon-identity.mjs';
export const API_ROOTS=Object.freeze({
  a:'https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1',
  b:'https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1'
});
export const NEON_AUTH_URL='https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth';
const USAGE=Object.freeze({a:'https://br-silent-band-b80nklzl-appusage.compute.c-14.us-east-1.aws.neon.tech/',b:'https://br-falling-leaf-b8xuv1d0-appusage.compute.c-14.us-east-1.aws.neon.tech/'});
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
   return {id,media:MEDIA[id],mediaWrite:MEDIA_WRITE[id],client:pg.schema('viaggio_app')};
 });
 const facade=createNeonIdentity({sdkAuth:rawAuth,projects});
 // Keep the existing preview's generic RPC router, but never silently send
 // old Supabase Edge Functions (Unsplash, deletion etc.) to Supabase.
 const functions={async invoke(){return {data:null,error:new Error('Serviço ainda não disponível na prévia Neon.')};}};
 const storage=createNeonMediaClient({projects,accessToken:getToken,allowMutations:enableMediaWrites===true});
 const readUsage=async project=>{
   const jwt=await getToken();
   if(!jwt)throw Error('Sessão indisponível para medir armazenamento.');
   const response=await fetch(USAGE[project.id],{headers:{authorization:'Bearer '+jwt},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Não foi possível medir o armazenamento ('+response.status+').');
   const body=await response.json();
   if(!Array.isArray(body.data)||body.data.length!==1||body.data[0]?.measurement_version!==2)
     throw Error('Medição incompleta.');
   return {data:body.data,error:null};
 };
 const router=createRouter({projects,auth:facade.auth,functions,storage,readUsage});
 // No user data operation succeeds unless Neon JWT is presented.
 return {...router,accessToken:facade.accessToken,provider:'neon-auth-central'};
}
