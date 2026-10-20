import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareIdentityProof} from './identity-proof-core.mjs';
const OLD='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEW='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LEGACY={id:OLD,email:'User@Example.invalid',email_confirmed_at:'2026-01-01T12:00:00Z',deleted_at:null};
const CLAIMS={sub:NEW,role:'authenticated'};
const CENTRAL={id:NEW,email:'user@example.invalid',emailVerified:true,banned:false};
const token='aaaa.bbbb.cccc';
function proof({legacy=LEGACY,claims=CLAIMS,account=CENTRAL,legacyToken=token,centralToken=token,
  verifyLegacy=async()=>legacy,verifyCentralJWT=async()=>claims,
  loadCentralAccount=async()=>account}={}) {
 return prepareIdentityProof({legacyToken,centralToken,verifyLegacy,verifyCentralJWT,loadCentralAccount});
}
test('verified dual-session proof produces no token in link record',async()=>{
 const result=await proof();
 assert.deepEqual(result,{neon_subject:NEW,legacy_user_id:OLD,proof_kind:'dual_session'});
 assert.equal(JSON.stringify(result).includes(token),false);
 assert.equal(Object.isFrozen(result),true);
});
test('legacy email must be verified',async()=>{
 await assert.rejects(proof({legacy:{...LEGACY,email_confirmed_at:null}}),/unverified/);
});
test('central email must be verified',async()=>{
 await assert.rejects(proof({account:{...CENTRAL,emailVerified:false}}),/unverified/);
});
test('email mismatch rejected even with verified users',async()=>{
 await assert.rejects(proof({account:{...CENTRAL,email:'different@example.invalid'}}),/mismatch/);
});
test('JWT subject must match trusted central user row',async()=>{
 await assert.rejects(proof({account:{...CENTRAL,id:OLD}}),/unverified/);
});
test('unauthorized JWT role denied',async()=>{
 await assert.rejects(proof({claims:{...CLAIMS,role:'anonymous'}}),/role/);
});
test('deleted or banned account denied',async()=>{
 await assert.rejects(proof({legacy:{...LEGACY,deleted_at:'2026-01-01T00:00:00Z'}}),/deleted/);
 await assert.rejects(proof({account:{...CENTRAL,banned:true}}),/unverified/);
});
test('invalid bearer or missing verification adapter denied',async()=>{
 await assert.rejects(proof({legacyToken:'Bearer '+token}),/token/);
 await assert.rejects(proof({centralToken:''}),/token/);
 await assert.rejects(prepareIdentityProof({legacyToken:token,centralToken:token}),/verifier missing/);
});
test('failed legacy session lookup denies proof',async()=>{
 await assert.rejects(proof({verifyLegacy:async()=>{throw Error('Supabase 401');}}),/Supabase 401/);
});
test('failed central signature verification denies proof',async()=>{
 await assert.rejects(proof({verifyCentralJWT:async()=>{throw Error('JWKS invalid');}}),/JWKS invalid/);
});
