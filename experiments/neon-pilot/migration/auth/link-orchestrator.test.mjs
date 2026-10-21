import test from 'node:test';
import assert from 'node:assert/strict';
import {linkTwoProjects,createLinkHandler} from './link-orchestrator.mjs';
const record={neon_subject:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',legacy_user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',proof_kind:'dual_session'};
function repo({fail}={}) {
 const calls=[];
 const maybe=(name)=>async(project)=>{calls.push(name+':'+project);if(fail===name+':'+project)throw Error('TEST_FAILURE');};
 return {
 calls,withLock:async(_,fn)=>{calls.push('lock');return fn();},
 prepare:maybe('prepare'),activate:maybe('activate'),deactivate:maybe('deactivate')
 };
}
test('prepares both projects before either activation',async()=>{
 const r=repo();assert.deepEqual(await linkTwoProjects({record,repository:r}),{status:'linked'});
 assert.deepEqual(r.calls,['lock','prepare:a','prepare:b','activate:a','activate:b']);
});
test('preparation B failure prevents any activation',async()=>{
 const r=repo({fail:'prepare:b'});await assert.rejects(linkTwoProjects({record,repository:r}));
 assert.equal(r.calls.some(x=>x.startsWith('activate:')),false);
});
test('activation B failure compensates both branches',async()=>{
 const r=repo({fail:'activate:b'});await assert.rejects(linkTwoProjects({record,repository:r}),/ROLLED_BACK/);
 assert.deepEqual(r.calls.slice(-2),['deactivate:a','deactivate:b']);
});
test('compensation failure raises operator-reconciliation alert',async()=>{
 const r=repo({fail:'deactivate:a'});
 r.activate=async p=>{r.calls.push('activate:'+p);if(p==='b')throw Error('test');};
 await assert.rejects(linkTwoProjects({record,repository:r}),/ADMIN_RECONCILIATION/);
});
test('unverified record is rejected before any database access',async()=>{
 const r=repo();await assert.rejects(linkTwoProjects({record:{...record,proof_kind:'email_only'},repository:r}),/UNVERIFIED/);
 assert.deepEqual(r.calls,[]);
});
const url='https://auth.example.invalid/link';
function req({origin='https://paulosince.github.io',method='POST',central='abc.def.sig',legacy='old.def.sig'}={}){
 const headers={'origin':origin};
 if(central)headers.authorization='Bearer '+central;
 if(legacy)headers['x-legacy-access-token']=legacy;
 return new Request(url,{method,headers});
}
test('disabled service returns 503 without inspecting credentials',async()=>{
 let invoked=false;const f=createLinkHandler({prove:async()=>{invoked=true;},link:async()=>{},enabled:false});
 const response=await f(req());assert.equal(response.status,503);assert.equal(invoked,false);
});
test('foreign browser origin is denied including OPTIONS',async()=>{
 const f=createLinkHandler({prove:async()=>record,link:async()=>({status:'linked'}),enabled:true});
 const response=await f(req({origin:'https://evil.example'}));assert.equal(response.status,403);
 assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.equal((await f(req({method:'OPTIONS',origin:'https://evil.example'}))).status,403);
});
test('valid origin can preflight, never sends credentials in response',async()=>{
 const f=createLinkHandler({prove:async()=>record,link:async()=>({status:'linked'}),enabled:true});
 const pre=await f(req({method:'OPTIONS'}));assert.equal(pre.status,204);
 const response=await f(req());assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(await response.text(),'{"status":"linked"}');
});
test('unverified central and legacy credentials fail closed',async()=>{
 const f=createLinkHandler({prove:async()=>{throw Error('bad jwt');},link:async()=>({status:'linked'}),enabled:true});
 assert.equal((await f(req())).status,401);
 assert.equal((await f(req({central:''}))).status,401);
 assert.equal((await f(req({legacy:''}))).status,401);
});
test('link error is not disclosed',async()=>{
 const f=createLinkHandler({prove:async()=>record,link:async()=>{throw Error('secret database error');},enabled:true});
 const response=await f(req());assert.equal(response.status,401);
 assert.equal((await response.text()).includes('secret'),false);
});
