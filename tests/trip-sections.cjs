const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, `${name} exists`);
  return source.slice(start, end + 2);
}

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.dataset = {};
    this.children = [];
    this.attrs = {};
    this.listeners = {};
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node);
      this.children.push(node);
      node.parent = this;
    }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...nodes);
  }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  get childElementCount() { return this.children.length; }
  querySelectorAll(selector) {
    assert.equal(selector, 'li[data-trip-id]');
    const found = [];
    const visit = node => {
      for (const child of node.children) {
        if (child.tagName === 'LI' && child.dataset.tripId) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
}

const date = offset => {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
};
const trip = (id, start, end) => ({ id, start_date: date(start), end_date: date(end) });
const state = {
  user: { id: 'user' }, selectedYear: new Date().getFullYear(),
  trips: [trip('past', -90, -60), trip('next', 60, 90), trip('current', -30, 30)],
  collapsedTripSections: new Set(), selectedTripIds: new Set()
};
const dom = { tripList: new Node('ol'), homeEmpty: new Node('section'), deleteSelectedTrips: new Node('button') };
const context = {
  state, dom, document: { createElement: tag => new Node(tag) },
  tripEndDate: item => item.end_date,
  createTripNode(item) {
    const node = new Node('li');
    node.dataset.tripId = item.id;
    node._refs = { selection: new Node('span'), button: new Node('button') };
    return node;
  },
  updateTripNode() {}
};
vm.createContext(context);
vm.runInContext([
  'tripDateRange', 'tripListGroup', 'compareTripsForHome',
  'setTripSectionCollapsed', 'createTripSection', 'syncTripSelectionUI', 'syncTripList'
].map(extract).join('\n'), context);

context.syncTripList();
const sections = dom.tripList.children;
assert.deepEqual(sections.map(section => section.dataset.tripSection), ['current', 'upcoming', 'past']);
assert.deepEqual(sections.map(section => section._refs.count.textContent), ['1', '1', '1']);
const upcoming = sections[1];
upcoming._refs.button.listeners.click();
assert.equal(upcoming.attrs['aria-expanded'], undefined);
assert.equal(upcoming._refs.button.attrs['aria-expanded'], 'false');
assert.equal(upcoming._refs.content.inert, true);
state.trips.push(trip('next2', 70, 100));
context.syncTripList();
assert.equal(dom.tripList.children[1], upcoming);
assert.equal(upcoming._refs.count.textContent, '2');
assert.equal(upcoming.dataset.collapsed, 'true');
upcoming._refs.button.listeners.click();
assert.equal(upcoming._refs.button.attrs['aria-expanded'], 'true');
assert.equal(upcoming._refs.content.inert, false);
assert.match(css, /transition: grid-template-rows .* opacity/);

console.log('PASS: trip group totals, collapse state, reusable cards and CSS transition');
