// Viaggio Auth migration: join two independently authenticated sessions.
// This utility receives existing session getters from their SDKs; it never
// requests, caches, prints, or persists either account's credentials.
const ENDPOINT='https://br-square-river-b765bpl4-linkup.compute.c-13.us-east-1.aws.neon.tech/link';
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function fail(message){throw new Error(message);}
export async function linkVerifiedSessions({getLegacyToken,getNeonToken,fetcher=fetch,endpoint=ENDPOINT}={}){
  if(typeof getLegacyToken!=='function'||typeof getNeonToken!=='function'||typeof fetcher!=='function')
    fail('SESSIONS_NOT_READY');
  const parsed=new URL(endpoint);
  if(parsed.href!==ENDPOINT)fail('INVALID_LINK_ENDPOINT');
  const legacy=await getLegacyToken();
  const neon=await getNeonToken();
  if(typeof legacy!=='string'||!JWT.test(legacy)||typeof neon!=='string'||!JWT.test(neon))
    fail('SESSIONS_NOT_READY');
  const response=await fetcher(endpoint,{
    method:'POST',mode:'cors',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',
    headers:{
      authorization:'Bearer '+neon,
      'x-legacy-access-token':legacy
    }
  });
  if(response.status===503)fail('LINK_SERVICE_NOT_READY');
  if(response.status!==200)fail('LINK_NOT_CONFIRMED');
  const result=await response.json().catch(()=>null);
  if(result?.status!=='linked')fail('LINK_NOT_CONFIRMED');
  return Object.freeze({linked:true});
}
