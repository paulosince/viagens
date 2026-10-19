import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaClient} from '../storage.mjs';
function setup({token='session',statuses=[200]}={}){
 const calls=[];const projects=['a','b'].map(id=>({id,media:'https://'+id+'.example/',client:{rpc:async()=>({data:{is_home:id==='b'}}),from:()=>({select(){return this},eq(k,v){this.v=v;return this},limit(){return Promise.resolve({data:this.v===id+'-trip'?[{id:this.v}]:[]})}})}}));
 const storage=createMediaClient({projects,accessToken:async()=>token,fetcher:async(url,options)=>{calls.push({url:String(url),options});const status=statuses.shift()||200;return Response.json(status===200?{data:{signedUrl:'https://object.example/test'}}:{error:'denied'},{status})}});
 return {storage,calls};
}
test('profile upload goes only to home project',async()=>{const {storage,calls}=setup();await storage.from('profile-photos').upload('owner/photo',new Blob(['x']));assert.ok(calls[0].url.startsWith('https://b.example/upload'));assert.equal(calls.length,1)});
test('shared trip upload goes only to owner project',async()=>{const {storage,calls}=setup();await storage.from('trip-images').upload('a-trip/photo',new Blob(['x']));assert.ok(calls[0].url.startsWith('https://a.example/upload'))});
test('missing token does not fetch bytes',async()=>{const {storage,calls}=setup({token:null});assert.ok((await storage.from('profile-photos').download('owner/photo')).error);assert.equal(calls.length,0)});
test('missing legacy profile can be read from other Neon project',async()=>{const {storage,calls}=setup({statuses:[404,200]});assert.equal((await storage.from('profile-photos').download('owner/photo')).error,null);assert.equal(calls.length,2);assert.ok(calls.every(c=>c.url.includes('.example/')))});
test('server outage does not become fallback success',async()=>{const {storage,calls}=setup({statuses:[503,200]});assert.ok((await storage.from('profile-photos').download('owner/photo')).error);assert.equal(calls.length,1)});
test('multi-project removal rejected before request',async()=>{const {storage,calls}=setup();assert.ok((await storage.from('trip-images').remove(['a-trip/photo','b-trip/photo'])).error);assert.equal(calls.length,0)});
