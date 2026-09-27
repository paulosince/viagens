const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
function extract(name) {
  const functionStart = source.indexOf(`function ${name}(`);
  const start = source.slice(functionStart - 6, functionStart) === 'async ' ? functionStart - 6 : functionStart;
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, `${name} exists`);
  return source.slice(start, end + 2);
}

const state = {
  user: { id: 'paulo' }, savedPassengers: [],
  trips: [{id: 'shared-trip', user_id: 'cintia', access_role: 'viewer'}],
  tripRoles: new Map([['shared-trip', 'viewer']]),
  tripOwners: new Map()
};
const context = {
  state,
  profileImage: () => 'paulo-profile-photo',
  profileName: () => 'Paulo',
  savedPassengerKey: passenger => passenger.name,
  offlineStore: {setMeta: async () => {}},
  console
};
vm.createContext(context);
vm.runInContext([extract('tripRole'), extract('passengerImage'), extract('refreshSharedTripOwners')].join('\n'), context);

(async () => {
  const client = {
    rpc: async () => ({data: [{trip_id: 'shared-trip', owner_name: 'Cíntia', avatar_path: 'cintia/avatar.jpg'}], error: null}),
    storage: {from: () => ({createSignedUrl: async () => ({data: {signedUrl: 'cintia-signed-photo'}, error: null})})}
  };
  await context.refreshSharedTripOwners(client);
  assert.equal(state.tripOwners.get('shared-trip').avatarUrl, 'cintia-signed-photo');
  assert.equal(context.passengerImage({name: 'Cintia', trip_id: 'shared-trip'}).src, 'cintia-signed-photo');
  assert.equal(context.passengerImage({name: 'Paulo', trip_id: 'shared-trip', photo_url: 'paulo-passenger-photo'}).src, 'paulo-passenger-photo');
  assert.equal(context.passengerImage({name: 'Outra pessoa', trip_id: 'shared-trip'}).src, '');
  console.log('PASS: shared owner and passenger photos remain tied to their own accounts');
})().catch(error => { console.error(error); process.exitCode = 1; });
