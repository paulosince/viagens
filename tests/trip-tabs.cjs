const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
for (const tab of ['roteiro', 'orcamento', 'arquivos']) {
  assert.match(html, new RegExp(`id="trip_tab_${tab}"[^>]+aria-controls="trip_panel_${tab}"`));
  assert.match(html, new RegExp(`id="trip_panel_${tab}"[^>]+role="tabpanel"`));
}
assert.match(css, /\.trip-page-content\[hidden\] \{ display: none !important/);
assert.ok(html.indexOf('<nav class="trip-tabs"') > html.indexOf('id="trip_files_list"'), 'floating tab bar follows scrollable trip content');
assert.match(html, /class="trip-tab-indicator" aria-hidden="true"/);
assert.match(css, /\.trip-tabs \{ position: fixed; z-index: 61; bottom: calc\(12px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(css, /backdrop-filter: blur\(30px\) saturate\(185%\)/);
assert.match(css, /\.trip-tab-indicator \{[^}]+transition: transform/);
assert.match(css, /body\[data-trip-permission="viewer"\] #budget_add/);
assert.match(css, /body\[data-trip-permission="viewer"\] \.trip-files-upload/);

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('function tripMoney(');
const end = source.indexOf('\nfunction renderTripBudget(', start);
assert.ok(start >= 0 && end > start);
const context = { Intl, Number, Error, Map };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const totals = context.summarizeTripBudget([
  { currency: 'BRL', planned_amount: 100, actual_amount: null, purchase_status: 'pending' },
  { currency: 'BRL', planned_amount: 80, actual_amount: 75, purchase_status: 'purchased' },
  { currency: 'EUR', planned_amount: 50, actual_amount: 43, purchase_status: 'purchased' }
]);
assert.equal(totals.get('BRL').planned, 180);
assert.equal(totals.get('BRL').paid, 75);
assert.equal(totals.get('BRL').toBuy, 100);
assert.equal(totals.get('EUR').paid, 43);
assert.equal(context.amountFromInput('22,50'), 22.5);
assert.equal(context.amountFromInput(''), null);
assert.throws(() => context.amountFromInput('99,999'), /duas casas/);

const tabStart = source.indexOf('function selectTripTab(');
const tabEnd = source.indexOf('\nfunction setTripPanelStatus(', tabStart);
const selected = Object.fromEntries(['roteiro', 'orcamento', 'arquivos'].map(name => [name, { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } }]));
const panels = Object.fromEntries(['roteiro', 'orcamento', 'arquivos'].map(name => [name, { hidden: name !== 'roteiro', dataset: {} }]));
const navStyle = {};
const tabsContext = { state: { activeTripId: 'trip', activeTripTab: 'roteiro', tripTabScroll: new Map() }, dom: { tripPage: { scrollTop: 618 }, tripPageHero: { offsetHeight: 390 }, tripTabs: { style: { setProperty(key, value) { navStyle[key] = value; } } }, tripPanels: panels }, document: { querySelector(selector) { return selected[selector.slice('#trip_tab_'.length)]; } }, requestAnimationFrame(callback) { callback(); }, loadTripBudget: async () => {}, loadTripFiles: async () => {}, setTripPanelStatus() {} };
vm.createContext(tabsContext);
vm.runInContext(source.slice(tabStart, tabEnd), tabsContext);
tabsContext.selectTripTab('orcamento');
assert.equal(tabsContext.state.tripTabScroll.get('trip:roteiro'), 618);
assert.equal(tabsContext.dom.tripPage.scrollTop, 390);
assert.equal(panels.roteiro.hidden, true);
assert.equal(navStyle['--active-index'], '1');
assert.equal(panels.orcamento.dataset.enter, 'next');
assert.equal(selected.orcamento.attributes['aria-selected'], 'true');
tabsContext.dom.tripPage.scrollTop = 920;
tabsContext.selectTripTab('roteiro');
assert.equal(tabsContext.dom.tripPage.scrollTop, 618, 'returning to itinerary restores its reading position');
assert.equal(tabsContext.state.tripTabScroll.get('trip:orcamento'), 920);
assert.equal(navStyle['--active-index'], '0');
assert.equal(panels.roteiro.dataset.enter, 'previous');

assert.match(source, /\.from\('day_attachments'\)\.select\('\*'\)\.in\('day_id'/);
assert.match(source, /await storeDayAttachment\(client, day, file\)/);
assert.match(source, /if \(!canEditActiveTrip\(\)\) return;\s+const tripId = String\(state.activeTripId\);\s+const form = event.currentTarget;/);
console.log('PASS: trip tabs, per-currency totals, edit permissions and shared day files');
