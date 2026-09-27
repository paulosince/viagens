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
assert.match(html, /id="budget_item_page"[^>]+aria-hidden="true"[^>]+inert/);
assert.match(html, /id="close_budget_item_page"[^>]+aria-label="Voltar ao orçamento"/);
assert.match(css, /\.budget-group-list \{[^}]+overflow: hidden; border-radius: 22px/);
assert.match(css, /\.budget-item:not\(:last-child\) \{ border-bottom: 1px solid/);
assert.match(css, /\.budget-item-check \{[^}]+width: 58px; min-height: 58px/);
assert.match(css, /\.budget-item-check-circle \{[^}]+width: 40px; height: 40px/);
assert.match(css, /body\[data-budget-page="open"\] \.budget-item-page \{[^}]+transform: translateX\(0\)/);

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
const estimatedPaid = context.summarizeTripBudget([{ currency: 'BRL', planned_amount: 70, actual_amount: null, purchase_status: 'purchased' }]);
assert.equal(estimatedPaid.get('BRL').paid, 70);
assert.equal(estimatedPaid.get('BRL').paidEstimate, true, 'paid totals identify when they include planned amounts');
assert.equal(context.amountFromInput('22,50'), 22.5);
assert.equal(context.amountFromInput(''), null);
assert.throws(() => context.amountFromInput('99,999'), /duas casas/);

function element(tagName) {
  return {
    tagName, children: [], dataset: {}, listeners: {}, attributes: {}, textContent: '',
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}
let opened;
let toggled;
context.document = { createElement: element };
context.dom = { budgetSummary: element('div'), budgetList: element('div') };
context.state = {
  activeTripId: 'trip', budgetByTrip: new Map([['trip', [
    { id: 1, category: 'Passeios', label: 'Disneyland', currency: 'BRL', planned_amount: 3334.86, actual_amount: 2908.21, purchase_status: 'purchased' },
    { id: 2, category: 'Passeios', label: 'Torre Eiffel', currency: 'BRL', planned_amount: 849.70, actual_amount: null, purchase_status: 'pending' },
    { id: 3, category: 'Transporte', label: 'Bilhetes', currency: 'EUR', planned_amount: 28, actual_amount: null, purchase_status: 'pending' }
  ]]])
};
context.canEditActiveTrip = () => true;
context.openBudgetEditor = item => { opened = item; };
context.toggleBudgetItem = (tripId, itemId) => { toggled = { tripId, itemId }; };
const renderStart = source.indexOf('function renderTripBudget(');
const renderEnd = source.indexOf('\nasync function loadTripBudget(', renderStart);
vm.runInContext(source.slice(renderStart, renderEnd), context);
context.renderTripBudget('trip');
assert.equal(context.dom.budgetList.children.length, 2, 'one container per category');
const group = context.dom.budgetList.children[0];
assert.equal(group.children[1].className, 'budget-group-list');
assert.equal(group.children[1].children.length, 2, 'items are rows inside a shared container');
const paid = group.children[1].children[0];
assert.equal(paid.children[0].tagName, 'button', 'the check is an independent button');
assert.equal(paid.children[0].attributes['aria-checked'], 'true');
assert.equal(paid.children[1].children[1].children[0].textContent, 'R$ 2.908,21', 'right side shows paid amount');
assert.equal(paid.children[1].children[1].children[1].className, 'budget-item-chevron');
paid.children[0].listeners.click();
assert.equal(toggled.itemId, 1, 'tapping the circle changes payment status');
assert.equal(opened, undefined, 'tapping the circle does not open the editor');
paid.children[1].listeners.click();
assert.equal(opened.id, 1, 'tapping a row opens the correct editor');
context.canEditActiveTrip = () => false;
context.renderTripBudget('trip');
const viewerRow = context.dom.budgetList.children[0].children[1].children[0];
assert.equal(viewerRow.tagName, 'div', 'viewer cannot open editor');
assert.equal(viewerRow.children[0].tagName, 'span', 'viewer cannot toggle payment');
assert.equal(viewerRow.children[1].tagName, 'div', 'viewer cannot open editor');
assert.equal(viewerRow.children[1].children[1].children.length, 1, 'viewer has no edit chevron');

const editorStart = source.indexOf('let budgetPageBackPending =');
const editorEnd = source.indexOf('\nasync function saveBudgetEditor(', editorStart);
let backCalls = 0;
const history = { state: { view: 'trip' }, pushState(state) { this.state = state; }, back() { backCalls++; } };
const fields = Object.fromEntries(['label', 'category', 'currency', 'purchase_status', 'planned_amount', 'actual_amount'].map(name => [name, { value: '' }]));
const editorForm = { elements: { namedItem(name) { return fields[name]; } }, addEventListener() {}, querySelector() { return { addEventListener() {} }; } };
const attrs = () => ({ inert: false, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } });
const page = attrs();
const tabs = attrs();
const tripPage = attrs();
let focusCalls = 0;
const editorContext = {
  document: { body: { dataset: { tripPage: 'open', dayPage: 'closed', budgetPage: 'closed' } }, createElement() { return editorForm; } },
  window: { history },
  state: { activeTripId: 'trip' },
  canEditActiveTrip: () => true,
  dom: { budgetPage: page, tripTabs: tabs, tripPage, budgetPageTitle: {}, budgetPageMessage: {},
    budgetEditor: element('div'), closeBudgetPage: { focus() { focusCalls++; } } }
};
vm.createContext(editorContext);
vm.runInContext(source.slice(editorStart, editorEnd), editorContext);
editorContext.openBudgetEditor({ id: 1, label: 'Disneyland', currency: 'BRL' });
assert.equal(editorContext.document.body.dataset.budgetPage, 'open');
assert.equal(tripPage.inert, true, 'trip cannot receive taps while editor is visible');
assert.equal(tabs.inert, true, 'bottom tabs cannot receive taps while editor is visible');
assert.equal(fields.label.value, 'Disneyland');
assert.equal(history.state.view, 'budget-item');
assert.equal(focusCalls, 1, 'focus moves to the editor navigation');
editorContext.navigateBackFromBudget();
editorContext.navigateBackFromBudget();
assert.equal(backCalls, 1, 'repeated taps cannot navigate past the trip');
editorContext.closeBudgetPage();
assert.equal(editorContext.document.body.dataset.budgetPage, 'closed');
assert.equal(tripPage.inert, false);
assert.equal(tabs.inert, false);

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

assert.match(source, /\.from\('day_attachments'\)\.select\('\*'\)\.eq\('trip_id', key\)/);
assert.match(source, /await storeTripAttachment\(client, tripId, day\?\.id \|\| null, file\)/);
assert.match(source, /if \(!canEditActiveTrip\(\)\) return;\s+const tripId = String\(state.activeTripId\);\s+const form = event.currentTarget;/);
console.log('PASS: trip tabs, per-currency totals, edit permissions and shared day files');
