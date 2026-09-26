const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('async function syncTripDaysForCount(');
const end = source.indexOf('\n}\n', start);
assert.ok(start >= 0 && end > start, 'trip day count sync exists');

function clientFor(days) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'trip_days');
      return {
        select() { return { eq() { return { async order() { return { data: days.map(day => ({ ...day })), error: null }; } }; } }; },
        update(patch) {
          return { async eq(field, id) {
            const day = days.find(item => item.id === id);
            assert.equal(field, 'id');
            calls.push(['update', id, patch]);
            Object.assign(day, patch);
            return { error: null };
          } };
        },
        async insert(rows) {
          calls.push(['insert', rows]);
          days.push(...rows.map((row, index) => ({ id: `new-${index}`, ...row })));
          return { error: null };
        }
      };
    }
  };
}

const context = {
  normalizeDayRecord: day => day,
  dayDeletedAt: day => day.deleted_at,
  dayPosition: day => day.position ?? day.day_number - 1,
  dayIsHidden: day => day.is_hidden === true || day.status === 'hidden',
  addDaysToDate: (date, offset) => {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  }
};
vm.createContext(context);
vm.runInContext(source.slice(start, end + 2), context);

(async () => {
  const ordered = [
    { id: 'first', position: 0, status: 'planned', is_hidden: false },
    { id: 'second', position: 1, status: 'planned', is_hidden: false }
  ];
  const orderedClient = clientFor(ordered);
  assert.equal(await context.syncTripDaysForCount(orderedClient, 'trip', '2026-11-18', 1, true), null);
  assert.equal(ordered[1].is_hidden, true);
  assert.equal(await context.syncTripDaysForCount(orderedClient, 'trip', '2026-11-18', 2, true), null);
  assert.equal(ordered[1].is_hidden, false);
  assert.equal(orderedClient.calls.filter(([action]) => action === 'insert').length, 0, 'existing day is restored, not duplicated');

  const legacy = [
    { id: 'old-first', day_number: 1, date: '2026-11-18', status: 'planned' },
    { id: 'old-second', day_number: 2, date: '2026-11-19', status: 'hidden' }
  ];
  const legacyClient = clientFor(legacy);
  assert.equal(await context.syncTripDaysForCount(legacyClient, 'trip', '2026-11-20', 2, false), null);
  assert.equal(legacy[0].date, '2026-11-20');
  assert.equal(legacy[1].date, '2026-11-21');
  assert.equal(legacy[1].status, 'empty');
  console.log('PASS: inline dates restore hidden days and shift legacy dates without duplication');
})().catch(error => { console.error(error); process.exitCode = 1; });
