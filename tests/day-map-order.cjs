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

const context = vm.createContext({});
vm.runInContext(
  ['activityTime', 'activityLocation', 'numericCoordinate', 'primaryActivityPlace',
    'activityLooksGeocodable', 'orderedDayActivities', 'dayMapPoints', 'dayMapGroups']
    .map(extract).join('\n'),
  context
);

// Day 1: Heathrow was stored before Guarulhos, but the flight leaves Guarulhos.
const locations = [
  {id: 'home', name: 'Casa', position: 0, latitude: null, longitude: null},
  {id: 'lhr', name: 'Heathrow', position: 1, latitude: 51.467739, longitude: -0.4587801},
  {id: 'lounge', name: 'Sala VIP', position: 2, latitude: null, longitude: null},
  {id: 'gru', name: 'Guarulhos', position: 4, latitude: -23.4356, longitude: -46.4731}
];
const activities = [
  {title: 'Voo Guarulhos → Londres', start_time: '16:25:00', position: 4, place_id: 'lhr'},
  {title: 'Sala VIP', start_time: '13:20:00', position: 2, place_id: 'lounge', latitude: -23.4356, longitude: -46.4731},
  {title: 'Chegada ao aeroporto', start_time: '13:00:00', position: 1, place_id: 'gru'},
  {title: 'Embarque', start_time: '15:30:00', position: 3, place_name: 'Guarulhos', latitude: -23.4356, longitude: -46.4731}
];

const route = context.dayMapPoints(locations, activities);
assert.deepEqual(Array.from(route, point => point.name), ['Guarulhos', 'Sala VIP', 'Guarulhos', 'Heathrow']);
assert.deepEqual(Array.from(route, point => point.latitude), [-23.4356, -23.4356, -23.4356, 51.467739]);
assert.equal(activities[0].title, 'Voo Guarulhos → Londres'); // No mutation of source order.

// Two stops at the same airport and a place without coordinates still appear in the list.
const withMissing = context.dayMapPoints(locations, [
  {id: 'home-activity', title: 'Saída de casa', place_id: 'home', start_time: '12:00:00'},
  ...activities
]);
assert.equal(withMissing.length, 5);
assert.equal(withMissing[0].name, 'Casa');
assert.equal(withMissing[0].latitude, null);
assert.equal(withMissing[0].activityId, 'home-activity');
assert.equal(withMissing[0].time, '12:00');
assert.deepEqual(Array.from(context.dayMapGroups(withMissing), group => Array.from(group, point => point.number)), [[2, 3, 4], [5]]);

// A saved place with missing coordinates can use its activity's coordinates.
const incomplete = context.dayMapPoints(
  [{id: 'station', name: 'Estação', latitude: null, longitude: null}],
  [{place_id: 'station', start_time: '09:00', latitude: -23.2, longitude: -46.4}]
);
assert.equal(incomplete[0].name, 'Estação');
assert.equal(incomplete[0].latitude, -23.2);

// A day without agenda items still displays its saved places.
const unscheduled = context.dayMapPoints([{name: 'Passeio', latitude: 48.86, longitude: 2.34}], []);
assert.equal(unscheduled[0].name, 'Passeio');

assert.equal(context.activityLooksGeocodable({title: 'Manhã'}), false);
assert.equal(context.activityLooksGeocodable({title: 'Tarde livre'}), false);
assert.equal(context.activityLooksGeocodable({title: 'Parque dos Príncipes'}), true);

console.log('PASS: day map follows agenda order and keeps geocoded places');
