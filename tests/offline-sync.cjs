const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
function extract(name) {
  const regex = new RegExp(`(?:async )?function ${name}\\(`);
  const match = regex.exec(source);
  assert.ok(match, `${name} exists`);
  const end = source.indexOf('\n}\n', match.index);
  assert.ok(end > match.index, `${name} ends`);
  return source.slice(match.index, end + 2);
}

const day = {id: 'd', trip_id: 't', status: 'planned', title: 'Dia'};
const a = {id: 'a', day_id: 'd', title: 'Sala VIP', photo_url: 'plane'};
const b = {id: 'b', day_id: 'd', title: 'Embarque', photo_url: 'plane'};
const locations = [{id: 'l', day_id: 'd', photo_url: 'plane'}];
const saved = [];
const queued = [];
const calls = [];
const state = {
  activeTripId: 't', activeDayId: null, tripDays: [day],
  dayActivities: new Map([['d', [a, b]]]),
  dayLocations: new Map([['d', locations]]),
  daySaveQueues: new Map(), daySaveVersions: new Map(),
  agendaSaveQueues: new Map(), agendaSaveVersions: new Map()
};
const database = {
  from(table) {
    return {
      update(value) { calls.push({table, method: 'update', value}); return this; },
      upsert(value) { calls.push({table, method: 'upsert', value}); return Promise.resolve({error: null}); },
      delete() { calls.push({table, method: 'delete'}); return this; },
      eq() { return this; }, in() { return this; },
      then(resolve) { resolve({error: null}); }
    };
  }
};
const context = {
  state,
  offlineStore: {
    async saveDayBundle(...args) { saved.push(args); },
    async enqueueMutation(item) { queued.push(item); }
  },
  setDaySaveState() {}, setAgendaSaveState() {},
  async refreshSyncStatus() {},
  updateInlineDayState(updatedDay, activities, places) {
    state.tripDays = [updatedDay];
    state.dayActivities.set('d', activities);
    state.dayLocations.set('d', places);
  },
  renderTripDays() {}, openDayPage() {},
  flushOutbox() { return Promise.resolve(true); },
  async trySupabase() { return database; },
  async supportsOrderedDaySchema() { return true; },
  dayPatchForRemote(patch) { return patch; },
  locationForRemote(location) { return location; },
  activityForRemote(activity) { return activity; },
  console
};

vm.createContext(context);
vm.runInContext([
  'queueDaySave', 'queueAgendaSave', 'recordsDiffer',
  'persistDayHeroChange', 'persistInlineDayChange',
  'syncMutation', 'rememberSyncedDayMutation'
].map(extract).join('\n'), context);

(async () => {
  await context.persistDayHeroChange(day, {title: 'Dia corrigido'}, {rerender: false});
  assert.equal(queued[0].type, 'save-day-patch');
  assert.equal(queued[0].activities, undefined);

  const changeA = [{...a, photo_url: 'lounge'}, b];
  const changeB = [a, {...b, photo_url: 'boarding'}];
  await Promise.all([
    context.persistInlineDayChange(day, changeA, locations, {}, {activityId: 'a', rerender: false}),
    context.persistInlineDayChange(day, changeB, locations, {}, {activityId: 'b', rerender: false})
  ]);
  assert.equal(state.dayActivities.get('d').find(x => x.id === 'a').photo_url, 'lounge');
  assert.equal(state.dayActivities.get('d').find(x => x.id === 'b').photo_url, 'boarding');
  assert.equal(saved.at(-1)[1].length, 2);
  assert.deepEqual(queued.slice(1).map(x => x.type), ['save-inline-activity', 'save-inline-activity']);
  assert.equal(queued[1].activities, undefined);
  assert.equal(queued[2].activities, undefined);

  const huge = 'x'.repeat(1_000_000);
  const full1 = {type: 'save-day', dayId: 'd', dayPatch: {status: 'planned'},
    activities: [{...a, photo_url: huge}, b], locations};
  const full2 = {type: 'save-day', dayId: 'd', dayPatch: {status: 'planned'},
    activities: [{...a, photo_url: 'lounge'}, b], locations};
  const previous = new Map();
  await context.syncMutation(full1);
  context.rememberSyncedDayMutation(previous, full1);
  calls.length = 0;
  await context.syncMutation(full2, previous.get('d'));
  assert.deepEqual(calls.filter(x => x.method === 'upsert').map(x => x.table), ['activities']);
  assert.equal(calls.find(x => x.table === 'activities').value.length, 1);
  assert.equal(calls.find(x => x.table === 'activities').value[0].id, 'a');
  console.log('PASS: day cover, concurrent agenda images, isolated upload, old queue delta');
})().catch(error => {console.error(error); process.exitCode = 1;});
