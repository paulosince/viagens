import test from 'node:test';
import assert from 'node:assert/strict';
import {createLinkRepository} from './link-store.mjs';
const record={neon_subject:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 legacy_user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',proof_kind:'dual_session'};
function mocked() {
 const calls=[];
 const pool={async connect(){
   return {query:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT id FROM'))return {rowCount:1,rows:[{id:record.legacy_user_id}]};
      if(sql.includes('FROM viaggio_identity.neon_auth_links')&&sql.includes('FOR UPDATE'))return {rowCount:1,rows:[{neon_subject:record.neon_subject,legacy_user_id:record.legacy_user_id}]};
      return {rowCount:1,rows:[]};},release:()=>calls.push({sql:'release'})};
  },async query(sql,params){calls.push({sql,params});return {rowCount:1,rows:[]};}};
 return {calls,pool};
}
test('central lock wraps entire operation in a DB transaction',async()=>{
 const db=mocked();const store=createLinkRepository({central:db.pool,a:db.pool,b:db.pool});
 await store.withLock(record,async()=>{db.calls.push({sql:'operation'});});
 assert.deepEqual(db.calls.map(x=>x.sql.slice(0,8)),['BEGIN','SELECT p','operatio','COMMIT','release']);
});
test('prepare writes pending link only after checking private directory',async()=>{
 const db=mocked();const store=createLinkRepository({central:db.pool,a:db.pool,b:db.pool});
 await store.prepare('a',record);
 assert.equal(db.calls.some(x=>x.sql.includes('INSERT INTO viagem_identity_never_use')),false);
 assert.equal(db.calls.some(x=>x.sql.includes('VALUES($1::uuid,$2::uuid')&&x.sql.includes('NULL')),true);
 assert.equal(db.calls.some(x=>x.sql.includes('FOR UPDATE')),true);
});
test('activation and deactivation require both UUIDs and matching row',async()=>{
 const db=mocked();const store=createLinkRepository({central:db.pool,a:db.pool,b:db.pool});
 await store.activate('a',record);await store.deactivate('b',record);
 const mutations=db.calls.filter(x=>x.sql.includes('UPDATE'));
 assert.equal(mutations.length,2);
 assert.deepEqual(mutations[0].params,[record.neon_subject,record.legacy_user_id]);
 assert.deepEqual(mutations[1].params,[record.neon_subject,record.legacy_user_id]);
});
test('refuses unverified identity and unrecognized project',async()=>{
 const db=mocked();const store=createLinkRepository({central:db.pool,a:db.pool,b:db.pool});
 await assert.rejects(store.prepare('invalid',record),/UNKNOWN_PROJECT/);
 await assert.rejects(store.prepare('a',{...record,legacy_user_id:'not-uuid'}),/UNVERIFIED/);
 assert.equal(db.calls.length,0);
});
test('rejects inconsistent pre-existing link',async()=>{
 const db=mocked();
 const mismatch={...db.pool,connect:async()=>({
 query:async sql=>{
  if(sql.startsWith('SELECT id FROM'))return {rowCount:1,rows:[{}]};
  if(sql.includes('FOR UPDATE'))return {rowCount:1,rows:[{neon_subject:record.legacy_user_id,legacy_user_id:record.legacy_user_id}]};
  return {rowCount:1};
 },release(){} })};
 const store=createLinkRepository({central:db.pool,a:mismatch,b:db.pool});
 await assert.rejects(store.prepare('a',record),/MAPPING_CONFLICT/);
});

test('private directory selects home and shared-host projects per legacy ID',async()=>{
 const central=mocked().pool;
 const a={connect:async()=>{throw Error('unused');},query:async()=>({rowCount:1,rows:[{known_user:true,is_owner:true}]})};
 const b={connect:async()=>{throw Error('unused');},query:async()=>({rowCount:1,rows:[{known_user:false,is_owner:false}]})};
 const store=createLinkRepository({central,a,b});
 assert.deepEqual(await store.projectsForLegacy(record),['a']);
});
test('a guest is linked in host A and home B',async()=>{
 const central=mocked().pool;
 const a={connect:async()=>{throw Error('unused');},query:async()=>({rowCount:1,rows:[{known_user:true,is_owner:false}]})};
 const b={connect:async()=>{throw Error('unused');},query:async()=>({rowCount:1,rows:[{known_user:true,is_owner:true}]})};
 const store=createLinkRepository({central,a,b});
 assert.deepEqual(await store.projectsForLegacy(record),['a','b']);
});
test('two homes or absent home must be rejected',async()=>{
 const central=mocked().pool;
 const p=(known_user,is_owner)=>({connect:async()=>{throw Error('unused');},query:async()=>({rowCount:1,rows:[{known_user,is_owner}]})});
 for(const [a,b] of [[p(true,true),p(true,true)],[p(true,false),p(false,false)],[p(false,false),p(false,false)]]){
  const store=createLinkRepository({central,a,b});
  await assert.rejects(store.projectsForLegacy(record),/PROJECT_MAPPING_AMBIGUOUS/);
 }
});
test('directory query fails closed without valid boolean metadata',async()=>{
 const central=mocked().pool;
 const a={connect:async()=>{},query:async()=>({rowCount:1,rows:[{known_user:1,is_owner:1}]})};
 const b={connect:async()=>{},query:async()=>({rowCount:1,rows:[{known_user:false,is_owner:false}]})};
 await assert.rejects(createLinkRepository({central,a,b}).projectsForLegacy(record),/PROJECT_DIRECTORY_UNAVAILABLE/);
});
