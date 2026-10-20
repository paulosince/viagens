// Viaggio secure identity-proof core. Server-only. No database writes.
const UUID_RX=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT_RX=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const fail=(why)=>{throw Object.assign(new Error('IDENTITY_PROOF_DENIED: '+why),{code:'IDENTITY_PROOF_DENIED'});};
function emailOf(value) {
 if (typeof value!=='string') fail('email');
 const email=value.trim().toLowerCase();
 if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('email');
 return email;
}
function uuidOf(value) {
 if (typeof value!=='string'||!UUID_RX.test(value)) fail('subject');
 return value.toLowerCase();
}
function bearerOf(value) {
 if(typeof value!=='string'||!JWT_RX.test(value))fail('token');
 return value;
}
/**
 * All 3 injected methods MUST execute on a trusted backend:
 * - verifyLegacy: call Supabase Auth getUser with the legacy bearer token over TLS.
 * - verifyCentralJWT: validate signature against the central JWKS, issuer,
 *   expiry, intended audience if configured, and reject other issuers.
 * - loadCentralAccount: read neon_auth.user directly via trusted database
 *   credentials, keyed exclusively by the verified JWT subject.
 * Never replace these functions with browser-provided objects.
 */
export async function prepareIdentityProof({
 legacyToken,centralToken,verifyLegacy,verifyCentralJWT,loadCentralAccount
}={}) {
 if([verifyLegacy,verifyCentralJWT,loadCentralAccount].some(f=>typeof f!=='function'))fail('verifier missing');
 const legacyJWT=bearerOf(legacyToken);
 const newJWT=bearerOf(centralToken);
 const [legacy,claims]=await Promise.all([verifyLegacy(legacyJWT),verifyCentralJWT(newJWT)]);
 const legacyId=uuidOf(legacy?.id);
 const neonId=uuidOf(claims?.sub);
 if(claims?.role!=='authenticated')fail('central role');
 if(legacy?.deleted_at)fail('legacy account deleted');
 if(!legacy?.email_confirmed_at || !Number.isFinite(Date.parse(legacy.email_confirmed_at)))
   fail('legacy email unverified');
 const central=await loadCentralAccount(neonId);
 if(!central || uuidOf(central.id)!==neonId || central.emailVerified!==true
    || central.banned===true)fail('central account unverified');
 if(emailOf(legacy.email)!==emailOf(central.email))fail('account email mismatch');
 return Object.freeze({
   neon_subject:neonId,legacy_user_id:legacyId,proof_kind:'dual_session'
 });
}
