const DB_NAME = 'viaggio-local';
const DB_VERSION = 1;

let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'user_id' });

      if (!db.objectStoreNames.contains('trips')) {
        const store = db.createObjectStore('trips', { keyPath: 'id' });
        store.createIndex('cache_user_id', '__cache_user_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('passengers')) {
        const store = db.createObjectStore('passengers', { keyPath: 'id' });
        store.createIndex('trip_id', 'trip_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('trip_days')) {
        const store = db.createObjectStore('trip_days', { keyPath: 'id' });
        store.createIndex('trip_id', 'trip_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('day_locations')) {
        const store = db.createObjectStore('day_locations', { keyPath: 'id' });
        store.createIndex('day_id', 'day_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('activities')) {
        const store = db.createObjectStore('activities', { keyPath: 'id' });
        store.createIndex('day_id', 'day_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { keyPath: 'id' });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('O armazenamento local está bloqueado por outra versão do app.'));
  });
  return dbPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transação local cancelada.'));
  });
}

async function get(storeName, key) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestResult(tx.objectStore(storeName).get(key));
}

async function getAllByIndex(storeName, indexName, value) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestResult(tx.objectStore(storeName).index(indexName).getAll(value));
}

async function getAllKeysByIndex(storeName, indexName, value) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestResult(tx.objectStore(storeName).index(indexName).getAllKeys(value));
}

async function setMeta(key, value) {
  const db = await openDb();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ key, value });
  await transactionDone(tx);
}

async function getMeta(key) {
  return (await get('meta', key))?.value ?? null;
}

async function cacheSession(user) {
  if (!user?.id) return;
  await setMeta('session_user', {
    id: user.id,
    email: user.email || '',
    created_at: user.created_at || null,
    user_metadata: user.user_metadata || {}
  });
}

async function clearSession() {
  const db = await openDb();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').delete('session_user');
  await transactionDone(tx);
}

async function getCachedSession() {
  return getMeta('session_user');
}

async function saveProfile(profile) {
  if (!profile?.user_id) return;
  const db = await openDb();
  const tx = db.transaction('profiles', 'readwrite');
  tx.objectStore('profiles').put(profile);
  await transactionDone(tx);
}

async function getProfile(userId) {
  if (!userId) return null;
  return (await get('profiles', userId)) || null;
}

async function replaceWorkspace(cacheUserId, trips, passengers) {
  if (!cacheUserId) return;

  const oldTrips = await getAllByIndex('trips', 'cache_user_id', cacheUserId);
  const oldTripIds = oldTrips.map(trip => String(trip.id));
  const oldPassengerKeys = [];
  for (const tripId of oldTripIds) {
    oldPassengerKeys.push(...await getAllKeysByIndex('passengers', 'trip_id', tripId));
  }

  const db = await openDb();
  const tx = db.transaction(['trips', 'passengers'], 'readwrite');
  const tripStore = tx.objectStore('trips');
  const passengerStore = tx.objectStore('passengers');

  for (const trip of oldTrips) tripStore.delete(trip.id);
  for (const key of oldPassengerKeys) passengerStore.delete(key);
  for (const trip of trips || []) tripStore.put({ ...trip, __cache_user_id: cacheUserId });
  for (const passenger of passengers || []) passengerStore.put(passenger);

  await transactionDone(tx);
  await setMeta('workspace_updated_at', new Date().toISOString());
}

async function loadWorkspace(cacheUserId) {
  if (!cacheUserId) return { trips: [], passengers: [] };
  const trips = await getAllByIndex('trips', 'cache_user_id', cacheUserId);
  const passengers = [];
  for (const trip of trips) {
    passengers.push(...await getAllByIndex('passengers', 'trip_id', String(trip.id)));
  }
  return {
    trips: trips.map(({ __cache_user_id, ...trip }) => trip),
    passengers
  };
}

