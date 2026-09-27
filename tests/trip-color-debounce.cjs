const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('function savePendingTripColor()');
const end = source.indexOf('\nasync function saveTripFields(', start);
assert.ok(start >= 0 && end > start);

const trip = { id: 'trip-one', secondary_color: '#4775d1' };
const updates = [];
const timers = new Map();
let nextTimer = 1;
const control = { value: '#4775d1', parentElement: { style: { setProperty() {} } } };
const context = {
  tripColorSaveTimer: null,
  tripColorDraft: null,
  state: { activeTripId: 'trip-one', trips: [trip] },
  dom: { tripPageColor: control, tripPage: { style: { setProperty() {} } } },
  canEditTrip: () => true,
  canEditActiveTrip: () => true,
  clearTimeout(id) { timers.delete(id); },
  setTimeout(callback, delay) { assert.equal(delay, 850); const id = nextTimer++; timers.set(id, callback); return id; },
  saveTripFields(patch, options) { updates.push([patch.secondary_color, options.tripId]); trip.secondary_color = patch.secondary_color; return Promise.resolve(trip); },
  syncTripHero() {}
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

(async () => {
  for (let i = 0; i < 40; i++) {
    control.value = `#${(0x120000 + i).toString(16)}`;
    context.scheduleTripColorSave();
  }
  assert.equal(timers.size, 1, 'continuous picker events leave one timer');
  [...timers.values()][0]();
  await Promise.resolve();
  assert.equal(updates.length, 1, 'dragging commits the final color once');
  assert.equal(updates[0][0], control.value);
  control.value = trip.secondary_color;
  context.scheduleTripColorSave();
  [...timers.values()][0]();
  assert.equal(updates.length, 1, 'reselecting the same color sends no update');

  const offlineSource = fs.readFileSync('src/offline-store.js', 'utf8');
  const compactStart = offlineSource.indexOf('function redundantColorHistory(');
  const compactEnd = offlineSource.indexOf('\nasync function compactPendingColorHistory(', compactStart);
  vm.runInContext(offlineSource.slice(compactStart, compactEnd), context);
  const color = (id, tripId) => ({ id, tripId, type: 'record-change', entry: { summary: 'Cor da viagem alterada' } });
  const other = { id: 'day', tripId: 'trip-one', type: 'save-day' };
  assert.deepEqual(Array.from(context.redundantColorHistory([
    color('a', 'trip-one'), color('b', 'trip-one'), other,
    color('c', 'trip-one'), color('d', 'trip-two'), color('e', 'trip-two')
  ]), item => item.id), ['a', 'd'], 'compaction leaves other edits and their ordering intact');
  console.log('PASS: color picker coalesces requests and queued color history preserves other edits');
})().catch(error => { console.error(error); process.exitCode = 1; });
