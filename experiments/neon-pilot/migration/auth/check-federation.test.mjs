import test from 'node:test';
import assert from 'node:assert/strict';
import {checkFederation} from './check-federation.mjs';

const endpoints = {a:'https://a.example.invalid/db/rest/v1',b:'https://b.example.invalid/db/rest/v1'};
function mock({home='none', trips={a:0,b:0}, forged=false, exposed=false, failSigned=false}={}) {
  return async (url, opt) => {
    const p = url.startsWith(endpoints.a) ? 'a' : 'b';
    const auth = opt.headers.Authorization;
    if (auth === 'Bearer not.a.valid.jwt' && !forged)
      return {status:401,ok:false,json:async()=>({})};
    if (!auth && !exposed)
      return {status:403,ok:false,json:async()=>({})};
    if (auth && auth !== 'Bearer not.a.valid.jwt' && failSigned)
      return {status:401,ok:false,json:async()=>({})};
    const data = url.includes('/rpc/project_context')
      ? {is_home:home === p}
      : Array.from({length:!auth?1:trips[p]},(_,i)=>({id:i}));
    return {status:200,ok:true,json:async()=>data};
  };
}
const run=(settings={},expectedHome='none')=>checkFederation({
  token:'dummy.token.test',expectedHome,fetcher:mock(settings),endpoints
});
test('unlinked identities are denied on both projects',async()=>{
  const r=await run();
  assert.equal(r.passed,true);
  assert.equal(r.projects.a.visibleTrips,0);
});
test('shared trip remains accessible to a linked guest',async()=>{
  const r=await run({home:'b',trips:{a:1,b:0}},'b');
  assert.equal(r.projects.a.visibleTrips,1);
  assert.equal(r.projects.b.home,true);
});
test('forged JWT rejected',async()=>{
  await assert.rejects(run({forged:true}),/invalid token/);
});
test('anonymous data exposure rejected',async()=>{
  await assert.rejects(run({exposed:true}),/anonymous data exposure/);
});
test('real token must be accepted on both projects',async()=>{
  await assert.rejects(run({failSigned:true}),/signed session/);
});
test('unlinked identity cannot view private trip',async()=>{
  await assert.rejects(run({trips:{a:1,b:0}}),/Unlinked/);
});
test('wrong project owner mapping rejected',async()=>{
  await assert.rejects(run({home:'a'},'b'),/Wrong or ambiguous/);
});
test('missing or prefixed credentials rejected',async()=>{
  await assert.rejects(checkFederation({token:'',fetcher:mock(),endpoints}),/JWT required/);
  await assert.rejects(checkFederation({token:'Bearer abc',fetcher:mock(),endpoints}),/JWT required/);
});