async function replaceTripData(tripId, days, activities, locations) {
  if (!tripId) return;

  const oldDays = await getAllByIndex('trip_days', 'trip_id', String(tripId));
  const oldDayIds = oldDays.map(day => String(day.id));
  const oldActivityKeys = [];
  const oldLocationKeys = [];

  for (const dayId of oldDayIds) {
    oldActivityKeys.push(...await getAllKeysByIndex('activities', 'day_id', dayId));
    oldLocationKeys.push(...await getAllKeysByIndex('day_locations', 'day_id', dayId));
  }

  const db = await openDb();
  const tx = db.transaction(['trip_days', 'activities', 'day_locations'], 'readwrite');
  const dayStore = tx.objectStore('trip_days');
  const activityStore = tx.objectStore('activities');
  const locationStore = tx.objectStore('day_locations');

  for (const day of oldDays) dayStore.delete(day.id);
  for (const key of oldActivityKeys) activityStore.delete(key);
  for (const key of oldLocationKeys) locationStore.delete(key);
  for (const day of days || []) dayStore.put(day);
  for (const activity of activities || []) activityStore.put(activity);
  for (const location of locations || []) locationStore.put(location);

  await transactionDone(tx);
  await setMeta(`trip:${tripId}:updated_at`, new Date().toISOString());
}

async function loadTripData(tripId) {
  if (!tripId) return { days: [], activities: [], locations: [] };
  const days = await getAllByIndex('trip_days', 'trip_id', String(tripId));
  const orderValue = day => {
    const position = Number(day?.position);
    if (Number.isInteger(position) && position >= 0) return position;
    const legacy = Number(day?.day_number);
    return Number.isInteger(legacy) && legacy > 0 ? legacy - 1 : 0;
  };
  days.sort((a, b) => orderValue(a) - orderValue(b));

  const activities = [];
  const locations = [];
  for (const day of days) {
    activities.push(...await getAllByIndex('activities', 'day_id', String(day.id)));
    locations.push(...await getAllByIndex('day_locations', 'day_id', String(day.id)));
  }

  activities.sort((a, b) => (a.position || 0) - (b.position || 0));
  locations.sort((a, b) => (a.position || 0) - (b.position || 0));
  return { days, activities, locations };
}

async function saveDayBundle(day, activities, locations) {
  if (!day?.id) return;
  const dayId = String(day.id);
  const oldActivityKeys = await getAllKeysByIndex('activities', 'day_id', dayId);
  const oldLocationKeys = await getAllKeysByIndex('day_locations', 'day_id', dayId);

  const db = await openDb();
  const tx = db.transaction(['trip_days', 'activities', 'day_locations'], 'readwrite');
  const dayStore = tx.objectStore('trip_days');
  const activityStore = tx.objectStore('activities');
  const locationStore = tx.objectStore('day_locations');

  dayStore.put(day);
  for (const key of oldActivityKeys) activityStore.delete(key);
  for (const key of oldLocationKeys) locationStore.delete(key);
  for (const activity of activities || []) activityStore.put(activity);
  for (const location of locations || []) locationStore.put(location);

  await transactionDone(tx);
  await setMeta(`trip:${day.trip_id}:updated_at`, new Date().toISOString());
}

async function enqueueMutation(mutation) {
  const db = await openDb();
  const tx = db.transaction('outbox', 'readwrite');
  const record = {
    id: mutation.id || crypto.randomUUID(),
    created_at: mutation.created_at || new Date().toISOString(),
    ...mutation
  };
  tx.objectStore('outbox').put(record);
  await transactionDone(tx);
  return record;
}

async function listOutbox() {
  const db = await openDb();
  const tx = db.transaction('outbox', 'readonly');
  const records = await requestResult(tx.objectStore('outbox').getAll());
  return records.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

async function removeMutation(id) {
  const db = await openDb();
  const tx = db.transaction('outbox', 'readwrite');
  tx.objectStore('outbox').delete(id);
  await transactionDone(tx);
}

async function hasPendingForTrip(tripId) {
  const id = String(tripId);
  return (await listOutbox()).some(item => String(item.tripId || '') === id);
}

async function hasWorkspace(userId) {
  return (await loadWorkspace(userId)).trips.length > 0;
}

export const offlineStore = {
  open: openDb,
  cacheSession,
  clearSession,
  getCachedSession,
  saveProfile,
  getProfile,
  replaceWorkspace,
  loadWorkspace,
  replaceTripData,
  loadTripData,
  saveDayBundle,
  enqueueMutation,
  listOutbox,
  removeMutation,
  hasPendingForTrip,
  hasWorkspace,
  getMeta,
  setMeta
};
