const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('async function createTripInstantly()');
const end = source.indexOf('\nconst tripPassengerGroup', start);
assert.ok(start >= 0 && end > start, 'direct trip creation is available');
const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /id="trip_create_message"/);
assert.doesNotMatch(source.slice(source.indexOf('dom.newTripButton.addEventListener'), source.indexOf('dom.closeNewTrip.addEventListener')), /openNewTrip/);

async function scenario(failTable = null) {
  const calls = [];
  const buttons = [{ disabled: false }, { disabled: false }];
  const state = { saving: false, user: { id: 'owner' }, profile: { name: 'Ana', birth_date: null }, trips: [], passengers: new Map(), selectedYear: 2025 };
  const dom = { newTripButton: buttons[0], emptyNewTripButton: buttons[1], tripCreateMessage: { textContent: '' } };
  const client = {
    from(table) {
      return {
        insert(payload) {
          calls.push({ table, payload });
          const error = table === failTable ? { message: 'Falha simulada' } : null;
          if (table === 'trips') return { select() { return { async single() { return { data: { id: 'created', ...payload }, error }; } }; } };
          return Promise.resolve({ error });
        },
        delete() { return { async eq() { calls.push({ table, deleted: true }); return { error: null }; } }; }
      };
    }
  };
  let opened = null;
  const RealDate = Date;
  class LocalDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-09-27T01:15:00Z'])); }
  }
  const context = {
    state, dom, Date: LocalDate, console,
    setLoading(button, loading) { button.disabled = loading; },
    async trySupabase() { return client; },
    async supportsOrderedDaySchema() { return true; },
    profileName() { return state.profile.name; },
    ageFromBirthDate() { return null; },
    createDays(id, count, date) { return [{ trip_id: id, position: 0, start: date, status: 'empty' }]; },
    async loadTrips() { state.trips = [{ id: 'created', name: 'Nova viagem', start_date: '2026-09-26', day_count: 1 }]; },
    setYearMenu() {},
    async openTrip(id) { opened = id; },
    recordChange() { return Promise.resolve(); }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const first = context.createTripInstantly();
  const second = context.createTripInstantly();
  await Promise.all([first, second]);
  return { calls, dom, buttons, opened, state };
}

(async () => {
  const success = await scenario();
  const inserts = success.calls.filter(call => !call.deleted);
  assert.deepEqual(inserts.map(call => call.table), ['trips', 'trip_members', 'passengers', 'trip_days']);
  assert.equal(inserts[0].payload.start_date, '2026-09-26', 'local date must win over UTC near midnight');
  assert.equal(inserts[0].payload.day_count, 1);
  assert.equal(inserts[0].payload.name, 'Nova viagem');
  assert.equal(inserts[2].payload.user_id, 'owner');
  assert.equal(inserts[3].payload.length, 1);
  assert.equal(success.opened, 'created');
  assert.ok(success.buttons.every(button => !button.disabled));

  const failed = await scenario('trip_days');
  assert.equal(failed.opened, null);
  assert.deepEqual(failed.calls.filter(call => call.deleted).map(call => call.table), ['trip_days', 'passengers', 'trip_members', 'trips']);
  assert.equal(failed.dom.tripCreateMessage.textContent, 'Falha simulada');
  console.log('PASS: direct creation uses local date, one day, owner, navigation and cleanup on failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
