const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('async function saveTripPassengers(');
const end = source.indexOf('\n}\n', start);
assert.ok(start >= 0 && end > start);

const owner = { id: 'owner', trip_id: 'trip', user_id: 'user', name: 'Paulo' };
const rows = [owner];
const edits = [
  { id: 'owner', session: true, name: 'Paulo', birthDate: '', photoUrl: '' },
  { id: 'draft', session: false, name: 'Gabriel', birthDate: '', photoUrl: '' }
];
const calls = [];
const context = {
  state: { user: { id: 'user' }, passengers: new Map([['trip', rows]]), newTripPassengers: edits },
  uniqueTripPassengers: passengers => passengers,
  ageFromBirthDate: () => null
};
const client = {
  from(table) {
    assert.equal(table, 'passengers');
    return {
      update(patch) { return { eq() { return { async eq() { calls.push('update'); return { error: null }; } }; } }; },
      insert(payload) {
        calls.push('insert');
        return { select() { return { async single() {
          rows.push({ ...payload, id: 'new-id' });
          return { data: { id: 'new-id' }, error: null };
        } }; } };
      },
      select() { return { eq() { return { async order() { return { data: rows.map(row => ({ ...row })), error: null }; } }; } }; }
    };
  }
};
vm.createContext(context);
vm.runInContext(source.slice(start, end + 2), context);

(async () => {
  assert.equal(await context.saveTripPassengers(client, 'trip'), null);
  assert.equal(edits[1].id, 'new-id');
  assert.equal(await context.saveTripPassengers(client, 'trip'), null);
  assert.equal(calls.filter(call => call === 'insert').length, 1);
  assert.equal(context.state.passengers.get('trip').length, 2);
  console.log('PASS: repeated passenger autosaves retain server IDs and do not duplicate people');
})().catch(error => { console.error(error); process.exitCode = 1; });
