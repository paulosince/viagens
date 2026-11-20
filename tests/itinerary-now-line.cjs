const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const from = source.indexOf('function localItineraryDateKey(');
const to = source.indexOf('function renderTripDays(', from);
assert.ok(from > 0 && to > from, 'live agenda helpers exist');

class Item {
  constructor(className = '', time = '') {
    this.className = className;
    this.dataset = time ? { agendaTime: time } : {};
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
  }
  append(...items) {
    for (const item of items) {
      item.parentNode = this;
      this.children.push(item);
    }
  }
  insertBefore(item, before) {
    item.parentNode = this;
    const index = before == null ? -1 : this.children.indexOf(before);
    if (index === -1) this.children.push(item);
    else this.children.splice(index, 0, item);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  get nextSibling() {
    if (!this.parentNode) return null;
    return this.parentNode.children[this.parentNode.children.indexOf(this) + 1] || null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const all = [];
    function walk(node) {
      for (const child of node.children) {
        all.push(child);
        walk(child);
      }
    }
    walk(this);
    if (selector === 'li[data-agenda-time]') return all.filter(node => node.dataset.agendaTime);
    if (selector === '.day-view-agenda-item[data-agenda-time]') {
      return all.filter(node => node.className === 'day-view-agenda-item' && node.dataset.agendaTime);
    }
    if (selector === '.trip-day-card[data-day-id]') {
      return all.filter(node => node.className === 'trip-day-card' && node.dataset.dayId);
    }
    if (selector[0] === '.') return all.filter(node => node.className.split(' ').includes(selector.slice(1)));
    throw new Error('Unsupported selector ' + selector);
  }
}
const list = new Item();
const agenda = new Item('day-view-agenda');
for (const time of ['09:00', '11:30', '15:00', '19:20']) agenda.append(new Item('day-view-agenda-item', time));
const context = {
  Date, String, Number,
  window: { setInterval() {} },
  document: {
    createElement: () => new Item(),
    addEventListener() {},
    body: { dataset: { dayPage: 'open' } }
  },
  state: {
    trips: [{ id: 't1' }], activeTripId: 't1', activeDayId: 'd1',
    tripDays: [{ id: 'd1' }], dayActivities: new Map(), dayLocations: new Map()
  },
  dom: {
    tripDayList: list,
    dayPageAgenda: agenda
  },
  derivedDayDate: () => '2026-11-20',
  renderTripDays: () => {}
};
vm.createContext(context);
vm.runInContext(source.slice(from, to), context);

// The compact trip overview uses the same live clock without changing card order.
const summaryCard = new Item('trip-day-card');
summaryCard.dataset.dayId = 'd1';
const summary = new Item('trip-day-agenda');
summary.append(new Item('trip-day-row', '09:00'), new Item('trip-day-row', '15:00'));
summaryCard.append(summary);
list.append(summaryCard);

assert.equal(context.itineraryScheduledMinute('15:40'), 940);
assert.equal(context.itineraryScheduledMinute('25:10'), null);
assert.equal(context.itineraryScheduledMinute('sem horário'), null);

function paint(hour, minute) {
  vm.runInContext('updateCurrentItineraryTime(new Date(2026, 10, 20, ' + hour + ', ' + minute + '))', context);
}
paint(12, 45);
assert.deepEqual(agenda.children.filter(x => x.dataset.agendaTime).map(x => x.dataset.timePast),
  ['true', 'true', 'false', 'false'], 'only elapsed activities fade');
let marker = agenda.children.find(x => x.className === 'day-now-marker');
assert.ok(marker, 'red current-time marker is inserted');
assert.equal(marker.children[0].textContent, '12:45');
assert.equal(agenda.children.indexOf(marker), 2, 'marker precedes next appointment');

let overviewMarker = summary.children.find(x => x.className === 'trip-now-marker');
assert.ok(overviewMarker, 'overview shows one clock marker');
assert.equal(summary.children.indexOf(overviewMarker), 1, 'overview marker precedes its next activity');
assert.equal(summary.children[0].dataset.timePast, 'true');

paint(18, 0);
marker = agenda.children.find(x => x.className === 'day-now-marker');
assert.equal(agenda.children.indexOf(marker), 3, 'marker moves as time passes');
assert.equal(agenda.children.filter(x => x.className === 'day-now-marker').length, 1, 'never duplicate line');

paint(23, 59);
marker = agenda.children.find(x => x.className === 'day-now-marker');
assert.equal(agenda.children.indexOf(marker), 4, 'after last appointment the line remains visible');

vm.runInContext('updateCurrentItineraryTime(new Date(2026, 10, 21, 8, 0))', context);
assert.equal(agenda.children.some(x => x.className === 'day-now-marker'), false, 'no marker outside today');
assert.equal(summary.children.some(x => x.className === 'trip-now-marker'), false, 'overview clock is also date-scoped');
assert.ok(agenda.children.every(x => x.dataset.timePast === undefined), 'no opacity outside today');

assert.ok(css.includes('.day-view-agenda-item[data-time-past="true"]'));
assert.ok(css.includes('.day-view-agenda .day-now-marker'));
assert.ok(css.includes('.trip-day-period .trip-now-marker'));
console.log('PASS: live itinerary time, faded entries, marker placement, and date scoping');
