const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('function setDayMapExpanded(');
const end = source.indexOf('\n}\n', start);
assert.ok(start >= 0 && end > start);

const calls = [];
const label = { textContent: '' };
const map = {
  invalidateSize: options => calls.push(['resize', options.pan]),
  fitBounds: bounds => calls.push(['bounds', bounds.length])
};
const pageContent = {};
const section = {
  dataset: {}, parent: pageContent,
  replaceWith(node) { node.parent = this.parent; this.parent = null; }
};
const body = {
  dataset: { dayPage: 'open' },
  append(node) { node.parent = this; }
};
const context = vm.createContext({
  dom: {
    dayMapSection: section,
    dayMapScrim: { hidden: true },
    dayPage: { inert: false },
    dayMapToggle: {
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelector() { return label; }
    }
  },
  state: { dayMap: map, dayMapBounds: [[48.86, 2.34], [48.87, 2.35]] },
  document: {
    body,
    createComment() {
      return { replaceWith(node) { node.parent = this.parent; this.parent = null; } };
    }
  },
  requestAnimationFrame(callback) { callback(); }
});
vm.runInContext(source.slice(start, end + 2), context);
context.setDayMapExpanded(true);
assert.equal(context.dom.dayMapSection.dataset.expanded, 'true');
assert.equal(section.parent, body);
assert.equal(context.dom.dayMapScrim.hidden, false);
assert.equal(context.dom.dayPage.inert, true);
assert.equal(context.dom.dayMapToggle.attributes['aria-expanded'], 'true');
assert.equal(context.dom.dayMapToggle.attributes['aria-label'], 'Reduzir mapa');
assert.equal(label.textContent, 'Reduzir');
context.setDayMapExpanded(false);
assert.equal(section.parent, pageContent);
assert.equal(context.dom.dayMapScrim.hidden, true);
assert.equal(context.dom.dayPage.inert, false);
assert.equal(context.dom.dayMapToggle.attributes['aria-label'], 'Ampliar mapa');
assert.deepEqual(calls.map(call => call[0]), ['resize', 'bounds', 'resize', 'bounds']);
assert.equal(context.state.dayMap, map); // A camada Leaflet não é recriada.

console.log('PASS: map expands and shrinks without discarding pins or route');
