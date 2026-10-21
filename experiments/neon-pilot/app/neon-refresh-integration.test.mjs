// Integration test for Stage 05/14. No real credentials or URLs are contacted.
// Exercises the ACTUAL @neondatabase/postgrest-js fetchWithToken transport,
// the production Neon preview backend and a time-controlled Auth adapter.
// The source SDK's native auto-refresh is a separately documented contract;
// this suite verifies the Viaggio integration consumes its refreshed JWT.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NeonPostgrestClient,fetchWithToken} from '@neondatabase/postgrest-js';
import {createNeonPreview,API_ROOTS} from './backend-neon.mjs';

const SUBJECT='11111111-1111-4111-8111-111111111111';
const LEGACY='22222222-2222-4222-8222-222222222222';
const TOKEN_A='eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJhdXRoMSJ9.c2lnMA';
const TOKEN_B='eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJhdXRoMiJ9.c2lnMQ';
function newFixture() {
  let currentToken=TOKEN_A,expired=false,signedIn=true,refreshes=0,sessionReads=0,denyRefresh=false,subject=SUBJECT;
  const subscribers=[];
  const headers=[];
  const sdkAuth={
    async getSession() {
      sessionReads++;
      if(!signedIn)return {data:{session:null},error:null};
      if(expired) {
        if(denyRefresh)return {data:{session:null},error:Error('TOKEN_REFRESH_FAILED')};
        refreshes++;currentToken=TOKEN_B;expired=false;
        for(const cb of subscribers)cb('TOKEN_REFRESHED',null);
      }
      return {data:{session:{access_token:currentToken,user:{id:subject,email:'test@example.invalid'}}},error:null};
    },
    async signInWithPassword(){signedIn=true;return {data:{},error:null}},
    async signOut(){signedIn=false;for(const cb of subscribers)cb('SIGNED_OUT',null);return {error:null}},
    onAuthStateChange(fn){subscribers.push(fn);return {data:{subscription:{unsubscribe(){}}}}}
  };
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(request,options)=>{
    const url=typeof request==='string'?request:request?.url;
    if(typeof url!=='string'||(!url.startsWith(API_ROOTS.a)&&!url.startsWith(API_ROOTS.b)))
      throw Error('DISALLOWED_NETWORK_URL');
    const auth=options?.headers?.Authorization||options?.headers?.authorization||
      options?.headers?.get?.('authorization')||
      (request?.headers?.get?.('authorization'))||'';
    headers.push({url,auth});
    if(!auth||auth==='Bearer undefined'||auth==='Bearer null')
      return new Response(JSON.stringify({message:'JWT missing'}),{status:401,headers:{'content-type':'application/json'}});
    const isA=url.startsWith(API_ROOTS.a);
    const data=url.includes('/rpc/project_context')?{is_home:!isA}
      :url.includes('/passenger_profiles')?(!isA?[{user_id:LEGACY,name:'Legacy user'}]:[])
      :url.includes('/trips')?(isA?[{id:'shared-trip'}]:[])
      :[];
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  };
  const app=createNeonPreview({authSdk:{auth:sdkAuth},NeonPostgrestClient,fetchWithToken});
  return {
    app, headers,sdkAuth,
    expire(){expired=true},
    failNextRefresh(){expired=true;denyRefresh=true},
    stats(){return {sessionReads,refreshes,currentToken,signedIn}},
    restore(){globalThis.fetch=originalFetch},
    switchUser(id){subject=id}
  };
}
test('refreshed JWT is used for both Neon Data APIs without stale bearer',async()=>{
 const x=newFixture();
 try{
   const original=await x.app.auth.getSession();
   assert.equal(original.error,null);
   assert.equal(original.data.user.id,LEGACY);
   assert.equal(original.data.user.neon_subject,SUBJECT);
   x.headers.length=0;
   x.expire();
   const tripA=await x.app.from('trips').select('id');
   assert.equal(tripA.error,null);
   assert.equal(tripA.data.length,1);
   assert.equal(x.stats().refreshes,1,'only one refresh despite concurrent reads');
   // Query the PERSONAL table so router must use project B, and check both
   // data projects receive the same *new* token, never the pre-refresh token.
   const personal=await x.app.from('passenger_profiles').select('user_id');
   assert.equal(personal.error,null);
   assert.equal(personal.data.length,1);
   const first=x.headers.filter(q=>q.url.includes('/trips')||q.url.includes('/passenger_profiles'));
   assert.ok(first.some(q=>q.url.startsWith(API_ROOTS.a)));
   assert.ok(first.some(q=>q.url.startsWith(API_ROOTS.b)));
   assert.ok(first.every(q=>q.auth==='Bearer '+TOKEN_B),JSON.stringify(first));
   x.headers.length=0;
   const newSession=await x.app.auth.getSession();
   assert.equal(newSession.data.user.id,LEGACY);
   assert.equal(newSession.data.session.access_token,TOKEN_B);
   assert.equal((await x.app.auth.getSession()).error,null);
   const second=await x.app.from('trips').select('id');
   assert.equal(second.error,null);
   assert.ok(x.headers.some(h=>h.auth==='Bearer '+TOKEN_B));
   assert.equal(x.headers.some(h=>h.auth==='Bearer '+TOKEN_A),false);
 }finally{x.restore()}
});
test('expired JWT with failed refresh never reuses stale token',async()=>{
 const x=newFixture();
 try{
  assert.equal((await x.app.auth.getSession()).error,null);
  const before=x.headers.length;
  x.failNextRefresh();
  const current=await x.app.auth.getSession();
  assert.ok(current.error);
  assert.equal(current.data.session,null);
  assert.equal(x.headers.length,before);
 }finally{x.restore()}
});
test('refresh event keeps legacy UUID in the UI and logout invalidates session',async()=>{
 const x=newFixture();
 try{
  const events=[];
  const unsubscribe=x.app.auth.onAuthStateChange((type,sess)=>events.push({type,id:sess?.user?.id,token:sess?.access_token}));
  assert.equal((await x.app.auth.getSession()).data.user.id,LEGACY);
  x.expire();
  // Request performs refresh. Original Supabase-style callback must not leak Neon subject.
  const result=await x.app.from('trips').select('id');
  assert.equal(result.error,null);
  for(let i=0;i<12&&!events.some(e=>e.type==='TOKEN_REFRESHED');i++)
    await new Promise(r=>setImmediate(r));
  assert.ok(events.some(e=>e.type==='TOKEN_REFRESHED'&&e.id===LEGACY&&e.token===TOKEN_B));
  assert.equal(events.some(e=>e.id===SUBJECT),false);
  assert.equal((await x.app.auth.signOut()).error,null);
  const session=await x.app.auth.getSession();
  assert.equal(session.data.session,null);
  assert.ok(events.some(e=>e.type==='SIGNED_OUT'));
  unsubscribe.data.subscription.unsubscribe();
 }finally{x.restore()}
});
