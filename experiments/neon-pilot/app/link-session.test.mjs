import test from 'node:test';
import assert from 'node:assert/strict';
import {linkVerifiedSessions} from './link-session.mjs';
const jwt='aaa.bbb.ccc';
test('links only through fixed private bridge and sends no JSON body',async()=>{
 let captured;
 const outcome=await linkVerifiedSessions({
   getLegacyToken:async()=>jwt,getNeonToken:async()=>jwt,
   fetcher:async(...args)=>{captured=args;return {status:200,json:async()=>({status:'linked'})};}
 });
 assert.deepEqual(outcome,{linked:true});
 assert.equal(captured[1].body,undefined);
 assert.equal(captured[1].redirect,'error');
 assert.equal(captured[1].headers.authorization,'Bearer '+jwt);
 assert.equal(captured[1].headers['x-legacy-access-token'],jwt);
});
test('anonymous and missing session credentials never call service',async()=>{
 let count=0;
 const f=async()=>{count++;};
 await assert.rejects(linkVerifiedSessions({getLegacyToken:async()=>null,getNeonToken:async()=>jwt,fetcher:f}),/SESSIONS_NOT_READY/);
 await assert.rejects(linkVerifiedSessions({getLegacyToken:async()=>jwt,getNeonToken:async()=>null,fetcher:f}),/SESSIONS_NOT_READY/);
 assert.equal(count,0);
});
test('invalid redirect endpoint refused',async()=>{
 await assert.rejects(linkVerifiedSessions({getLegacyToken:async()=>jwt,getNeonToken:async()=>jwt,endpoint:'https://bad.invalid/link'}),/INVALID_LINK_ENDPOINT/);
});
test('disabled service remains unlinked',async()=>{
 await assert.rejects(linkVerifiedSessions({
  getLegacyToken:async()=>jwt,getNeonToken:async()=>jwt,
  fetcher:async()=>({status:503,json:async()=>({error:'MIGRATION_NOT_ENABLED'})})
 }),/LINK_SERVICE_NOT_READY/);
});
test('server errors are not confused with linked accounts',async()=>{
 await assert.rejects(linkVerifiedSessions({
  getLegacyToken:async()=>jwt,getNeonToken:async()=>jwt,
  fetcher:async()=>({status:200,json:async()=>({status:'pending'})})
 }),/LINK_NOT_CONFIRMED/);
});
