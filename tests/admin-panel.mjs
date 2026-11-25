import test from 'node:test';
import assert from 'node:assert/strict';
import {adminModel,streakModel} from '../experiments/neon-pilot/app/admin-panel.mjs';
test('streak deduplication, gaps and yesterday grace',()=>{
 const m=streakModel(['2026-11-22','2026-11-23','2026-11-23','2026-11-25'],'2026-11-26');
 assert.equal(m.total,3);assert.equal(m.current,1);assert.equal(m.longest,2);
 assert.equal(streakModel(['2026-11-20'],'2026-11-26').current,0);
 assert.equal(streakModel([],'2026-11-26').current,0);
});
test('classification, cross-project deduplication and owner-only quotas',()=>{
 const accounts={today:'2026-11-25',users:[{id:'a'},{id:'b'},{id:'c'}]};
 const identities=[{id:'a',legacy_id:'old-a'},{id:'b',legacy_id:'old-b'}];
 const projects=[{project:'a',project_owner:'old-a',identities,trips:[{id:'trip',owner_id:'old-a',name:'Paris',deleted:false}],memberships:[{trip_id:'trip',user_id:'old-b',role:'viewer'}],usage:{database_bytes:100}},{project:'b',project_owner:'old-b',identities,trips:[],memberships:[],usage:null}];
 const m=adminModel(accounts,projects);
 assert.equal(m.creators,1);assert.equal(m.sharedOnly,1);assert.equal(m.withoutTrips,1);assert.equal(m.activeTrips,1);
 assert.equal(m.users[1].shared[0].role,'viewer');assert.equal(m.users[1].quotas[0].usage,null);assert.equal(m.users[2].quotas.length,0);
 assert.throws(()=>adminModel(accounts,[projects[0],{...projects[1],trips:projects[0].trips}]),/duplicada/);
});

import {buildGraph,graphLayout,streakRatio} from '../experiments/neon-pilot/app/admin-graph.mjs';
test('graph preserves ownership, editing, viewing and isolated users',()=>{
 const graph=buildGraph({graphTrips:[{id:'t',name:'Paris'},{id:'orphan',name:'Sem vínculo'}],users:[
 {id:'a',owned:[{id:'t',name:'Paris'},{id:'deleted',deleted:true}],shared:[]},
 {id:'b',owned:[],shared:[{id:'t',role:'editor'}]},
 {id:'c',owned:[],shared:[{id:'t',role:'viewer'}]},
 {id:'d',owned:[],shared:[]}]});
 assert.equal(graph.users.length,4);assert.equal(graph.trips.length,2);
 assert.deepEqual(graph.edges.map(e=>e.role),['owner','editor','viewer']);
 assert.equal(graph.edges.some(e=>e.from==='u:d'),false);
 const l=graphLayout(graph);assert.equal(l.users.length,4);assert.equal(l.trips.length,2);
 assert.ok(l.users.every(n=>n.y>0&&n.y<l.height));
 assert.equal(streakRatio({current:3,longest:6}),.5);assert.equal(streakRatio({current:0,longest:0}),0);
});
