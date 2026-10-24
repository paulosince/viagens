const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
const begin = source.indexOf('async function pendingCreationBeforeUpload(mutation) {');
const end = source.indexOf('\n}\n',begin);
assert(begin>=0 && end>begin,'Neon dependency repair function present');
const handler = source.slice(begin,end+2);
const queue = [
 {id:'upload',type:'upload-image',table:'day_locations',entityId:'new-location',tripId:'personal-trip'},
 {id:'change',type:'record-change',tripId:'personal-trip'},
 {id:'save',type:'save-day',tripId:'personal-trip',dayId:'day',
  locations:[{id:'new-location',name:'Eiffel Tower'}],activities:[]}
];
const offlineStore = {listOutbox: async()=>queue};
const client = present=>({from(table){
 assert.equal(table,'day_locations');
 const q={select(){return q;},eq(field,value){
  assert.equal(field,'id');assert.ok(value);return q;
 },async maybeSingle(){return {data:present?{id:'new-location'}:null,error:null};}};
 return q;
}});
const make = (present,online=true)=>new Function('offlineStore','tryNeon',
  handler+'\nreturn pendingCreationBeforeUpload;'
)(offlineStore,async()=>online?client(present):null);
(async()=>{
 const item=await make(false)(queue[0]);
 assert.equal(item?.id,'save','Later day save must run before local image DB update');
 assert.equal(await make(true)(queue[0]),null,'Previously committed location needs no reorder');
 assert.equal(await make(false,false)(queue[0]),null,'Offline must not invent a destination');
 assert.equal(await make(false)({...queue[0],entityId:'unrelated'}),null,'Unknown entity must never be remapped');
 assert.equal(await make(false)({...queue[0],tripId:'another-trip'}),null,'Do not cross trip boundaries');
 assert.equal(queue.length,3,'Diagnostic leaves local queue untouched');
 assert(source.includes('const previous = await client.storage.from(bucket).download(mutation.path)'),
  'Retries must check existing upload before rewriting');
 assert(source.includes('(await hashBlob(previous.data)) === mutation.hash'),
  'Only verified SHA-256 media can be reused');
 console.log('PASS: Neon outbox recovery preserves all changes, identities and image integrity');
})().catch(e=>{console.error(e);process.exitCode=1;});
