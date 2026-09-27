const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('function tripFileSize(');
const end = source.indexOf('\nasync function loadTripFiles(', start);
assert.ok(start >= 0 && end > start);

function element(tagName) {
  const attributes = {};
  const listeners = new Map();
  return {
    tagName, children: [], dataset: {}, textContent: '', value: '', style: { setProperty() {} },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    setAttribute(name, value) { attributes[name] = value; },
    getAttribute(name) { return attributes[name] || (name === 'src' ? this.src : undefined); },
    fire(type, event = {}) { return listeners.get(type)?.(event); }
  };
}

const days = [
  { id: 'one', trip_id: 'trip', position: 0, title: 'Partida' },
  { id: 'two', trip_id: 'trip', position: 1, title: 'Chegada' }
];
const attachment = (id, dayId, mimeType = 'image/jpeg') => ({
  id, day_id: dayId, file_name: id + '.jpg', mime_type: mimeType,
  size_bytes: 2048, signedUrl: 'https://example.test/' + id
});
const files = [attachment('passagem', null, 'application/pdf'), attachment('foto1', 'one'),
  attachment('foto2', 'one'), attachment('foto3', 'one'), attachment('hotel', 'two')];
const pick = element('label');
const daySelect = element('select');
const filesInput = { closest() { return pick; } };
let editing = true;
let openedDay = null;
const context = {
  state: { activeTripId: 'trip', tripFilesByTrip: new Map([['trip', files]]), tripFileDeckIndexes: new Map() },
  dom: { tripFilesDay: daySelect, tripFilesList: element('div'), tripFilesInput: filesInput },
  document: { createElement: element },
  canEditActiveTrip: () => editing,
  dayNumber: day => day.position + 1,
  derivedDayDate: () => '2026-11-18',
  displayDate: date => date,
  openDayPage: id => { openedDay = id; },
  removeDayAttachment() {}
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
context.renderTripFiles('trip', days);

assert.equal(daySelect.children[0].value, '', 'a file starts without an associated day');
assert.equal(daySelect.value, '');
assert.equal(pick.hidden, false);
assert.equal(context.dom.tripFilesList.children.length, 3, 'general files and each day form separate groups');
const [general, firstDay] = context.dom.tripFilesList.children;
assert.equal(general.children[0].textContent, 'Arquivos da viagem');
assert.equal(general.children[1].children[1].children[0].textContent, 'passagem.jpg');
assert.equal(general.children[1].children[1].children[1].textContent, '2 KB');
assert.equal(firstDay.children[0].children[1].textContent, '3 arquivos');
const deck = firstDay.children[1];
const [previous, position, next] = firstDay.children[2].children;
assert.equal(deck.children.length, 3);
assert.equal(deck.children[0].dataset.position, 'current');
assert.equal(deck.children[1].dataset.position, 'queued');
assert.equal(deck.children[1].inert, true, 'only the front card can be opened');
assert.equal(position.textContent, '1 de 3');
assert.equal(previous.disabled, true);
next.fire('click');
assert.equal(position.textContent, '2 de 3');
assert.equal(deck.children[1].dataset.position, 'current');

deck.fire('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 230, clientY: 90 });
deck.fire('pointerup', { pointerId: 1, clientX: 90, clientY: 92, preventDefault() {} });
assert.equal(position.textContent, '3 de 3', 'swiping left reveals the next card');
assert.equal(next.disabled, true);
deck.fire('keydown', { key: 'ArrowLeft', preventDefault() {} });
assert.equal(position.textContent, '2 de 3', 'keyboard navigation also works');

context.renderTripFiles('trip', days);
assert.equal(context.dom.tripFilesList.children[1].children[2].children[1].textContent, '2 de 3',
  'the selected card survives a data refresh');
context.dom.tripFilesList.children[1].children[0].children[0].fire('click');
assert.equal(openedDay, 'one');

editing = false;
context.renderTripFiles('trip', days);
assert.equal(pick.hidden, true);
assert.equal(context.dom.tripFilesList.children[0].children[1].children.length, 2,
  'a viewer cannot delete trip-wide files');
assert.equal(context.dom.tripFilesList.children[1].children[1].children[0].children.length, 1,
  'a viewer cannot delete files in the deck');

const uploadStart = source.indexOf('async function uploadTripFiles(files)');
const uploadEnd = source.indexOf('\nasync function openTrip(', uploadStart);
assert.ok(uploadStart >= 0 && uploadEnd > uploadStart);
const stored = [];
const uploadContext = {
  state: { activeTripId: 'trip', tripDays: days },
  dom: { tripFilesDay: { value: '' }, tripFilesStatus: {}, tripFilesInput: { value: '', closest: () => ({ dataset: {} }) } },
  canEditActiveTrip: () => true,
  trySupabase: async () => ({}),
  setTripPanelStatus() {},
  storeTripAttachment: async (_client, tripId, dayId, file) => { stored.push([tripId, dayId, file.name]); },
  loadTripFiles: async () => {}
};
vm.createContext(uploadContext);
vm.runInContext(source.slice(uploadStart, uploadEnd), uploadContext);
(async () => {
  await uploadContext.uploadTripFiles([{ name: 'livre.pdf' }]);
  uploadContext.dom.tripFilesDay.value = 'two';
  await uploadContext.uploadTripFiles([{ name: 'vinculado.pdf' }]);
  assert.deepEqual(stored, [['trip', null, 'livre.pdf'], ['trip', 'two', 'vinculado.pdf']]);
  console.log('PASS: trip files allow no day and day decks swipe, persist position and respect view-only access');
})().catch(error => { console.error(error); process.exitCode = 1; });
