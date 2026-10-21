// Central Neon Function for the Supabase -> Neon account upgrade.
// Server-only; no credentials or tokens may be logged. Routes staging projects only.
// Before activating set all *staging* connection strings and VIAGGIO_LINK_ENABLED=true.
import pg from 'pg';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {prepareIdentityProof} from '../identity-proof-core.mjs';
import {makeSupabaseSessionVerifier,makeCentralUserLookup} from '../trusted-auth-adapters.mjs';
import {createLinkRepository} from '../link-store.mjs';
import {linkTwoProjects,createLinkHandler} from '../link-orchestrator.mjs';

const required=['DATABASE_URL','VIAGGIO_A_STAGING_DATABASE_URL',
 'VIAGGIO_B_STAGING_DATABASE_URL','VIAGGIO_SUPABASE_URL','VIAGGIO_SUPABASE_PUBLISHABLE_KEY',
 'VIAGGIO_CENTRAL_JWKS_URL','VIAGGIO_CENTRAL_ISSUER'];
const configured=required.every(k=>Boolean(process.env[k]));
const enabled=configured&&process.env.VIAGGIO_LINK_ENABLED==='true';
let handler;
if (configured) {
  const centralURL=new URL(process.env.DATABASE_URL);
  const aURL=new URL(process.env.VIAGGIO_A_STAGING_DATABASE_URL);
  const bURL=new URL(process.env.VIAGGIO_B_STAGING_DATABASE_URL);
  // Mandatory operational guard: NEVER write identity links to parent branches
  // while this service is in validation. Prevent accidental main DB secrets.
  const exactHost=(url,ep,region,db)=>{
    const allowed=[ep+'.'+region,ep+'-pooler.'+region];
    return ['postgres:','postgresql:'].includes(url.protocol)
      && allowed.includes(url.hostname)
      && (!db || url.pathname==='/'+db);
  };
  if (!exactHost(centralURL,'ep-small-bread-b7uq0zva','c-13.us-east-1.aws.neon.tech',null)
      || !exactHost(aURL,'ep-empty-pine-b8r7sa8d','c-14.us-east-1.aws.neon.tech','viaggio_lab')
      || !exactHost(bURL,'ep-spring-moon-b8fi6yxc','c-14.us-east-1.aws.neon.tech','viaggio_lab'))
    throw Error('STAGING_PROJECT_BOUNDARY_REQUIRED');
  centralURL.pathname='/viaggio_auth';
  const central=new pg.Pool({connectionString:centralURL.href,max:2,connectionTimeoutMillis:8000,
    idleTimeoutMillis:15000});
  const a=new pg.Pool({connectionString:process.env.VIAGGIO_A_STAGING_DATABASE_URL,
    max:2,connectionTimeoutMillis:8000,idleTimeoutMillis:15000});
  const b=new pg.Pool({connectionString:process.env.VIAGGIO_B_STAGING_DATABASE_URL,
    max:2,connectionTimeoutMillis:8000,idleTimeoutMillis:15000});
  const verifyLegacy=makeSupabaseSessionVerifier({
    url:process.env.VIAGGIO_SUPABASE_URL,
    publishableKey:process.env.VIAGGIO_SUPABASE_PUBLISHABLE_KEY
  });
  const JWKS=createRemoteJWKSet(new URL(process.env.VIAGGIO_CENTRAL_JWKS_URL));
  const expectedIssuer=process.env.VIAGGIO_CENTRAL_ISSUER;
  if (new URL(process.env.VIAGGIO_CENTRAL_JWKS_URL).origin!==expectedIssuer)
    throw Error('INVALID_NEON_AUTH_ISSUER');
  const verifyCentralJWT=async token=>{
    const {payload}=await jwtVerify(token,JWKS,{
      issuer:expectedIssuer,audience:expectedIssuer,algorithms:['EdDSA']
    });
    return payload;
  };
  const loadCentralAccount=makeCentralUserLookup({pool:central});
  const repository=createLinkRepository({central,a,b});
  handler=createLinkHandler({
    enabled,
    prove:({legacyToken,centralToken})=>prepareIdentityProof({
      legacyToken,centralToken,verifyLegacy,verifyCentralJWT,loadCentralAccount
    }),
    link:record=>linkTwoProjects({record,repository})
  });
} else {
  // Fail closed: a deployed incomplete function never grants access.
  handler=createLinkHandler({
    enabled:false,prove:async()=>{throw Error('NOT_CONFIGURED');},
    link:async()=>{throw Error('NOT_CONFIGURED');}
  });
}
export default {fetch:handler};
