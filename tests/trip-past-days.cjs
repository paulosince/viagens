const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
function extract(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  const end = source.indexOf('\n}\n', start);
  assert.ok(end > start, name + ' ends');
  return source.slice(start, end + 2);
}

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.listeners = {};
    this.attrs = {};
    this.style = {};
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute(name, value) { this.attrs[name] = value; }
  get childElementCount() { return this.children.length; }
  blur() {}
}

let clock = Date.parse('2026-11-19T12:00:00Z');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
}
const trip = { id: 'trip', start_date: '2026-11-18', day_count: 3 };
const days = [0, 1, 2].map(position => ({ id: 'day' + (position + 1), position, title: 'Passeios' }));
const dom = { tripDayList: new Node('ol'), tripDayMessage: new Node('p') };
const opened = [];
const context = {
  Date: Clock, Intl,
  state: { activeTripId: 'trip', trips: [trip] },
  dom, document: { createElement: tag => new Node(tag) },
  tripDayCount: item => item.day_count,
  dayPosition: day => day.position,
  dayNumber: day => day.position + 1,
  dayDeletedAt: day => day.deleted_at || null,
  dayIsHidden: day => day.is_hidden === true,
  normalizeDayRecord: day => day,
  derivedDayDate: (day, item) => {
    if (!item.start_date) return '';
    const date = new Date(item.start_date + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + day.position);
    return date.toISOString().slice(0, 10);
  },
  dayTitle: () => 'Passeios',
  dayPhoto: () => null,
  dayTiming: () => ({ label: 'HOJE', today: true }),
  orderedDayActivities: list => list,
  activityTime: () => null,
  updateCurrentItineraryTime: () => {},
  canEditActiveTrip: () => true,
  openDayPage: id => opened.push(id),
  openDayEditor: day => opened.push('editor:' + day.id),
  moveDayByOffset: () => {},
  orderedDaySchemaSupport: false,
  recoverHiddenDay: () => {},
  softDeleteHiddenDay: () => {}
};
vm.createContext(context);
vm.runInContext(['isPastTripDay', 'renderTripDays'].map(extract).join('\n'), context);

function render() {
  context.renderTripDays(days, new Map(), new Map());
  return dom.tripDayList.children;
}
let cards = render();
assert.equal(cards[0].className, 'trip-past-days', 'past-day strip is first');
assert.equal(cards[0].children[1].children.length, 1, 'yesterday is a compact tile');
assert.equal(cards[0].children[1].children[0].textContent, '1');
assert.match(cards[0].children[1].children[0].attrs['aria-label'], /Abrir Dia 1/);
assert.deepEqual(cards.slice(1).map(card => card.dataset.dayId), ['day2', 'day3']);
cards[0].children[1].children[0].listeners.click();
assert.deepEqual(opened, ['day1'], 'tapping a past tile opens its full day');

clock = Date.parse('2026-11-20T12:00:00Z');
cards = render();
assert.equal(cards[0].children[1].children.length, 2, 'the next day collapses automatically');
assert.deepEqual(cards.slice(1).map(card => card.dataset.dayId), ['day3']);

clock = Date.parse('2026-11-17T12:00:00Z');
cards = render();
assert.equal(cards[0].className, 'trip-day-card', 'upcoming trip stays expanded');
assert.equal(cards.length, 3);

clock = Date.parse('2026-11-19T12:00:00Z');
days[0].is_hidden = true;
cards = render();
assert.equal(cards[0].className, 'trip-day-card', 'restorable hidden day is not compacted');
assert.equal(cards[0].dataset.restorable, 'true');
days[0].is_hidden = false;

trip.start_date = '';
assert.equal(context.isPastTripDay(days[0], trip), false, 'a day without a date must not collapse');
trip.start_date = '2026-11-18';

assert.match(css, /\.trip-past-days\s*\{/);
assert.match(css, /\.trip-past-day-button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
console.log('PASS: past days collapse, remain accessible, and respect local calendar dates');
