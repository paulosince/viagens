const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/offline-store.js', 'utf8');
const start = source.indexOf('async function discardHistoryBefore(');
const end = source.indexOf('\nasync function hasWorkspace(', start);
assert.ok(start >= 0 && end > start);

const old = '2026-09-26T12:00:00.000Z';
const newDate = '2026-09-27T02:00:00.000Z';
const logs = new Map([
  ['old', {id: 'old', created_at: old}],
  ['new', {id: 'new', created_at: newDate}]
]);
const outbox = new Map([
  ['old-history', {id: 'old-history', type: 'record-change', created_at: old}],
  ['old-edit', {id: 'old-edit', type: 'save-day-patch', created_at: old}],
  ['new-history', {id: 'new-history', type: 'record-change', created_at: newDate}]
]);
const store = records => ({
  getAll: () => [...records.values()],
  delete: key => records.delete(key)
});
const context = {
  openDb: async () => ({transaction: () => ({objectStore: name => store(name === 'outbox' ? outbox : logs)})}),
  requestResult: async value => value,
  transactionDone: async () => {}
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

context.discardHistoryBefore('2026-09-27T01:32:01.347Z').then(() => {
  assert.deepEqual([...logs.keys()], ['new']);
  assert.deepEqual([...outbox.keys()], ['old-edit', 'new-history']);
  console.log('PASS: reset removes old history without dropping pending trip edits');
}).catch(error => { console.error(error); process.exitCode = 1; });
