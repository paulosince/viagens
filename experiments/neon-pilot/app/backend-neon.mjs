// Neon-only preview backend. No Supabase project or Supabase Auth calls.
// Transport: official @neondatabase/postgrest-js, JWTs: Managed Neon Auth.
// IMPORTANT: these are staging APIs. Never substitute project main URLs.
import {createMediaClient} from './storage.mjs';
import {createRouter} from './router.mjs';
import {createNeonIdentity} from './neon-identity.mjs';
export const API_ROOTS=Object.freeze({
  a:'https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1',
  b:'https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1'
});
export const NEON_AUTH_URL='https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth';
const MEDIA=Object.freeze({
 a:'https://br-dawn-bread-b83r0ztn-appmedia.compute.c-14.us-east-1.aws.neon.tech/',
 b:'https://br-proud-paper-b83l1z7d-appmedia.compute.c-14.us-east-1.aws.neon.tech/'
});
// Media Functions have not yet been confirmed with Neon Auth JWT in the new
// preview. Media mutating operations MUST remain blocked until Step 7/14.
const mediaBlocked={
 from(){return {
  async download(){return {data:null,error:Error('Mídia aguardando validação com Neon Auth.')};},
  async createSignedUrl(){return {data:null,error:Error('Mídia aguardando validação com Neon Auth.')};},
  async upload(){return {data:null,error:Error('Upload de mídia bloqueado até validação.')};},
  async remove(){return {data:null,error:Error('Exclusão de mídia bloqueada até validação.')};}
 }}
};
export function createNeonPreview({authSdk,NeonPostgrestClient,fetchWithToken}){
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
   return {id,media:MEDIA[id],client:pg.schema('viaggio_app')};
 });
 const facade=createNeonIdentity({sdkAuth:rawAuth,projects});
 // Keep the existing preview's generic RPC router, but never silently send
 // old Supabase Edge Functions (Unsplash, deletion etc.) to Supabase.
 const functions={async invoke(){return {data:null,error:new Error('Serviço ainda não disponível na prévia Neon.')};}};
 const router=createRouter({projects,auth:facade.auth,functions,storage:mediaBlocked});
 // No user data operation succeeds unless Neon JWT is presented.
 return {...router,accessToken:facade.accessToken,provider:'neon-auth-central'};
}
