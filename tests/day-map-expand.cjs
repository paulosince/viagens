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
  fitBounds: bounds => calls.push(['bounds', bounds.length]),
  remove: () => calls.push(['removed'])
};
const pageContent = {};
const section = { dataset: {}, parent: pageContent };
const background = [{ inert: false }, { inert: false }, { inert: false }];
const context = vm.createContext({
  dom: {
    dayMapSection: section,
    dayPage: { dataset: {}, scrollTop: 1340, querySelectorAll() { return background; }, setAttribute(name, value) { this[name] = value; } },
    dayMapToggle: {
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelector() { return label; }
    }
  },
  state: { dayMap: map, dayMapBounds: [[48.86, 2.34], [48.87, 2.35]], dayMapScrollTop: null, dayMapRenderToken: 0, activeDayId: 'day-1' },
  document: { body: { dataset: { dayPage: 'open' } } },
  closeDayAttachments() {},
  requestAnimationFrame(callback) { callback(); }
});
vm.runInContext(source.slice(start, end + 2), context);
const closeStart = source.indexOf('function closeDayPage(');
const closeEnd = source.indexOf('\n}\n', closeStart);
vm.runInContext(source.slice(closeStart, closeEnd + 2), context);
context.setDayMapExpanded(true);
assert.equal(context.dom.dayMapSection.dataset.expanded, 'true');
assert.equal(section.parent, pageContent);
assert.equal(context.dom.dayPage.scrollTop, 0);
assert.equal(context.dom.dayPage.dataset.mapExpanded, 'true');
assert.ok(background.every(node => node.inert));
assert.equal(context.dom.dayMapToggle.attributes['aria-expanded'], 'true');
assert.equal(context.dom.dayMapToggle.attributes['aria-label'], 'Reduzir mapa');
assert.equal(label.textContent, 'Reduzir');
context.setDayMapExpanded(false);
assert.equal(section.parent, pageContent);
assert.equal(context.dom.dayPage.scrollTop, 1340);
assert.ok(background.every(node => !node.inert));
assert.equal(context.dom.dayMapToggle.attributes['aria-label'], 'Ampliar mapa');
assert.deepEqual(calls.map(call => call[0]), ['resize', 'bounds', 'resize', 'bounds']);
assert.equal(context.state.dayMap, map); // A camada Leaflet não é recriada.

context.setDayMapExpanded(true);
context.closeDayPage();
assert.equal(context.dom.dayPage.inert, true);
assert.equal(context.dom.dayPage['aria-hidden'], 'true');
assert.equal(context.document.body.dataset.dayPage, 'closed');
assert.equal(context.dom.dayMapSection.dataset.expanded, 'false');
assert.ok(background.every(node => !node.inert));
assert.equal(context.state.activeDayId, null);
assert.equal(context.state.dayMap, null);
assert.ok(calls.some(call => call[0] === 'removed'));

console.log('PASS: map expands and shrinks without discarding pins or route');
