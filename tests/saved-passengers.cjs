const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, `${name} exists`);
  return source.slice(start, end + 2);
}

class Element {
  constructor() { this.children = []; this.listeners = {}; this.attributes = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}

const state = {
  user: { id: 'user-1' }, profile: { birth_date: '1980-01-01' },
  savedPassengers: [
    { id: 'saved-1', owner_id: 'user-1', name: 'Gabriel', birth_date: '2010-02-03', photo_url: 'saved-photo' },
    { id: 'saved-2', owner_id: 'user-1', name: 'Manuela', birth_date: '2012-04-05', photo_url: null }
  ],
  passengers: new Map([['trip-1', [
    { id: 'old-1', name: 'Gabriel', birth_date: '2010-02-03', photo_url: 'older-photo' },
    { id: 'old-2', name: 'Manuela', birth_date: '2012-04-05', photo_url: 'family-photo' },
    { id: 'old-3', user_id: 'user-1', name: 'Cintia', birth_date: '1980-01-01' }
  ]]]), newTripPassengers: []
};
const dom = { savedTripPassengers: new Element(), savedTripPassengerList: new Element() };
const context = {
  state, dom, profileName: () => 'Cintia',
  document: { createElement: () => new Element() },
  crypto: { randomUUID: () => 'new-trip-passenger' },
  renderTripPassengers: () => context.renderSavedTripPassengers()
};
vm.createContext(context);
vm.runInContext([
  'savedPassengerKey', 'availableSavedPassengers', 'matchesSavedPassenger', 'renderSavedTripPassengers',
  'passengerEditorKey', 'uniqueTripPassengers'
].map(extract).join('\n'), context);

assert.deepEqual(Array.from(context.availableSavedPassengers(), item => item.name), ['Gabriel', 'Manuela']);
context.renderSavedTripPassengers();
assert.equal(dom.savedTripPassengerList.children.length, 2);
const manuela = dom.savedTripPassengerList.children[1];
manuela.listeners.click();
assert.equal(state.newTripPassengers.length, 1);
assert.equal(state.newTripPassengers[0].photoUrl, 'family-photo');
assert.equal(state.newTripPassengers[0].birthDate, '2012-04-05');
state.newTripPassengers[0].name = 'Manuela Silva';
assert.equal(context.matchesSavedPassenger(state.newTripPassengers[0], state.passengers.get('trip-1')[1]), true);
assert.equal(dom.savedTripPassengerList.children[1].attributes['aria-pressed'], 'true');
dom.savedTripPassengerList.children[1].listeners.click();
assert.equal(state.newTripPassengers.length, 0);

const duplicate = context.uniqueTripPassengers([
  { name: 'Gabriel', birthDate: '2010-02-03', photoUrl: 'first' },
  { name: ' gabriel ', birthDate: '2010-02-03', photoUrl: 'second' }
]);
assert.equal(duplicate.length, 1);
assert.equal(context.availableSavedPassengers()[1].photo_url, 'family-photo');
assert.doesNotMatch(source, /Salvar para outras viagens/);

console.log('PASS: only profile-saved passengers are reusable; historical photos can enrich them');
