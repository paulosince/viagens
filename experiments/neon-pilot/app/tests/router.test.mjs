import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouter} from '../router.mjs';
function setup({failProject,duplicate=false}={}) {
 const writes=[];
 const db={a:{trips:[{id:'trip-a',name:'B',start_date:'2026-02-01'}],trip_days:[{id:'day-a',trip_id:'trip-a'}],passenger_profiles:[{user_id:'a'}]},b:{trips:[{id:duplicate?'trip-a':'trip-b',name:'A',start_date:'2026-01-01'}],passenger_profiles:[{user_id:'b'}]}};
 const projects=['a','b'].map(id=>({id,client:{rpc:async name=>({data:name==='project_context'?{is_home:id==='b'}:[],error:null}),from(table){
 let rows=[...(db[id][table]||[])],writing=false;
 const q={select(){return q},limit(n){rows=rows.slice(0,n);return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},in(k,v){rows=rows.filter(r=>v.includes(r[k]));return q},is(k,v){return q.eq(k,v)},order(){return q},single(){return q},maybeSingle(){return q},insert(){writing=true;return q},update(){writing=true;return q},delete(){writing=true;return q},upsert(){writing=true;return q},then(resolve){if(writing)writes.push({id,table});return Promise.resolve(id===failProject?{error:Error('unavailable')}:{data:rows,error:null}).then(resolve)}};return q;
 }}}));
 return {router:createRouter({projects}),writes};
}
test('global ordering and limit across projects',async()=>{const {router}=setup();const r=await router.from('trips').select('*').order('start_date').limit(1);assert.equal(r.data[0].id,'trip-b')});
test('personal data read only from home project',async()=>{const {router}=setup();const r=await router.from('passenger_profiles').select('*');assert.deepEqual(r.data,[{user_id:'b'}])});
test('new trip goes to home project',async()=>{const {router,writes}=setup();await router.from('trips').insert({name:'new'});assert.deepEqual(writes,[{id:'b',table:'trips'}])});
test('shared trip update goes to owner project',async()=>{const {router,writes}=setup();const r=await router.from('trips').update({name:'new'}).eq('id','trip-a');assert.equal(r.error,null);assert.equal(writes[0].id,'a')});
test('activity insert resolves day then project',async()=>{const {router,writes}=setup();const r=await router.from('activities').insert({day_id:'day-a'});assert.equal(r.error,null);assert.equal(writes[0].id,'a')});
test('cross-project batch is rejected before any write',async()=>{const {router,writes}=setup();const r=await router.from('trips').delete().in('id',['trip-a','trip-b']);assert.ok(r.error);assert.equal(writes.length,0)});
test('unscoped write rejected',async()=>{const {router,writes}=setup();assert.ok((await router.from('passengers').update({name:'new'}).eq('user_id','b')).error);assert.equal(writes.length,0)});
test('ambiguous owner rejected',async()=>{const {router,writes}=setup({duplicate:true});assert.ok((await router.from('trips').delete().eq('id','trip-a')).error);assert.equal(writes.length,0)});
test('project outage does not return partial reads',async()=>{const {router}=setup({failProject:'a'});assert.ok((await router.from('trips').select('*')).error)});
test('missing trip never falls back to home',async()=>{const {router,writes}=setup();assert.ok((await router.from('trips').update({name:'n'}).eq('id','missing')).error);assert.equal(writes.length,0)});
test('account deletion remains blocked until propagation exists',async()=>{const {router}=setup();assert.ok((await router.rpc('soft_delete_own_account')).error)});
test('query is executed only once when awaited twice',async()=>{const {router,writes}=setup();const q=router.from('trips').insert({name:'n'});await q;await q;assert.equal(writes.length,1)});
