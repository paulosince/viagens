
import assert from 'node:assert/strict';
import {adminPhotoSources} from '../experiments/neon-pilot/app/backend-neon.mjs';
import {streakModel,buildAdminModel} from '../experiments/neon-pilot/app/admin-panel.mjs';
assert.equal(streakModel(['2026-11-22','2026-11-23','2026-11-24','2026-11-24'],'2026-11-25').current,3);
assert.equal(streakModel(['2026-11-20','2026-11-22'],'2026-11-25').current,0);
assert.equal(streakModel(['2026-11-24','2026-11-25'],'2026-11-25').best,2);
const identities=[{legacy_id:'la',id:'a'},{legacy_id:'lb',id:'b'}];
const p={accounts:{today:'2026-11-25',users:[{id:'a',days:[]},{id:'b',days:[]},{id:'c',days:[]}]},snapshots:[{project_owner:'la',identities,trips:[{id:'t',owner_id:'la',name:'T'},{id:'deleted',owner_id:'lb',deleted:true}],memberships:[{trip_id:'t',user_id:'lb',role:'editor'}],quota:{database_bytes:10}},{project_owner:'lb',identities,trips:[],memberships:[],quota:{database_bytes:20}}]};
const m=buildAdminModel(p);assert.equal(m.registered,3);assert.equal(m.creators,1);assert.equal(m.sharedOnly,1);assert.equal(m.noTrips,1);assert.equal(m.trips.length,1);assert.equal(m.edges.length,2);assert.equal(m.users[1].shared[0].role,'editor');assert.equal(m.users[1].quotas[0].database_bytes,20);assert.equal(m.users[2].quotas.length,0);
console.log('PASS: admin model, permissions, deduplication, streak and quota attribution');

const photos=adminPhotoSources(p.accounts,[{profile_photos:[{id:'a',path:'legacy/a.jpg',is_home:false},{id:'b',path:'legacy/b.jpg',is_home:true},{id:'c',path:'../secret.jpg',is_home:true},{id:'outsider',path:'legacy/private.jpg'}]},{profile_photos:[{id:'a',path:'legacy/a-home.jpg',is_home:true}]}]);
assert.equal(photos.size,2);assert.equal(photos.get('a')[0].index,1);assert.equal(photos.get('a')[0].path,'legacy/a-home.jpg');assert.equal(photos.has('c'),false);assert.equal(photos.has('outsider'),false);console.log('PASS: administrative avatar source selection');
