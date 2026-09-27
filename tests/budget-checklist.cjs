const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('function replaceBudgetItem(');
const end = source.indexOf('\nlet budgetPageBackPending =', start);
assert.ok(start >= 0 && end > start);

async function check() {
  let serverStatus = 'pending';
  let failNext = false;
  let stallNext = false;
  let release;
  const writes = [];
  const errors = [];
  const row = { id: 'expense', trip_id: 'trip', label: 'Ingresso', planned_amount: 100, actual_amount: null, purchase_status: serverStatus };
  const state = { activeTripId: 'trip', budgetByTrip: new Map([['trip', [row]]]) };
  const jobs = new Map();
  const toggleErrors = new Map();
  const scheduled = new Map();
  let timerId = 0;
  let editing = true;
  const client = {
    from(table) {
      assert.equal(table, 'budget_items');
      return {
        update(patch) {
          return {
            eq() { return this; }, select() { return this; },
            async single() {
              writes.push(patch.purchase_status);
              if (stallNext) {
                stallNext = false;
                await new Promise(resolve => { release = resolve; });
              }
              if (failNext) {
                failNext = false;
                return { error: { message: 'Banco indisponível' } };
              }
              serverStatus = patch.purchase_status;
              return { data: { ...row, purchase_status: serverStatus }, error: null };
            }
          };
        }
      };
    }
  };
  const changes = [];
  const context = {
    state, budgetToggleJobs: jobs, budgetToggleErrors: toggleErrors,
    budgetToggleRevisions: new Map(), budgetToggleRevision: 0,
    canEditActiveTrip: () => editing,
    renderTripBudget() {},
    dom: { budgetStatus: {} },
    setTripPanelStatus(node, message, kind) { if (kind === 'error') errors.push(message); },
    trySupabase: async () => client,
    recordChange: async change => { changes.push(change); },
    setTimeout(callback) { const id = ++timerId; scheduled.set(id, callback); return id; },
    clearTimeout(id) { scheduled.delete(id); },
    console
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const status = () => state.budgetByTrip.get('trip')[0].purchase_status;

  context.toggleBudgetItem('trip', 'expense');
  assert.equal(status(), 'purchased', 'the circle checks immediately');
  assert.equal(writes.length, 0, 'saving is debounced');
  context.toggleBudgetItem('trip', 'expense');
  assert.equal(status(), 'pending', 'second tap unchecks immediately');
  await context.flushBudgetToggle('trip', 'expense');
  assert.equal(writes.length, 0, 'two quick taps do not send redundant writes');

  context.toggleBudgetItem('trip', 'expense');
  await context.flushBudgetToggle('trip', 'expense');
  assert.equal(serverStatus, 'purchased');
  assert.equal(changes.length, 1, 'persisted check is recorded in history');
  assert.equal(state.budgetByTrip.get('trip')[0].actual_amount, null, 'checking does not invent an amount paid');

  context.toggleBudgetItem('trip', 'expense');
  await context.flushBudgetToggle('trip', 'expense');
  assert.equal(serverStatus, 'pending');
  assert.equal(changes.length, 2);

  failNext = true;
  context.toggleBudgetItem('trip', 'expense');
  assert.equal(status(), 'purchased');
  await context.flushBudgetToggle('trip', 'expense');
  assert.equal(status(), 'pending', 'failed update restores the last saved status');
  assert.equal(toggleErrors.get('trip:expense'), 'Banco indisponível');
  assert.equal(errors.at(-1), 'Banco indisponível');

  context.toggleBudgetItem('trip', 'expense');
  await context.flushBudgetToggle('trip', 'expense');
  assert.equal(status(), 'purchased', 'the user can retry');
  assert.equal(toggleErrors.size, 0);

  stallNext = true;
  context.toggleBudgetItem('trip', 'expense');
  const firstSave = context.flushBudgetToggle('trip', 'expense');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof release, 'function');
  context.toggleBudgetItem('trip', 'expense');
  release();
  await firstSave;
  await context.flushBudgetToggle('trip', 'expense');
  assert.equal(status(), 'purchased', 'a later tap wins over an in-flight request');
  assert.equal(serverStatus, 'purchased', 'server matches the final visible check');

  editing = false;
  const count = writes.length;
  context.toggleBudgetItem('trip', 'expense');
  assert.equal(status(), 'purchased', 'viewers cannot change checklist state');
  assert.equal(writes.length, count);
}

check().then(() => console.log('PASS: budget check toggles, debounces, persists, rolls back and respects view-only access'))
  .catch(error => { console.error(error); process.exitCode = 1; });
