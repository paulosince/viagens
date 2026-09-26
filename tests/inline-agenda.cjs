const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
function extract(name) {
  const match = new RegExp(`function ${name}\\(`).exec(source);
  assert.ok(match, `${name} exists`);
  const end = source.indexOf('\n}\n', match.index);
  assert.ok(end > match.index, `${name} ends`);
  return source.slice(match.index, end + 2);
}

let nextId = 0;
const context = vm.createContext({ crypto: { randomUUID: () => `new-${++nextId}` } });
vm.runInContext([
  "const NEW_AGENDA_TITLE = 'Nova atividade';",
  "const NEW_AGENDA_DESCRIPTION = 'Adicione uma descrição';",
  ...['activityTime', 'periodFromTime', 'numericCoordinate', 'primaryActivityPlace',
    'activityLooksGeocodable', 'locationDraft', 'orderedDayActivities', 'newAgendaActivity'].map(extract)
].join('\n'), context);

const day = { id: 'day-1' };
const activities = [
  { id: 'later', start_time: '13:00:00', position: 1 },
  { id: 'first', start_time: '12:00:00', position: 0 }
];
const first = context.newAgendaActivity(day, activities);
assert.equal(first.start_time, '11:59:00');
assert.equal(first.position, -1);
assert.equal(first.day_id, day.id);
assert.ok(first.title && first.description);
assert.equal(first.place_id, null);
assert.equal(context.activityLooksGeocodable(first), false);
assert.equal(context.locationDraft(null, first).name, '');
assert.equal(context.orderedDayActivities([...activities, first])[0].id, first.id);

const second = context.newAgendaActivity(day, [...activities, first]);
assert.equal(second.start_time, '11:58:00');
assert.equal(context.orderedDayActivities([...activities, first, second])[0].id, second.id);
assert.equal(activities[0].id, 'later'); // Insertion does not reorder existing records.

const midnight = context.newAgendaActivity(day, [{start_time: '00:00:00', position: 0}]);
assert.equal(midnight.start_time, '00:00:00');
assert.equal(context.orderedDayActivities([{start_time: '00:00:00', position: 0}, midnight])[0].id, midnight.id);

const untimed = context.newAgendaActivity(day, [{title: 'Manhã', start_time: null, position: 0}]);
assert.equal(context.orderedDayActivities([{title: 'Manhã', start_time: null, position: 0}, untimed])[0].id, untimed.id);
assert.equal(context.newAgendaActivity(day, []).start_time, '09:00:00');

console.log('PASS: new agenda item starts first with saved indicative text');
