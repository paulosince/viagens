import test from 'node:test';
import assert from 'node:assert/strict';
import {createNeonIdentity} from './neon-identity.mjs';
const centralId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const oldId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token='eyJh.eyJi.c2ln';
function fixture({home='b',missing=false,profileError=false,invalidJwt=false}={}) {
 let active=true,events=[],lookups=0,authRead=0;
 const sdkAuth={
  async getSession(){authRead++;return {data:{session:active?{access_token:invalidJwt?'opaque':token,user:{id:centralId,email:'a@b.test',name:'Example'}}:null},error:null};},
  async signInWithPassword(){active=true;return {error:null};},
  async signOut(){active=false;return {error:null}}
 };
 const projects=['a','b'].map(id=>({id,client:{
  rpc:async()=>({data:{is_home:id===home},error:null}),
  from:()=>({select:()=>({limit:async()=>{lookups++;return profileError?{data:null,error:Error('permission denied')}:{data:missing?[]:[{user_id:oldId,name:'Example'}],error:null};}})})
 }}));
 return {identity:createNeonIdentity({sdkAuth,projects}),stats:()=>({events,lookups,authRead}),sdkAuth};
}
test('real Neon UUID is mapped from JWT RLS-authorized personal row to legacy UUID',async()=>{
 const x=fixture();const s=await x.identity.auth.getSession();
 assert.equal(s.error,null);assert.equal(s.data.user.id,oldId);
 assert.equal(s.data.user.neon_subject,centralId);
 assert.equal(s.data.session.user.id,oldId);
 assert.equal(x.stats().lookups,1);
 assert.equal(await x.identity.accessToken(),token);
});
test('an identical signed-in account uses one mapping cache',async()=>{
 const x=fixture();await x.identity.auth.getSession();await x.identity.auth.getSession();assert.equal(x.stats().lookups,1);
});
test('account missing a linked profile is refused, never falling back to email or Neon id',async()=>{
 const x=fixture({missing:true});const s=await x.identity.auth.getSession();
 assert.equal(s.data.user,null);assert.match(s.error.message,/Vínculo/);
});
test('invalid JWT fails closed before selecting a legacy identity',async()=>{
 const x=fixture({invalidJwt:true});const s=await x.identity.auth.getSession();
 assert.ok(s.error);assert.equal(x.stats().lookups,0);
});
test('ambiguous project owner is denied',async()=>{
 const x=fixture({home:null});const s=await x.identity.auth.getSession();
 assert.match(s.error.message,/Projeto pessoal/);
});
test('RLS errors are not silently ignored',async()=>{
 const x=fixture({profileError:true});const s=await x.identity.auth.getSession();
 assert.match(s.error.message,/permission denied/);
});
test('logout clears Neon session, and observers see a signed-out event',async()=>{
 const x=fixture();const events=[];
 x.identity.auth.onAuthStateChange((kind,session)=>events.push([kind,session]));
 await x.identity.auth.getSession();await x.identity.auth.signOut();
 assert.equal((await x.identity.auth.getSession()).data.user,null);
 assert.deepEqual(events,[['SIGNED_OUT',null]]);
});
test('login maps identity and notifies only with legacy UUID',async()=>{
 const x=fixture();const events=[];x.identity.auth.onAuthStateChange((kind,s)=>events.push([kind,s]));
 const reply=await x.identity.auth.signInWithPassword({email:'a@b.test',password:'not-persisted'});
 assert.equal(reply.data.user.id,oldId);
 assert.equal(events[0][1].user.id,oldId);
});
test('signup is blocked before Beta provisioning',async()=>{
 const x=fixture();const r=await x.identity.auth.signUp({email:'other@b.test'});
 assert.ok(r.error);assert.equal(r.data,null);
});
