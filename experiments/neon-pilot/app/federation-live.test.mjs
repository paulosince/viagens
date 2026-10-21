import test from 'node:test';
import assert from 'node:assert/strict';
import {testSignedFederation,ENDPOINTS} from './federation-live.mjs';
const token='aaaa.bbbb.cccc';
function mock({who='a',leak=false,forged=false,authFail=false,wrongCounts=false}={}){
  const calls=[];
  const fetcher=async(url,opt)=>{
    calls.push({url,opt});
    const project=url.startsWith(ENDPOINTS.a)?'a':'b';
    const auth=opt.headers.Authorization||'';
    if(auth==='Bearer not.a.valid.jwt'&&!forged)
      return {status:401,ok:false,json:async()=>({})};
    if(!auth&&!leak)
      return {status:403,ok:false,json:async()=>({})};
    if(authFail&&auth.startsWith('Bearer '+token))
      return {status:401,ok:false,json:async()=>({})};
    let data;
    if(url.includes('project_context'))data={is_home:who===project};
    else if(!auth)data=[{id:'private'}];
    else if(url.includes('passenger_profiles'))data=Array.from({length:project===who?1:0},(_,i)=>({id:i}));
    else if(url.includes('/trips'))data=Array.from({length:wrongCounts?8:(project==='a'?(who==='a'?4:1):0)},(_,i)=>({id:i}));
    return {status:200,ok:true,json:async()=>data};
  };
  return {fetcher,calls};
}
test('real-JWT-shaped owner A sees four owned trips and own profile only',async()=>{
  const {fetcher,calls}=mock({who:'a'});
  const result=await testSignedFederation({token,fetcher});
  assert.equal(result.passed,true);
  assert.equal(result.checks,11);
  assert.equal(result.projects.a.trips,4);
  assert.equal(result.projects.b.trips,0);
  assert.ok(calls.every(c=>c.opt.cache==='no-store'&&c.opt.redirect==='error'));
});
test('owner B sees one trip on A and private profile on B',async()=>{
  const result=await testSignedFederation({token,fetcher:mock({who:'b'}).fetcher});
  assert.equal(result.projects.a.trips,1);
  assert.equal(result.projects.a.profiles,0);
  assert.equal(result.projects.b.profiles,1);
});
test('reject forged JWT even if other requests would pass',async()=>{
  await assert.rejects(testSignedFederation({token,fetcher:mock({forged:true}).fetcher}),/FORGED_JWT/);
});
test('reject anonymous data leakage',async()=>{
  await assert.rejects(testSignedFederation({token,fetcher:mock({leak:true}).fetcher}),/ANONYMOUS_DATA_EXPOSED/);
});
test('a central token denied by either Data API fails entire result',async()=>{
  await assert.rejects(testSignedFederation({token,fetcher:mock({authFail:true}).fetcher}),/CONTEXT_FAILED/);
});
test('fail closed when any RLS-visible count changes from validated checkpoint',async()=>{
  await assert.rejects(testSignedFederation({token,fetcher:mock({wrongCounts:true}).fetcher}),/RLS_UNEXPECTED_COUNTS/);
});
test('invalid/missing bearer rejected before HTTP',async()=>{
  for(const candidate of [null,'','not-jwt','Bearer '+token]){
    await assert.rejects(testSignedFederation({token:candidate,fetcher:async()=>{throw Error('should not fetch')}}),/NO_REAL_NEON_JWT/);
  }
});
