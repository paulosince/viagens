const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const app = fs.readFileSync('src/main.js', 'utf8');
const sql = fs.readFileSync('supabase/migrations/20260926_chatgpt_connection_and_snapshot_timeout.sql', 'utf8');
const icon = fs.readFileSync('assets/chatgpt-mark.svg', 'utf8');

assert.match(html, /class="profile-with-integration"[\s\S]*id="home_chatgpt_button"/);
assert.match(html, /assets\/chatgpt-mark\.svg/);
assert.doesNotMatch(html, /✦ ChatGPT/);
assert.match(icon, /viewBox="0 0 180 180"/);
assert.match(icon, /M106\.871 100\.095V79\.8993/);
assert.match(css, /\.home\[data-chatgpt-connected="true"\] \.chatgpt-header-button/);
assert.match(app, /client\.rpc\('has_chatgpt_connection'\)/);
assert.match(app, /state\.chatgptConnected = data === true/);
assert.match(sql, /consent\.user_id = \(select auth\.uid\(\)\)/);
assert.match(sql, /consent\.revoked_at is null/);
assert.match(sql, /set statement_timeout to '30s'/);
assert.match(app, /lastOutboxError\.code === '57014'/);
assert.equal((app.match(/upsert\(mutation\.entry, \{ onConflict: 'id', ignoreDuplicates: true \}\)/g) || []).length, 2);
assert.match(app, /\.from\('state_snapshots'\)\.select\('id'\)/);
assert.match(app, /if \(\(await offlineStore\.listOutbox\(\)\)\.length\) return;/);

const start = app.indexOf('async function loadDayRecords(');
const end = app.indexOf('\nfunction applyTripData(', start);
assert.ok(start >= 0 && end > start);
const context = { normalizeActivityRecord: item => item };
vm.createContext(context);
vm.runInContext(app.slice(start, end), context);
const calls = [];
const client = {
  from(table) {
    return {
      select() { return this; },
      in(_key, ids) { calls.push({ table, ids: [...ids] }); return this; },
      async order() { return { data: [{ table }], error: null }; }
    };
  }
};
context.loadDayRecords(client, [1, 2, 3, 4, 5]).then(result => {
  assert.equal(calls.length, 10);
  assert.deepEqual(calls.map(call => call.ids.length), Array(10).fill(1));
  assert.equal(result.activities.length, 5);
  assert.equal(result.locations.length, 5);
  console.log('PASS: official ChatGPT mark, verified connection badge, scoped sync batches');
}).catch(error => { console.error(error); process.exitCode = 1; });
