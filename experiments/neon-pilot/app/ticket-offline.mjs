// Ingressos privados: metadados e bytes persistidos no aparelho por conta Neon.
// Não usar o service worker para guardar respostas autenticadas ou URLs blob:.
const DB_NAME = 'viaggio-private-tickets-v1';
const DB_VERSION = 1;
const urls = new Map();
let opening = null;
const keyFor = (userId, value) => JSON.stringify([String(userId), String(value)]);

function openDb() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('manifests')) db.createObjectStore('manifests', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Armazenamento de ingressos bloqueado por outra versão do Viaggio.'));
  }).catch(error => { opening = null; throw error; });
  return opening;
}

async function read(store, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
async function write(store, record, remove = false) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    if (remove) tx.objectStore(store).delete(record.key);
    else tx.objectStore(store).put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Gravação local cancelada.'));
  });
}
function valid(userId, value) {
  return Boolean(userId && typeof value === 'string' && value.length > 0);
}
function cleanFile(file) {
  const {signedUrl, cardSignedUrl, offlineReady, ...metadata} = file;
  return metadata;
}
export async function readTicketManifest(userId, tripId) {
  if (!valid(userId, tripId)) return null;
  const result = await read('manifests', keyFor(userId, tripId));
  return result ? result.files : null; // null = nunca sincronizado; [] = sincronizado sem arquivos
}
export async function writeTicketManifest(userId, tripId, files) {
  if (!valid(userId, tripId) || !Array.isArray(files)) return false;
  await write('manifests', {
    key: keyFor(userId, tripId),
    files: files.map(cleanFile),
    updatedAt: new Date().toISOString()
  });
  return true;
}
export async function readTicketBlob(userId, path) {
  if (!valid(userId, path)) return null;
  return (await read('documents', keyFor(userId, path)))?.blob || null;
}
export async function hasTicketBlob(userId, path) {
  if (!valid(userId, path)) return false;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly');
    const request = tx.objectStore('documents').getKey(keyFor(userId, path));
    request.onsuccess = () => resolve(request.result !== undefined);
    request.onerror = () => reject(request.error);
  });
}
export async function writeTicketBlob(userId, path, blob) {
  if (!valid(userId, path) || !(blob instanceof Blob) || !blob.size) return false;
  if (await hasTicketBlob(userId, path)) return true;
  await write('documents', { key:keyFor(userId, path), blob, savedAt:Date.now() });
  return true;
}
export async function deleteTicketBlob(userId, path) {
  if (!valid(userId, path)) return;
  const key = keyFor(userId, path);
  if (urls.has(key)) { URL.revokeObjectURL(urls.get(key)); urls.delete(key); }
  await write('documents', {key}, true);
}
export async function ticketObjectUrl(userId, path) {
  if (!valid(userId, path)) return '';
  const key = keyFor(userId, path);
  if (urls.has(key)) return urls.get(key);
  const blob = await readTicketBlob(userId, path);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  urls.set(key, url);
  return url;
}
export function revokeTicketObjectUrls() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
