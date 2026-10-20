import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSupabaseSessionVerifier,makeNeonJwtVerifier,makeCentralUserLookup} from './trusted-auth-adapters.mjs';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('legacy identity comes from live Supabase Auth endpoint, never request body',async()=>{
 let sent;
 const verify=makeSupabaseSessionVerifier({
   url:'https://test.supabase.co',publishableKey:'public',fetcher:async(url,opt)=>{
     sent={url,opt};return {ok:true,json:async()=>({id,email:'user@example.invalid',email_confirmed_at:'2026-01-01'})};
   }
 });
 assert.equal((await verify('abc.def.ghi')).id,id);
 assert.equal(sent.url,'https://test.supabase.co/auth/v1/user');
 assert.equal(sent.opt.headers.authorization,'Bearer abc.def.ghi');
 assert.equal(sent.opt.redirect,'error');
});
test('Supabase 401 refuses proof',async()=>{
 const verify=makeSupabaseSessionVerifier({
   url:'https://test.supabase.co',publishableKey:'public',
   fetcher:async()=>({ok:false,status:401})
 });
 await assert.rejects(verify('abc.def.ghi'),/LEGACY_SESSION_INVALID/);
});
test('reject insecure or malformed endpoints',()=>{
 assert.throws(()=>makeSupabaseSessionVerifier({url:'http://local.test',publishableKey:'public'}),/INVALID_AUTH_ENDPOINT/);
 assert.throws(()=>makeSupabaseSessionVerifier({url:'https://user:pass@test.supabase.co',publishableKey:'public'}),/INVALID_AUTH_ENDPOINT/);
});
test('Neon signature/issuer verification uses pinned JWKS and algorithms',async()=>{
 let call;
 const verify=makeNeonJwtVerifier({
   jwksUrl:'https://auth.neon.tech/db/auth/.well-known/jwks.json',
   issuer:'expected-issuer',
   createRemoteJWKSet:uri=>uri,
   jwtVerify:async(token,uri,options)=>{
     call={token,uri,options};
     return {payload:{sub:id,role:'authenticated'}};
   }
 });
 assert.equal((await verify('abc.def.ghi')).sub,id);
 assert.equal(call.uri.pathname,'/db/auth/.well-known/jwks.json');
 assert.equal(call.options.issuer,'expected-issuer');
 assert.equal(call.options.algorithms.includes('none'),false);
});
test('Neon guest role is rejected even after signature verification',async()=>{
 const verify=makeNeonJwtVerifier({
   jwksUrl:'https://auth.neon.tech/auth/jwks.json',
   issuer:'issuer',
   createRemoteJWKSet:uri=>uri,
   jwtVerify:async()=>({payload:{sub:id,role:'anonymous'}})
 });
 await assert.rejects(verify('abc.def.ghi'),/CENTRAL_JWT_INVALID/);
});
test('central account lookup queries bound UUID, never raw SQL concatenation',async()=>{
 let query,args;
 const verify=makeCentralUserLookup({pool:{query:async(q,a)=>{query=q;args=a;return {rows:[{id,emailVerified:true}]};}}});
 const result=await verify(id);
 assert.equal(result.emailVerified,true);
 assert.deepEqual(args,[id]);
 assert.match(query,/\$1::uuid/);
 assert.equal(query.includes(id),false);
});
test('missing Neon directory row remains unmapped',async()=>{
 const verify=makeCentralUserLookup({pool:{query:async()=>({rows:[]})}});
 assert.equal(await verify(id),null);
});
