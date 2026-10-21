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

test('signing in with another Neon user never reuses the prior legacy UUID',async()=>{
 const alice='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',bob='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 let current=alice;let count=0;
 const sdkAuth={
   getSession:async()=>({data:{session:{access_token:token,user:{id:current,email:current===alice?'a@b.test':'c@d.test'}}},error:null}),
   signInWithPassword:async()=>{current=bob;return {error:null}},
   signOut:async()=>({error:null})
 };
 const projects=['a','b'].map(id=>({id,client:{
    rpc:async()=>({data:{is_home:id==='b'},error:null}),
    from:()=>({select:()=>({limit:async()=>({data:[{user_id:current===alice?oldId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'User'}],error:null})})})
 }}));
 const identity=createNeonIdentity({sdkAuth,projects});
 assert.equal((await identity.auth.getSession()).data.user.id,oldId);
 const switched=await identity.auth.signInWithPassword({email:'c@d.test',password:'new'});
 assert.equal(switched.data.user.id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
 assert.notEqual(switched.data.user.id,oldId);
});
test('cross-tab sign-out clears mapped identity and notifies UI',async()=>{
 let callback;
 const base=fixture();
 const sdkAuth={
  getSession:async()=>({data:{session:{access_token:token,user:{id:centralId,email:'a@b.test'}}},error:null}),
  signInWithPassword:async()=>({error:null}),
  signOut:async()=>({error:null}),
  onAuthStateChange(fn){callback=fn;return {data:{subscription:{unsubscribe(){}}}}}
 };
 const projects=['a','b'].map(id=>({id,client:{
  rpc:async()=>({data:{is_home:id==='b'},error:null}),
  from:()=>({select:()=>({limit:async()=>({data:[{user_id:oldId}],error:null})})})
 }}));
 const identity=createNeonIdentity({sdkAuth,projects});
 const events=[];identity.auth.onAuthStateChange((kind,session)=>events.push(kind));
 await identity.auth.getSession();callback('SIGNED_OUT',null);
 assert.deepEqual(events,['SIGNED_OUT']);
});
test('token refresh events never leak Neon subject as application identity',async()=>{
 let callback;
 const sdkAuth={
  getSession:async()=>({data:{session:{access_token:token,user:{id:centralId,email:'a@b.test'}}},error:null}),
  signInWithPassword:async()=>({error:null}),signOut:async()=>({error:null}),
  onAuthStateChange(fn){callback=fn;return {data:{subscription:{unsubscribe(){}}}}}
 };
 const projects=['a','b'].map(id=>({id,client:{
  rpc:async()=>({data:{is_home:id==='b'},error:null}),
  from:()=>({select:()=>({limit:async()=>({data:[{user_id:oldId}],error:null})})})
 }}));
 const identity=createNeonIdentity({sdkAuth,projects});
 const events=[];identity.auth.onAuthStateChange((event,session)=>events.push({event,id:session?.user?.id}));
 callback('TOKEN_REFRESHED',{user:{id:centralId}});
 for(let i=0;i<15 && !events.length;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(events,[{event:'TOKEN_REFRESHED',id:oldId}]);
});
