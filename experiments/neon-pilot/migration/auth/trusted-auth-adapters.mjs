// Server-only verification adapters. Nothing in this file may run in the PWA.
function httpsEndpoint(value,suffix) {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('INVALID_AUTH_ENDPOINT');
 url.pathname=suffix;
 return url;
}
export function makeSupabaseSessionVerifier({url,publishableKey,fetcher=fetch}) {
 const endpoint=httpsEndpoint(url,'/auth/v1/user').href;
 if(!publishableKey||typeof fetcher!=='function')throw Error('LEGACY_AUTH_NOT_CONFIGURED');
 return async token=>{
   const response=await fetcher(endpoint,{
     method:'GET',redirect:'error',
     headers:{authorization:'Bearer '+token,apikey:publishableKey,accept:'application/json'}
   });
   if(!response.ok)throw Error('LEGACY_SESSION_INVALID');
   const user=await response.json();
   if(!user||!user.id||!user.email)throw Error('LEGACY_SESSION_INVALID');
   return user;
 };
}
export function makeNeonJwtVerifier({
 jwksUrl,issuer,createRemoteJWKSet,jwtVerify
}) {
 const uri=httpsEndpoint(jwksUrl,new URL(jwksUrl).pathname);
 if(typeof issuer!=='string'||!issuer||typeof createRemoteJWKSet!=='function'||typeof jwtVerify!=='function')
   throw Error('CENTRAL_JWT_NOT_CONFIGURED');
 const keys=createRemoteJWKSet(uri);
 return async token=>{
   const result=await jwtVerify(token,keys,{
      issuer,algorithms:['ES256','RS256','EdDSA']
   });
   if(!result||!result.payload||result.payload.role!=='authenticated')
     throw Error('CENTRAL_JWT_INVALID');
   return result.payload;
 };
}
export function makeCentralUserLookup({pool}) {
 if(!pool||typeof pool.query!=='function')throw Error('CENTRAL_DB_NOT_CONFIGURED');
 return async neonSubject=>{
   const result=await pool.query(
      'SELECT id, email, "emailVerified", banned FROM neon_auth.user WHERE id=$1::uuid LIMIT 1',
      [neonSubject]
   );
   return result.rows?.[0]||null;
 };
}
