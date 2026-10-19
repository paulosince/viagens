import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler, validKey} from '../service.mjs';
const path='10000000-0000-4000-8000-000000000001/photo.jpg';
function setup(overrides={}) {
 const events=[];
 const deps={ authorize:async()=>events.push('auth'),read:async()=>{events.push('read');return {bytes:3,content_type:'image/jpeg'}},
 download:async()=>new Uint8Array([1,2,3]),sign:async()=> 'https://storage.example.invalid/signed',
 upload:async()=>{events.push('upload');return {path}},remove:async()=>{events.push('remove');return []},...overrides };
 return {events,handler:makeHandler(deps)};
}
function request(route,options={}) { return new Request('https://backend.example.invalid/'+route+'?bucket=trip-images&path='+encodeURIComponent(path),
 {headers:{authorization:'Bearer test',origin:'https://paulosince.github.io'},...options}); }
test('anonymous requests do not access auth backend or bytes',async()=>{
 const {handler,events}=setup();const r=await handler(request('download',{headers:{}}));assert.equal(r.status,401);assert.deepEqual(events,[]);
});
test('denied trip access never reads storage',async()=>{
 const {handler,events}=setup({authorize:async()=>{throw Object.assign(new Error('ACCESS_DENIED'),{status:403})}});
 assert.equal((await handler(request('download'))).status,403);assert.deepEqual(events,[]);
});
test('authorized download is byte exact',async()=>{
 const {handler,events}=setup();const r=await handler(request('download'));assert.equal(r.status,200);
 assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3]);assert.deepEqual(events,['auth','read']);
});
test('cross-origin request is rejected before work',async()=>{
 const {handler,events}=setup();assert.equal((await handler(request('download',{headers:{origin:'https://evil.invalid',authorization:'Bearer test'}}))).status,403);assert.deepEqual(events,[]);
});
test('missing or deleted object is not signed',async()=>{
 const {handler}=setup({read:async()=>null,sign:async()=>assert.fail('signed missing object')});assert.equal((await handler(request('sign'))).status,404);
});
test('oversized stream without content length never uploads',async()=>{
 const {handler,events}=setup();const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(25000001));c.close()}});
 const r=await handler(request('upload',{method:'POST',body,duplex:'half',headers:{authorization:'Bearer test'}}));
 assert.equal(r.status,413);assert.deepEqual(events,['auth']);
});
test('invalid keys reject traversal and unknown buckets',()=>{
 assert.equal(validKey('trip-images',path),true);assert.equal(validKey('trip-images',path+'/../secret'),false);
 assert.equal(validKey('other',path),false);assert.equal(validKey('profile-photos','../'+path),false);
});
test('remove authorizes all keys before applying any change',async()=>{
 let count=0;const {handler,events}=setup({authorize:async()=>{if(++count===2)throw Object.assign(new Error('ACCESS_DENIED'),{status:403})}});
 const r=await handler(request('remove',{method:'POST',body:JSON.stringify({paths:[path,path+'2']}),headers:{authorization:'Bearer test'}}));
 assert.equal(r.status,403);assert.deepEqual(events,[]);
});
