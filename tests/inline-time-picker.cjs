const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/main.js', 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, `${name} exists`);
  return source.slice(start, end + 2);
}

const day = { id: 'day-1', trip_id: 'trip-1' };
const activity = { id: 'agenda-1', title: 'Passeio', start_time: '13:30:00' };
const writes = [];
const history = [];
const indicators = [];
let pageOpens = 0;
let pickerOpens = 0;
let active = null;
const context = {
  state: { activeTripId: 'trip-1' },
  canEditActiveTrip: () => true,
  document: {
    createElement(tag) {
      assert.equal(tag, 'input');
      const listeners = new Map();
      return {
        addEventListener(type, callback) { listeners.set(type, callback); },
        focus() { active = this; },
        showPicker() { pickerOpens++; },
        replaceWith(node) { active = node; },
        fire(type) { return listeners.get(type)?.(); }
      };
    }
  },
  cloneDayRecords: () => ({ activities: [{ ...activity }], locations: [] }),
  setAgendaSaveState: (id, status) => indicators.push([id, status]),
  persistInlineDayChange: async (changedDay, activities) => {
    assert.equal(changedDay, day);
    writes.push({ ...activities[0] });
    pageOpens++;
  },
  recordChange: async change => { history.push(change); },
  openDayPage: () => { pageOpens++; }
};
vm.createContext(context);
vm.runInContext(['activityTime', 'periodFromTime', 'beginInlineTimeEdit'].map(extract).join('\n'), context);

function edit() {
  const button = { replaceWith(input) { active = input; } };
  context.beginInlineTimeEdit(button, day, activity);
  assert.equal(active.type, 'time');
  assert.equal(active.value, '13:30');
  return { button, input: active };
}

(async () => {
  const { input } = edit();
  for (const time of ['13:31', '13:35', '14:00', '14:42']) {
    input.value = time;
    await input.fire('input');
    await input.fire('change'); // iOS fires this while the native wheel is moving.
    assert.equal(active, input, 'native picker stays attached during wheel movement');
    assert.equal(writes.length, 0, 'no time is saved before Done');
    assert.equal(pageOpens, 0, 'agenda does not rerender during selection');
  }
  assert.equal(indicators.length, 0, 'no save status appears during selection');

  await input.fire('blur'); // Native Done closes the picker and blurs its input.
  assert.equal(pickerOpens, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].start_time, '14:42:00');
  assert.equal(writes[0].period, 'afternoon');
  assert.equal(history.length, 1);
  assert.equal(pageOpens, 1);

  const unchanged = edit();
  await unchanged.input.fire('blur');
  assert.equal(active, unchanged.button, 'unchanged picker restores the time button');
  assert.equal(writes.length, 1, 'Done without a change does not write');

  const reset = edit();
  reset.input.value = '';
  await reset.input.fire('blur');
  assert.equal(active, reset.button, 'empty time restores the previous value');
  assert.equal(writes.length, 1);
  console.log('PASS: native time picker saves only its final confirmed value');
})().catch(error => { console.error(error); process.exitCode = 1; });
