const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/main.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
for (const id of ['trip_file_viewer', 'trip_file_viewer_media', 'trip_file_viewer_title',
  'trip_file_viewer_status', 'close_trip_file_viewer', 'delete_trip_file_viewer']) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} must exist at startup`);
}
const start = source.indexOf('function tripFileSize(');
const end = source.indexOf('\nfunction renderTripFileDeck(', start);
assert.ok(start >= 0 && end > start);

let downloads = 0;
function element(tagName) {
  const listeners = new Map();
  return {
    tagName, children: [], dataset: {}, open: false, hidden: false, isConnected: true,
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } },
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
    addEventListener(type, listener) { listeners.set(type, listener); },
    setAttribute() {},
    focus() { this.focused = true; },
    click() { downloads += 1; },
    remove() {},
    fire(type, event = {}) { return listeners.get(type)?.(event); },
    showModal() { this.open = true; },
    close() { this.open = false; }
  };
}

const navigation = element('div');
const previous = element('button');
navigation.append(previous, element('span'), element('button'));
const viewer = element('dialog');
const dom = {
  tripFileViewer: viewer,
  tripFileViewerTitle: element('h2'), tripFileViewerMedia: element('div'),
  tripFileViewerStatus: element('p'), tripFileViewerDelete: element('button'),
  tripFileViewerPosition: element('span'), tripFileViewerPrevious: previous,
  tripFileViewerNext: navigation.children[2], closeTripFileViewer: element('button')
};
const image = { id: 'image', day_id: null, mime_type: 'image/jpeg', file_name: 'foto.jpg', size_bytes: 2048, signedUrl: 'https://example.test/image' };
const pdf = { id: 'pdf', day_id: null, mime_type: 'application/pdf', file_name: 'bilhete.pdf', size_bytes: 4096, signedUrl: 'https://example.test/pdf' };
const word = { id: 'word', day_id: null, mime_type: 'application/msword', file_name: 'reserva.doc', size_bytes: 1024, signedUrl: 'https://example.test/word' };
const requests = [];
const revoked = [];
let blobNumber = 0;
let editsAllowed = true;
let deletionResult = null;
let deletionAttempts = 0;
let backCalls = 0;
const window = {
  history: {
    state: { view: 'trip', tripId: 'trip' },
    pushState(state) { this.state = state; },
    replaceState(state) { this.state = state; },
    back() { backCalls++; this.state = { view: 'trip', tripId: 'trip' }; }
  },
  clearTimeout() {}, setTimeout() { return 1; }, matchMedia: () => ({ matches: true })
};
const context = {
  window, dom,
  document: { activeElement: element('button'), body: { dataset: { dayPage: 'closed' } }, createElement: element },
  state: { activeTripId: 'trip', activeDayId: null },
  URL: { createObjectURL: () => `blob:preview-${++blobNumber}`, revokeObjectURL: url => revoked.push(url) },
  fetch: async url => { requests.push(url); return { ok: true, blob: async () => ({}) }; },
  requestAnimationFrame: callback => callback(),
  canEditActiveTrip: () => editsAllowed,
  removeDayAttachment: async () => { deletionAttempts++; return deletionResult; }
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

(async () => {
  context.openTripFileViewer(image, [image, pdf, word]);
  assert.equal(viewer.open, true, 'the viewer uses a native modal that blocks the page underneath');
  assert.equal(viewer.dataset.visible, 'true');
  assert.equal(dom.tripFileViewerMedia.children[0].tagName, 'img');
  assert.equal(dom.tripFileViewerMedia.children[0].src, image.signedUrl);
  assert.equal(dom.tripFileViewerDelete.hidden, false);
  assert.equal(window.history.state.view, 'trip-file');

  context.showTripFileViewerIndex(1);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [pdf.signedUrl], 'the PDF bytes come from the existing file URL');
  assert.equal(dom.tripFileViewerMedia.children[0].tagName, 'iframe');
  assert.equal(dom.tripFileViewerMedia.children[0].src, 'blob:preview-1', 'the PDF stays inside the app');
  assert.equal(window.history.state.fileId, 'pdf');
  context.showTripFileViewerIndex(0);
  assert.deepEqual(revoked, ['blob:preview-1'], 'temporary previews are released when changing files');

  context.showTripFileViewerIndex(2);
  const fallback = dom.tripFileViewerMedia.children[0];
  assert.equal(fallback.children[0].textContent, 'DOC');
  await fallback.children[2].fire('click');
  assert.equal(downloads, 1, 'Word can be saved without opening a storage page');

  editsAllowed = false;
  context.showTripFileViewerIndex(0);
  assert.equal(dom.tripFileViewerDelete.hidden, true, 'view-only access cannot show delete');
  await context.deleteTripFileViewer();
  assert.equal(deletionAttempts, 0);

  editsAllowed = true;
  context.showTripFileViewerIndex(0);
  await context.deleteTripFileViewer();
  assert.equal(backCalls, 0, 'cancelled deletion leaves the viewer open');
  deletionResult = true;
  await context.deleteTripFileViewer();
  assert.equal(backCalls, 1, 'successful deletion returns through browser history');
  assert.equal(viewer.open, false, 'the viewer closes even if a PDF consumed browser history');
  context.closeTripFileViewer({ immediate: true });
  assert.equal(viewer.open, false);
  assert.equal(context.document.activeElement.focused, true);

  const dayStart = source.indexOf('function renderDayAttachments(dayId)');
  const dayEnd = source.indexOf('\nasync function loadDayAttachments(', dayStart);
  assert.ok(dayStart >= 0 && dayEnd > dayStart);
  let dayOpened = null;
  const dayContext = {
    state: { activeDayId: 'day', dayAttachments: new Map([['day', [{ ...image, day_id: 'day' }]]]) },
    dom: { dayAttachmentsCount: element('span'), dayAttachmentsList: element('ul') },
    document: { createElement: element, body: { dataset: { dayAttachments: 'open' } } },
    navigator: { onLine: true },
    openTripFileViewer: file => { dayOpened = file.id; },
    setDayAttachmentStatus() {}
  };
  vm.createContext(dayContext);
  vm.runInContext(source.slice(dayStart, dayEnd), dayContext);
  dayContext.renderDayAttachments('day');
  const row = dayContext.dom.dayAttachmentsList.children[0];
  assert.equal(row.children.length, 1, 'day files have no visible delete button either');
  assert.equal(row.children[0].tagName, 'button');
  row.children[0].fire('click');
  assert.equal(dayOpened, 'image');

  const removeStart = source.indexOf('async function removeDayAttachment(attachment)');
  const removeEnd = source.indexOf('\nfunction openDayPage(', removeStart);
  assert.ok(removeStart >= 0 && removeEnd > removeStart);
  let confirmAllowed = false;
  let edits = true;
  let removals = 0;
  const removalContext = {
    DAY_ATTACHMENT_BUCKET: 'day-attachments',
    canEditActiveTrip: () => edits,
    window: { confirm: () => confirmAllowed },
    trySupabase: async () => ({
      from: () => ({ delete: () => ({ eq: async () => { removals++; return { error: null }; } }) }),
      storage: { from: () => ({ remove: async () => ({ error: null }) }) }
    }),
    document: { body: { dataset: { dayAttachments: 'closed' } } },
    dom: { tripFilesStatus: element('p') },
    state: { activeTripTab: 'roteiro', activeTripId: 'trip' },
    setTripPanelStatus() {}, setDayAttachmentStatus() {}
  };
  vm.createContext(removalContext);
  vm.runInContext(source.slice(removeStart, removeEnd), removalContext);
  assert.equal(await removalContext.removeDayAttachment(image), null);
  assert.equal(removals, 0, 'cancelled confirmation never removes a file');
  confirmAllowed = true;
  assert.equal(await removalContext.removeDayAttachment(image), true);
  assert.equal(removals, 1, 'confirmed deletion removes one file');
  edits = false;
  assert.equal(await removalContext.removeDayAttachment(image), false);
  assert.equal(removals, 1, 'a viewer cannot remove a file even by invoking the handler');
  console.log('PASS: in-app file viewer previews photos/PDFs, blocks background, gates deletion and keeps day files safe');
})().catch(error => { console.error(error); process.exitCode = 1; });
