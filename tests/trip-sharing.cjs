const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260926_trip_invites_and_shared_owner.sql', 'utf8');
assert.match(html, /id="trip_page_share"/);
assert.match(html, /id="trip_share_recipient"[^>]*type="email"|id="trip_share_recipient" type="email"/);
assert.match(html, /value="viewer" checked/);
assert.match(html, /value="editor"/);
assert.match(css, /body\[data-trip-permission="viewer"\].*#add_day_page_activity/);
assert.match(migration, /email_confirmed_at is not null/);
assert.match(migration, /public\.is_trip_member\(id\)/);

const start = source.indexOf('function tripRole(trip)');
const end = source.indexOf('\nfunction normalizeDayRecord', start);
assert.ok(start >= 0 && end > start);
const state = { user: { id: 'me' }, tripRoles: new Map([['shared', 'viewer']]), activeTripId: 'shared', trips: [{ id: 'shared', user_id: 'other' }] };
const context = { state };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
assert.equal(context.tripRole({ id: 'mine', user_id: 'me' }), 'owner');
assert.equal(context.canEditTrip(state.trips[0]), false);
state.tripRoles.set('shared', 'editor');
assert.equal(context.canEditTrip(state.trips[0]), true);
state.tripRoles.set('shared', 'viewer');
assert.equal(context.canEditActiveTrip(), false, 'viewer must not enter autosave paths');

const submitStart = source.indexOf('async function submitTripShare(event)');
const submitEnd = source.indexOf('\nfunction openProfile()', submitStart);
assert.ok(submitStart >= 0 && submitEnd > submitStart);
let requests = 0;
const dom = {
  sendTripShare: { disabled: false },
  tripShareForm: {},
  tripShareRecipient: { value: ' invited@example.com ' },
  tripShareStatus: { textContent: '', dataset: {} }
};
context.dom = dom;
context.FormData = class { get() { return 'viewer'; } };
context.trySupabase = async () => ({ rpc: async (fn, args) => {
  requests++;
  assert.equal(fn, 'invite_trip_by_email');
  assert.equal(args.p_email, 'invited@example.com');
  assert.equal(args.p_role, 'viewer');
  return { data: 'pending', error: null };
} });
context.refreshTripShares = async () => {};
vm.runInContext(source.slice(submitStart, submitEnd), context);
(async () => {
  await context.submitTripShare({ preventDefault() {} });
  assert.equal(requests, 0, 'a viewer cannot share the trip');
  state.tripRoles.set('shared', 'owner');
  await context.submitTripShare({ preventDefault() {} });
  assert.equal(requests, 1);
  assert.match(dom.tripShareStatus.textContent, /criar a conta/);
  assert.equal(dom.sendTripShare.disabled, false);
  console.log('PASS: owner invitation and viewer/editor editing gates');
})().catch(error => { console.error(error); process.exitCode = 1; });
