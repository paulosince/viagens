import { offlineStore } from './offline-store.js';

const SUPABASE_URL = 'https://siabldasqinpfmxslwji.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UgbBIOq1TnInuPRrQpAFag_JLIzYuFf';
let supabase = null;
let supabaseLoad = null;
let leafletLoad = null;

async function ensureSupabase() {
  if (supabase) return supabase;
  if (supabaseLoad) return supabaseLoad;
  supabaseLoad = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
    .then(({ createClient }) => {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      return supabase;
    })
    .catch(error => {
      supabaseLoad = null;
      throw error;
    });
  return supabaseLoad;
}

async function trySupabase(timeoutMs = 1800) {
  if (!navigator.onLine) return null;
  try {
    return await Promise.race([
      ensureSupabase(),
      new Promise(resolve => setTimeout(() => resolve(null), timeoutMs))
    ]);
  } catch {
    return null;
  }
}
const profilePhoto = 'assets/cintia.png';
const placeSearchCache = new Map();
const TRIP_CACHE_FRESH_MS = 60_000;
let lastPlaceSearchAt = 0;

const state = {
  user: null,
  profile: null,
  trips: [],
  passengers: new Map(),
  selectedTripIds: new Set(),
  imageData: '',
  avatarFile: null,
  avatarPreview: '',
  selectedYear: null,
  saving: false,
  editing: false,
  tripColor: '#4775d1',
  newTripPassengers: [],
  editingTripId: null,
  activeTripId: null,
  activeDayId: null,
  tripDays: [],
  dayActivities: new Map(),
  dayLocations: new Map(),
  tripDataCache: new Map(),
  tripDataLoads: new Map(),
  activeTripDataVersion: 0,
  dayEditor: null,
  placeSearch: null,
  dayMap: null,
  dayMapRenderToken: 0,
  enrichingDays: new Set(),
  agendaSaveStates: new Map(),
  agendaSaveTimers: new Map(),
  agendaSaveQueues: new Map(),
  agendaSaveVersions: new Map(),
  daySaveStates: new Map(),
  daySaveTimers: new Map(),
  daySaveQueues: new Map(),
  daySaveVersions: new Map()
};

const dom = {
  splashStatus: document.querySelector('#splash_status'),
  authView: document.querySelector('#auth_view'), authForm: document.querySelector('#auth_form'), authMessage: document.querySelector('#auth_message'),
  home: document.querySelector('#user_home'), profileButton: document.querySelector('#profile_button'), headerProfileImage: document.querySelector('#header_profile_image'), headerProfileFallback: document.querySelector('#header_profile_fallback'),
  editTripsButton: document.querySelector('#edit_trips_button'), newTripButton: document.querySelector('#new_trip_button'), emptyNewTripButton: document.querySelector('#empty_new_trip_button'), sessionEmail: document.querySelector('#session_email'), syncStatus: document.querySelector('#sync_status'), tripHeading: document.querySelector('#trip_heading'), yearButton: document.querySelector('#year_selector_button'), currentYear: document.querySelector('#current_year'), yearMenu: document.querySelector('#year_menu'), yearList: document.querySelector('#year_list'),
  tripList: document.querySelector('#trip_list'), homeEmpty: document.querySelector('#home_empty'), scrim: document.querySelector('#sheet_scrim'), tripEditFooter: document.querySelector('#trip_edit_footer'), deleteSelectedTrips: document.querySelector('#delete_selected_trips'), tripPage: document.querySelector('#trip_page'), closeTripPage: document.querySelector('#close_trip_page'), editTripButton: document.querySelector('#edit_trip_button'), tripPageHero: document.querySelector('#trip_page_hero'), tripPageTitle: document.querySelector('#trip_page_title'), tripPageDates: document.querySelector('#trip_page_dates'), tripPagePassengers: document.querySelector('#trip_page_passengers'), tripPagePassengerCount: document.querySelector('#trip_page_passenger_count'), tripDayList: document.querySelector('#trip_day_list'), tripDayMessage: document.querySelector('#trip_day_message'),
  dayPage: document.querySelector('#day_page'), closeDayPage: document.querySelector('#close_day_page'), editDayButton: document.querySelector('#edit_day_button'), dayPageHero: document.querySelector('#day_page_hero'), dayPageBadge: document.querySelector('#day_page_badge'), dayPageTitle: document.querySelector('#day_page_title'), dayPageDate: document.querySelector('#day_page_date'), dayPageSaveStatus: document.querySelector('#day_page_save_status'), dayPagePhotoInput: document.querySelector('#day_page_photo_input'), dayPageCamera: document.querySelector('#day_page_camera'), dayPageAgenda: document.querySelector('#day_page_agenda'), dayPageEmpty: document.querySelector('#day_page_empty'), dayPageMap: document.querySelector('#day_page_map'), dayPageDirections: document.querySelector('#day_page_directions'),
  newTripSheet: document.querySelector('#home_new_trip'), newTripForm: document.querySelector('#new_trip_form'), newTripTitle: document.querySelector('#new-trip-title'), closeNewTrip: document.querySelector('#close_new_trip'), saveNewTrip: document.querySelector('#save_new_trip'), newTripMessage: document.querySelector('#new_trip_message'), coverInput: document.querySelector('#cover-image'), coverPreview: document.querySelector('#cover_preview_image'), tripColorValue: document.querySelector('#trip-color-value'), tripColorPalette: document.querySelector('#trip_color_palette'), tripColorCustom: document.querySelector('#trip-color-custom'), newTripPassengerList: document.querySelector('#new_trip_passenger_list'), addTripPassenger: document.querySelector('#add_trip_passenger'),
  dayEditSheet: document.querySelector('#day_edit_sheet'), daySheetScrim: document.querySelector('#day_sheet_scrim'), dayEditForm: document.querySelector('#day_edit_form'), closeDayEdit: document.querySelector('#close_day_edit'), saveDayEdit: document.querySelector('#save_day_edit'), dayEditTitle: document.querySelector('#day_edit_title'), dayEditDate: document.querySelector('#day_edit_date'), dayTitleInput: document.querySelector('#day-title-input'), dayLocationsEditor: document.querySelector('#day_locations_editor'), addDayLocation: document.querySelector('#add_day_location'), dayAgendaEditor: document.querySelector('#day_agenda_editor'), addDayActivity: document.querySelector('#add_day_activity'), dayNotesInput: document.querySelector('#day-notes-input'), dayEditMessage: document.querySelector('#day_edit_message'),
  placeSearchSheet: document.querySelector('#place_search_sheet'), placeSearchScrim: document.querySelector('#place_search_scrim'), placeSearchForm: document.querySelector('#place_search_form'), closePlaceSearch: document.querySelector('#close_place_search'), confirmPlaceSearch: document.querySelector('#confirm_place_search'), placeSearchInput: document.querySelector('#place_search_input'), runPlaceSearch: document.querySelector('#run_place_search'), placeSearchMessage: document.querySelector('#place_search_message'), placeSearchResults: document.querySelector('#place_search_results'), placePhotoSection: document.querySelector('#place_photo_section'), placePhotoMessage: document.querySelector('#place_photo_message'), placePhotoResults: document.querySelector('#place_photo_results'),
  profileSheet: document.querySelector('#profile-sheet'), profileForm: document.querySelector('#profile_form'), closeProfile: document.querySelector('#close_profile'), saveProfile: document.querySelector('#save_profile'), profileMessage: document.querySelector('#profile_message'), profileEditorImage: document.querySelector('#profile_editor_image'), profilePhotoInput: document.querySelector('#profile-photo'), profileDisplayName: document.querySelector('#profile_display_name'), profileEmail: document.querySelector('#profile_email'), profileNameInput: document.querySelector('#profile-name'), birthDateInput: document.querySelector('#birth-date'), profileAge: document.querySelector('#profile_age'), profileCreatedAt: document.querySelector('#profile_created_at'), logoutButton: document.querySelector('#logout_button'), deleteAccountButton: document.querySelector('#delete_account_button')
};

// As folhas são camadas globais. Fora da Home, não ficam presas ao contexto
// de empilhamento criado por transform/isolation daquele contêiner.
dom.tripPage.after(dom.scrim, dom.newTripSheet, dom.profileSheet);

const displayDate = value => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)).replace('.', '') : '';
const profileName = () => state.profile?.name || state.user?.user_metadata?.full_name || state.user?.user_metadata?.name || 'Cíntia';
const profileImage = () => state.avatarPreview || state.profile?.avatar_url || state.user?.user_metadata?.avatar_url || profilePhoto;

function ageFromBirthDate(value) {
  if (!value) return null;
  const birth = new Date(`${value}T12:00:00`), today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function tripTiming(trip) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(`${trip.start_date}T00:00:00`), end = new Date(`${trip.end_date}T23:59:59`);
  if (today > end) return 'viagem realizada';
  if (today >= start) return 'em andamento';
  const days = Math.ceil((start - today) / 86400000);
  return days === 1 ? 'amanhã' : `em ${days} dias`;
}

function dayTiming(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const target = Date.UTC(year, month - 1, day);
  const difference = Math.round((target - today) / 86400000);
  if (difference === 0) return { label: 'HOJE', today: true };
  if (difference === 1) return { label: 'em 1 dia', today: false };
  if (difference > 1) return { label: `em ${difference} dias`, today: false };
  if (difference === -1) return { label: 'há 1 dia', today: false };
  return { label: `há ${Math.abs(difference)} dias`, today: false };
}

function setSplashStatus(message) {
  if (dom.splashStatus) dom.splashStatus.textContent = message;
}

async function loadLocalWorkspace(user) {
  if (!user?.id) return false;

  setSplashStatus('Abrindo suas viagens salvas…');
  const [profile, workspace] = await Promise.all([
    offlineStore.getProfile(user.id),
    offlineStore.loadWorkspace(user.id)
  ]);

  state.profile = profile || {
    user_id: user.id,
    name: user.user_metadata?.name || user.user_metadata?.full_name || 'Cíntia',
    birth_date: null,
    avatar_path: null
  };
  state.trips = workspace.trips || [];
  applyPassengers(workspace.passengers || []);
  syncProfileUI();
  syncYearList();
  syncTripList();

  return state.trips.length > 0;
}

async function refreshWorkspaceInBackground() {
  if (!state.user) return;

  setTimeout(async () => {
    try {
      await flushOutbox().catch(error => console.warn('Fila local aguardando sincronização', error));
      await loadProfile();
      await loadTrips();
      await cacheCompleteWorkspace().catch(error => console.warn('Snapshot offline incompleto', error));
      await refreshSyncStatus();
    } catch (error) {
      console.warn('Atualização em segundo plano indisponível', error);
      await refreshSyncStatus().catch(() => {});
    }
  }, 0);
}

function setSessionView(session) {
  document.body.dataset.session = session;
  dom.authView.setAttribute('aria-hidden', String(session !== 'anonymous'));
  dom.home.setAttribute('aria-hidden', String(session !== 'authenticated'));
}

function setActiveSheet(name = 'none') {
  document.body.dataset.activeSheet = name;
  dom.newTripSheet.setAttribute('aria-hidden', String(name !== 'new-trip'));
  dom.profileSheet.setAttribute('aria-hidden', String(name !== 'profile'));
}

async function refreshSyncStatus() {
  if (!dom.syncStatus || !state.user) return;
  const [pending, snapshotAt] = await Promise.all([
    offlineStore.listOutbox().then(items => items.length).catch(() => 0),
    offlineStore.getMeta(`complete_snapshot:${state.user.id}`).catch(() => null)
  ]);

  if (!navigator.onLine) {
    dom.syncStatus.dataset.kind = 'offline';
    if (pending) {
      dom.syncStatus.textContent = `Salvo neste iPhone · ${pending} ${pending === 1 ? 'alteração pendente' : 'alterações pendentes'}`;
    } else {
      dom.syncStatus.textContent = snapshotAt ? 'Modo offline · roteiro disponível' : 'Modo offline · cópia incompleta';
    }
    return;
  }

  if (pending) {
    dom.syncStatus.dataset.kind = 'pending';
    dom.syncStatus.textContent = `Salvo neste iPhone · ${pending} ${pending === 1 ? 'alteração pendente' : 'alterações pendentes'}`;
    return;
  }

  if (!snapshotAt) {
    dom.syncStatus.dataset.kind = 'pending';
    dom.syncStatus.textContent = 'Cópia offline ainda não concluída';
    return;
  }

  dom.syncStatus.dataset.kind = 'synced';
  dom.syncStatus.textContent = 'Sincronizado · disponível offline';
}

function setLoading(button, loading) {
  button.disabled = loading;
  button.dataset.loading = String(loading);
  button.setAttribute('aria-busy', String(loading));
}

function setImage(image, fallback, source, label) {
  fallback.textContent = label?.trim()?.[0]?.toUpperCase() || '?';
  fallback.hidden = true;
  image.hidden = false;
  image.onload = () => { image.hidden = false; fallback.hidden = true; };
  image.onerror = () => { image.hidden = true; fallback.hidden = false; };
  image.src = source;
  image.alt = label || '';
}

function syncProfileUI() {
  const name = profileName(), image = profileImage(), birth = state.profile?.birth_date || '';
  setImage(dom.headerProfileImage, dom.headerProfileFallback, image, name);
  dom.profileButton.setAttribute('aria-label', `Abrir perfil de ${name}`);
  dom.sessionEmail.textContent = state.user?.email || '';
  dom.profileEditorImage.src = image;
  dom.profileEditorImage.alt = name;
  dom.profileDisplayName.textContent = name;
  dom.profileEmail.textContent = state.user?.email || '';
  dom.profileNameInput.value = name;
  dom.birthDateInput.value = birth;
  syncAge();
  dom.profileCreatedAt.textContent = state.user?.created_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(state.user.created_at)) : 'data indisponível';
}

function syncAge() {
  const age = ageFromBirthDate(dom.birthDateInput.value);
  dom.profileAge.textContent = age === null ? '—' : `${age} anos`;
}

function passengerImage(passenger) {
  const name = passenger.name || '';
  if (/c[ií]ntia/i.test(name)) return { src: profileImage(), position: '50% 46%' };
  if (/paulo/i.test(name)) return { src: 'assets/paulo.jpeg', position: '50% 50%' };
  return { src: passenger.photo_url || '', position: '50% 50%' };
}

function createPassengerNode(passenger) {
  const node = document.createElement('span');
  node.className = 'passenger-photo';
  const image = document.createElement('img');
  image.alt = '';
  const initial = document.createElement('span');
  initial.className = 'passenger-initial';
  node.append(image, initial);
  node._refs = { image, initial };
  updatePassengerNode(node, passenger);
  return node;
}

function updatePassengerNode(node, passenger) {
  node.dataset.passengerId = passenger.id || passenger.name;
  node.setAttribute('aria-label', passenger.name || 'Passageiro');
  const initial = passenger.name?.trim()?.[0]?.toUpperCase() || '?';
  node._refs.initial.textContent = initial;
  const picture = passengerImage(passenger);
  node._refs.image.style.objectPosition = picture.position;
  node._refs.image.onload = () => { node._refs.image.hidden = false; node._refs.initial.hidden = true; };
  node._refs.image.onerror = () => { node._refs.image.hidden = true; node._refs.initial.hidden = false; };
  if (picture.src) { node._refs.image.hidden = false; node._refs.initial.hidden = true; node._refs.image.src = picture.src; }
  else { node._refs.image.removeAttribute('src'); node._refs.image.hidden = true; node._refs.initial.hidden = false; }
}

function passengerRecordKey(passenger) {
  if (passenger.user_id) return `user:${passenger.user_id}`;
  return [passenger.name, passenger.birth_date, passenger.photo_url]
    .map(value => String(value || '').trim().toLocaleLowerCase('pt-BR'))
    .join('|');
}

function uniquePassengerRecords(passengers) {
  const keys = new Set();
  return passengers.filter(passenger => {
    const key = passengerRecordKey(passenger);
    if (!passenger.name?.trim() || keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function syncPassengerList(container, passengers) {
  passengers = uniquePassengerRecords(passengers);
  const wanted = new Set(passengers.slice(0, 5).map(item => String(item.id || item.name)));
  for (const node of [...container.querySelectorAll('.passenger-photo')]) if (!wanted.has(node.dataset.passengerId)) node.remove();
  for (const passenger of passengers.slice(0, 5)) {
    const key = String(passenger.id || passenger.name);
    let node = [...container.querySelectorAll('.passenger-photo')].find(item => item.dataset.passengerId === key);
    if (!node) node = createPassengerNode(passenger); else updatePassengerNode(node, passenger);
    container.insertBefore(node, container._count);
  }
  container._count.textContent = `${passengers.length} ${passengers.length === 1 ? 'passageiro' : 'passageiros'}`;
}

function dayTitle(day, activities = [], locations = []) {
  const firstLocation = locations[0];
  const firstPlace = activities.find(activity => activity.place_name) || activities[0];
  return day.title || firstPlace?.title || firstPlace?.place_name || firstLocation?.name || `Dia ${day.day_number}`;
}

function dayPhoto(day, activities = [], locations = []) {
  return day.photo_url || locations[0]?.photo_url || activities.find(activity => activity.photo_url)?.photo_url || '';
}

function activityTime(activity) {
  if (!activity?.starts_at) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(activity.starts_at));
}

function activityLocation(activity, locations = []) {
  return locations.find(location => String(location.id) === String(activity.place_id))
    || locations.find(location => location.name && location.name === activity.place_name)
    || null;
}

function numericCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function primaryActivityPlace(activity) {
  const explicit = String(activity?.place_name || '').trim();
  if (explicit) return explicit;
  const title = String(activity?.title || '').trim();
  if (!title) return '';
  return title
    .split(/\s+(?:e|&|\+)\s+/i)[0]
    .replace(/\s+[—–-]\s+.*$/, '')
    .trim();
}

function activityLooksGeocodable(activity) {
  const value = primaryActivityPlace(activity).toLocaleLowerCase('pt-BR');
  if (!value || value.length < 3) return false;
  return !/^(almo[cç]o|jantar|caf[eé]|lanche|check[- ]?in|check[- ]?out|deslocamento|transfer|voo|trem|metr[oô]|[oô]nibus|chegada|sa[ií]da)\b/.test(value);
}

async function loadLeaflet() {
  if (window.L?.map) return window.L;
  if (leafletLoad) return leafletLoad;

  leafletLoad = new Promise((resolve, reject) => {
    let stylesheet = document.querySelector('#leaflet_styles');
    if (!stylesheet) {
      stylesheet = document.createElement('link');
      stylesheet.id = 'leaflet_styles';
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      document.head.append(stylesheet);
    }

    const existing = document.querySelector('#leaflet_script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L), { once: true });
      existing.addEventListener('error', () => reject(new Error('Mapa indisponível.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet_script';
    script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => window.L?.map ? resolve(window.L) : reject(new Error('Mapa indisponível.'));
    script.onerror = () => reject(new Error('Mapa indisponível.'));
    document.head.append(script);
  }).catch(error => {
    leafletLoad = null;
    throw error;
  });

  return leafletLoad;
}

async function firstUnsplashPhoto(query) {
  if (!query || !navigator.onLine) return null;
  const client = await trySupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.functions.invoke('unsplash-photos', { body: { action: 'search', query } });
    if (error || data?.quotaExceeded) return null;
    const photo = data?.photos?.[0] || null;
    if (photo?.downloadLocation) {
      client.functions.invoke('unsplash-photos', { body: { action: 'track', downloadLocation: photo.downloadLocation } }).catch(() => {});
    }
    return photo;
  } catch {
    return null;
  }
}

async function enrichDayPage(day, activities, locations) {
  const dayId = String(day.id);
  if (!navigator.onLine || state.enrichingDays.has(dayId)) return;

  const candidates = activities.filter(activity => {
    const location = activityLocation(activity, locations);
    return (!location || !location.photo_url) && activityLooksGeocodable(activity);
  });
  if (!candidates.length) return;

  state.enrichingDays.add(dayId);
  try {
    const updatedActivities = activities.map(activity => ({ ...activity }));
    const updatedLocations = locations.map(location => ({ ...location }));
    let changed = false;
    let dayContext = '';
    const contextualLocation = updatedLocations.find(location => location.formatted_address);
    if (contextualLocation?.formatted_address) {
      dayContext = String(contextualLocation.formatted_address).split(',').slice(-3).join(',').trim();
    }

    for (const sourceActivity of candidates) {
      const activity = updatedActivities.find(item => String(item.id) === String(sourceActivity.id));
      if (!activity) continue;

      let location = activityLocation(activity, updatedLocations);
      let searchResult = null;

      if (!location) {
        const lat = numericCoordinate(activity.latitude);
        const lon = numericCoordinate(activity.longitude);

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          location = {
            id: crypto.randomUUID(),
            day_id: day.id,
            position: updatedLocations.length,
            name: activity.place_name || primaryActivityPlace(activity),
            provider: null,
            provider_place_id: null,
            formatted_address: activity.address || null,
            latitude: lat,
            longitude: lon,
            category: null,
            place_type: null,
            photo_provider: null,
            photo_author: null,
            photo_author_url: null,
            photo_source_url: null,
            photo_url: activity.photo_url || null
          };
          updatedLocations.push(location);
          changed = true;
        } else {
          const primaryQuery = primaryActivityPlace(activity);
          const contextualQuery = dayContext ? primaryQuery + ', ' + dayContext : primaryQuery;
          try {
            let results = await searchOpenStreetMap(contextualQuery);
            if (!results.length && contextualQuery !== primaryQuery) results = await searchOpenStreetMap(primaryQuery);
            searchResult = results[0] || null;
          } catch {
            searchResult = null;
          }
          if (!searchResult) continue;

          const address = searchResult.address || {};
          const city = address.city || address.town || address.village || address.municipality || '';
          const country = address.country || '';
          if (city || country) dayContext = [city, country].filter(Boolean).join(', ');

          location = {
            id: crypto.randomUUID(),
            day_id: day.id,
            position: updatedLocations.length,
            name: placeResultName(searchResult),
            provider: 'openstreetmap',
            provider_place_id: String(searchResult.osm_type) + '/' + String(searchResult.osm_id),
            formatted_address: searchResult.display_name || null,
            latitude: Number(searchResult.lat),
            longitude: Number(searchResult.lon),
            category: searchResult.category || searchResult.class || null,
            place_type: searchResult.type || null,
            photo_provider: null,
            photo_author: null,
            photo_author_url: null,
            photo_source_url: null,
            photo_url: activity.photo_url || null
          };
          updatedLocations.push(location);
          changed = true;
        }

        activity.place_id = location.id;
        activity.place_name = location.name;
        activity.address = location.formatted_address;
        activity.latitude = location.latitude;
        activity.longitude = location.longitude;
      }

      if (!location.photo_url) {
        const query = searchResult ? unsplashQuery(searchResult) : (location.name || primaryActivityPlace(activity));
        const photo = await firstUnsplashPhoto(query);
        if (photo?.imageUrl) {
          location.photo_url = photo.imageUrl;
          location.photo_provider = 'unsplash';
          location.photo_author = photo.author || null;
          location.photo_author_url = photo.authorUrl || null;
          location.photo_source_url = photo.sourceUrl || null;
          activity.photo_url = photo.imageUrl;
          changed = true;
        }
      } else if (!activity.photo_url) {
        activity.photo_url = location.photo_url;
        changed = true;
      }
    }

    if (!changed) return;

    const updatedDay = { ...day };

    await offlineStore.saveDayBundle(updatedDay, updatedActivities, updatedLocations);
    await offlineStore.enqueueMutation({
      type: 'save-day',
      tripId: String(day.trip_id || state.activeTripId),
      dayId: day.id,
      dayPatch: { status: day.status || 'planned' },
      locations: updatedLocations,
      activities: updatedActivities,
      removedLocationIds: [],
      removedActivityIds: []
    });
    await refreshSyncStatus();

    applyLocalDaySave(updatedDay, updatedActivities, updatedLocations);
    flushOutbox().catch(error => console.warn('Enriquecimento aguardando sincronização', error));
  } finally {
    state.enrichingDays.delete(dayId);
  }
}

function renderTripDays(days, activitiesByDay = new Map(), locationsByDay = new Map()) {
  dom.tripDayList.replaceChildren();
  const periodLabels = { morning: 'manhã', afternoon: 'tarde', night: 'noite' };
  for (const day of days) {
    const activities = activitiesByDay.get(String(day.id)) || [];
    const locations = locationsByDay.get(String(day.id)) || [];
    const firstLocation = locations[0];
    const photo = dayPhoto(day, activities, locations);
    const titleText = dayTitle(day, activities, locations);

    const card = document.createElement('li');
    card.className = 'trip-day-card';
    card.dataset.pressed = 'false';

    const image = document.createElement('div');
    image.className = 'trip-day-image';
    if (photo) image.style.backgroundImage = `url("${String(photo).replaceAll('"', '%22')}")`;

    const badge = document.createElement('div');
    badge.className = 'trip-day-badge';
    const label = document.createElement('span');
    label.className = 'trip-day-label';
    label.textContent = 'dia';
    const number = document.createElement('strong');
    number.className = 'trip-day-number';
    number.textContent = String(day.day_number);
    badge.append(label, number);
    const timingData = dayTiming(day.date);
    const timing = document.createElement('span');
    timing.className = 'trip-day-timing';
    timing.textContent = timingData.label;
    timing.dataset.today = String(timingData.today);
    image.append(badge, timing);
    if (firstLocation?.photo_provider === 'unsplash' && firstLocation.photo_author) {
      const credit = document.createElement('a');
      credit.className = 'trip-day-photo-credit';
      credit.href = `${firstLocation.photo_author_url || 'https://unsplash.com'}${(firstLocation.photo_author_url || '').includes('?') ? '&' : '?'}utm_source=viaggio&utm_medium=referral`;
      credit.target = '_blank';
      credit.rel = 'noopener';
      credit.textContent = `Foto: ${firstLocation.photo_author} · Unsplash`;
      credit.addEventListener('click', event => event.stopPropagation());
      image.append(credit);
    }

    const body = document.createElement('div');
    body.className = 'trip-day-body';
    const title = document.createElement('h2');
    title.textContent = titleText;
    const date = document.createElement('span');
    date.className = 'trip-day-date';
    date.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${day.date}T12:00:00`));
    body.append(title, date);

    const agenda = document.createElement('div');
    agenda.className = 'trip-day-agenda';
    for (const period of ['morning', 'afternoon', 'night']) {
      const periodActivities = activities.filter(activity => activity.period === period);
      if (!periodActivities.length) continue;
      const group = document.createElement('section');
      group.className = 'trip-day-period';
      const heading = document.createElement('h3');
      heading.textContent = periodLabels[period];
      const list = document.createElement('ol');
      for (const activity of periodActivities) {
        const item = document.createElement('li');
        if (activity.starts_at) {
          const time = document.createElement('time');
          time.textContent = activityTime(activity);
          item.append(time);
        }
        const text = document.createElement('span');
        text.textContent = activity.title || activity.place_name || 'Atividade';
        item.append(text);
        list.append(item);
      }
      group.append(heading, list);
      agenda.append(group);
    }
    if (agenda.childElementCount) body.append(agenda);
    const button = document.createElement('button');
    button.className = 'trip-day-card-button';
    button.type = 'button';
    const releasePress = () => { card.dataset.pressed = 'false'; };
    button.addEventListener('pointerdown', () => { card.dataset.pressed = 'true'; });
    button.addEventListener('pointerup', releasePress);
    button.addEventListener('pointercancel', releasePress);
    const empty = !day.title && !day.summary && !day.main_place_name && !day.photo_url && activities.length === 0 && locations.length === 0;
    button.setAttribute('aria-label', empty ? `Preencher dia ${day.day_number}` : `Abrir dia ${day.day_number}`);
    button.addEventListener('click', () => {
      button.blur();
      if (empty) openDayEditor(day);
      else openDayPage(day.id);
    });
    button.append(image, body);
    card.append(button);
    dom.tripDayList.append(card);
  }
  dom.tripDayMessage.textContent = days.length ? '' : 'Nenhum dia encontrado para esta viagem.';
}

function periodFromTime(time) {
  const hour = Number(String(time || '00:00').slice(0, 2));
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'night';
}

function syncDayActivityLocationSelects() {
  for (const select of dom.dayAgendaEditor.querySelectorAll('.day-activity-location')) {
    const selected = select.dataset.activityId ? state.dayEditor.activities.find(item => item.id === select.dataset.activityId)?.locationId || '' : '';
    select.replaceChildren(new Option('Sem local', ''));
    state.dayEditor.locations.forEach((location, index) => select.add(new Option(location.name.trim() || `Local ${index + 1}`, location.id)));
    select.value = selected;
  }
}

function placeResultName(result) {
  return result.name || result.address?.attraction || result.address?.tourism || result.address?.amenity || result.address?.shop || result.display_name?.split(',')[0] || 'Local';
}

async function searchOpenStreetMap(query) {
  const normalized = query.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  if (placeSearchCache.has(normalized)) return placeSearchCache.get(normalized);
  const elapsed = Date.now() - lastPlaceSearchAt;
  if (elapsed < 1100) await new Promise(resolve => setTimeout(resolve, 1100 - elapsed));
  lastPlaceSearchAt = Date.now();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: query.trim(), format: 'jsonv2', addressdetails: '1', limit: '6', 'accept-language': 'pt-BR' });
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Não foi possível consultar os locais agora.');
  const results = await response.json();
  placeSearchCache.set(normalized, results);
  return results;
}

function clearLocationGeography(location) {
  location.provider = '';
  location.providerPlaceId = '';
  location.formattedAddress = '';
  location.latitude = null;
  location.longitude = null;
  location.category = '';
  location.placeType = '';
}

function closePlaceSearch() {
  state.placeSearch = null;
  document.body.dataset.placeSearch = 'closed';
  dom.placeSearchSheet.setAttribute('aria-hidden', 'true');
  dom.confirmPlaceSearch.disabled = true;
}

function unsplashQuery(result) {
  const address = result.address || {};
  const city = address.city || address.town || address.village || address.municipality || '';
  const country = address.country || '';
  return [placeResultName(result), city, country].filter(Boolean).join(', ');
}

function renderPlacePhotos(photos) {
  dom.placePhotoResults.replaceChildren();
  for (const [index, photo] of photos.entries()) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'place-photo-option';
    option.setAttribute('aria-pressed', String(index === state.placeSearch.selectedPhotoIndex));
    const image = document.createElement('img');
    image.src = photo.thumbUrl;
    image.alt = photo.description || `Foto de ${placeResultName(state.placeSearch.results[state.placeSearch.selectedIndex])}`;
    const credit = document.createElement('span');
    credit.textContent = photo.author ? `por ${photo.author}` : 'Unsplash';
    option.append(image, credit);
    option.addEventListener('click', () => {
      state.placeSearch.selectedPhotoIndex = index === state.placeSearch.selectedPhotoIndex ? -1 : index;
      renderPlacePhotos(photos);
    });
    dom.placePhotoResults.append(option);
  }
}

async function loadPlacePhotos(result) {
  if (!state.placeSearch) return;
  state.placeSearch.photos = [];
  state.placeSearch.selectedPhotoIndex = -1;
  dom.placePhotoSection.hidden = false;
  dom.placePhotoResults.replaceChildren();
  dom.placePhotoMessage.textContent = 'Buscando fotos…';
  dom.placePhotoMessage.dataset.kind = '';
  const currentPlaceId = `${result.osm_type}/${result.osm_id}`;
  try {
    const client = await trySupabase();
    if (!client) throw new Error('Fotos online indisponíveis.');
    const { data, error } = await client.functions.invoke('unsplash-photos', { body: { action: 'search', query: unsplashQuery(result) } });
    const selected = state.placeSearch?.results?.[state.placeSearch.selectedIndex];
    if (!selected || `${selected.osm_type}/${selected.osm_id}` !== currentPlaceId) return;
    if (error) throw error;
    if (data?.quotaExceeded) {
      dom.placePhotoSection.hidden = true;
      return;
    }
    const photos = data?.photos || [];
    state.placeSearch.photos = photos;
    dom.placePhotoMessage.textContent = photos.length ? 'Toque numa foto para usá-la. Você também pode enviar a sua.' : 'Nenhuma foto encontrada. Você poderá enviar uma do aparelho.';
    renderPlacePhotos(photos);
  } catch {
    dom.placePhotoSection.hidden = true;
  }
}

function renderPlaceSearchResults(results) {
  dom.placeSearchResults.replaceChildren();
  dom.placePhotoSection.hidden = true;
  for (const [index, result] of results.entries()) {
    const item = document.createElement('li');
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'place-search-result';
    option.setAttribute('aria-pressed', String(index === state.placeSearch.selectedIndex));
    const marker = document.createElement('span');
    marker.className = 'place-search-result-marker';
    marker.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = placeResultName(result);
    const address = document.createElement('small');
    address.textContent = result.display_name;
    copy.append(title, address);
    option.append(marker, copy);
    option.addEventListener('click', () => {
      state.placeSearch.selectedIndex = index;
      state.placeSearch.photos = [];
      state.placeSearch.selectedPhotoIndex = -1;
      dom.confirmPlaceSearch.disabled = false;
      renderPlaceSearchResults(results);
      if (!state.placeSearch.inlineContext) loadPlacePhotos(result);
    });
    item.append(option);
    dom.placeSearchResults.append(item);
  }
}

async function runPlaceSearch() {
  if (!state.placeSearch) return;
  const query = dom.placeSearchInput.value.trim();
  if (query.length < 3) {
    dom.placeSearchMessage.textContent = 'Digite pelo menos 3 caracteres.';
    dom.placeSearchMessage.dataset.kind = 'error';
    return;
  }
  dom.runPlaceSearch.disabled = true;
  dom.runPlaceSearch.textContent = 'Buscando…';
  dom.confirmPlaceSearch.disabled = true;
  dom.placeSearchMessage.textContent = 'Buscando locais…';
  dom.placeSearchMessage.dataset.kind = '';
  dom.placeSearchResults.replaceChildren();
  try {
    const results = await searchOpenStreetMap(query);
    if (!state.placeSearch) return;
    state.placeSearch.results = results;
    state.placeSearch.selectedIndex = -1;
    dom.placeSearchMessage.textContent = results.length ? `${results.length} ${results.length === 1 ? 'local encontrado' : 'locais encontrados'}` : 'Nenhum local encontrado. Tente incluir a cidade ou o país.';
    dom.placeSearchMessage.dataset.kind = results.length ? '' : 'error';
    renderPlaceSearchResults(results);
  } catch (error) {
    dom.placeSearchMessage.textContent = error.message || 'Não foi possível buscar os locais.';
    dom.placeSearchMessage.dataset.kind = 'error';
  } finally {
    dom.runPlaceSearch.disabled = false;
    dom.runPlaceSearch.textContent = 'Buscar';
  }
}

function openPlaceSearch(location, options = {}) {
  state.placeSearch = { location, results: [], selectedIndex: -1, photos: [], selectedPhotoIndex: -1, ...options };
  dom.placeSearchInput.value = location.name || '';
  dom.placeSearchMessage.textContent = '';
  dom.placeSearchMessage.dataset.kind = '';
  dom.placeSearchResults.replaceChildren();
  dom.placePhotoSection.hidden = true;
  dom.placePhotoResults.replaceChildren();
  dom.confirmPlaceSearch.disabled = true;
  dom.placeSearchSheet.setAttribute('aria-hidden', 'false');
  document.body.dataset.placeSearch = 'open';
  requestAnimationFrame(() => dom.placeSearchInput.focus({ preventScroll: true }));
  if (dom.placeSearchInput.value.trim().length >= 3) runPlaceSearch();
}

function confirmPlaceSearch() {
  const search = state.placeSearch;
  const match = search?.results?.[search.selectedIndex];
  if (!match) return;

  const location = search.location;
  location.name = placeResultName(match);
  location.selectedName = location.name;
  location.provider = 'openstreetmap';
  location.providerPlaceId = String(match.osm_type) + '/' + String(match.osm_id);
  location.formattedAddress = match.display_name;
  location.latitude = Number(match.lat);
  location.longitude = Number(match.lon);
  location.category = match.category || match.class || '';
  location.placeType = match.type || '';

  if (!search.inlineContext) {
    const photo = search.photos?.[search.selectedPhotoIndex];
    if (photo) {
      location.photoUrl = photo.imageUrl;
      location.photoProvider = 'unsplash';
      location.photoAuthor = photo.author || '';
      location.photoAuthorUrl = photo.authorUrl || '';
      location.photoSourceUrl = photo.sourceUrl || '';
      if (photo.downloadLocation) {
        trySupabase()
          .then(client => client?.functions.invoke('unsplash-photos', { body: { action: 'track', downloadLocation: photo.downloadLocation } }))
          .catch(() => {});
      }
    }
  }

  const inlineContext = search.inlineContext;
  closePlaceSearch();

  if (inlineContext) {
    saveInlinePlaceSelection(inlineContext, location)
      .catch(error => {
        setAgendaSaveState(inlineContext.activityId, 'error');
        console.warn('Não foi possível salvar o local', error);
      });
    return;
  }

  renderDayLocationsEditor();
  syncDayActivityLocationSelects();
}

function renderDayLocationsEditor(focusLast = false) {
  dom.dayLocationsEditor.replaceChildren();
  for (const [index, location] of state.dayEditor.locations.entries()) {
    const row = document.createElement('div');
    row.className = 'day-location-row';
    const photo = document.createElement('label');
    photo.className = 'day-location-photo';
    photo.setAttribute('aria-label', `Escolher foto do local ${index + 1}`);
    const image = document.createElement('img');
    image.alt = '';
    const placeholder = document.createElement('span');
    placeholder.textContent = '＋';
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    if (location.photoUrl) {
      image.src = location.photoUrl;
      placeholder.hidden = true;
    } else image.hidden = true;
    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      try {
        location.photoUrl = await compressImage(selected);
        location.photoProvider = '';
        location.photoAuthor = '';
        location.photoAuthorUrl = '';
        location.photoSourceUrl = '';
        image.src = location.photoUrl;
        image.hidden = false;
        placeholder.hidden = true;
      } catch {
        dom.dayEditMessage.textContent = 'Não foi possível preparar a foto do local.';
      }
    });
    photo.append(image, placeholder, file);
    const editor = document.createElement('div');
    editor.className = 'day-location-search';
    const searchLine = document.createElement('div');
    searchLine.className = 'day-location-search-line';
    const name = document.createElement('input');
    name.type = 'text';
    name.placeholder = index === 0 ? 'Primeiro local do dia' : `Local ${index + 1}`;
    name.value = location.name;
    name.addEventListener('input', () => {
      location.name = name.value;
      if (location.providerPlaceId && name.value.trim() !== location.selectedName) clearLocationGeography(location);
      syncDayActivityLocationSelects();
    });
    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'day-location-search-button';
    search.textContent = 'Buscar';
    const status = document.createElement('span');
    status.className = 'day-location-search-status';
    if (location.formattedAddress) status.textContent = location.formattedAddress;
    search.addEventListener('click', () => {
      const query = name.value.trim();
      if (query.length < 3) {
        status.textContent = 'Digite pelo menos 3 caracteres.';
        status.dataset.kind = 'error';
        return;
      }
      openPlaceSearch(location);
    });
    searchLine.append(name, search);
    editor.append(searchLine, status);
    const remove = document.createElement('button');
    remove.className = 'new-trip-passenger-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remover local');
    remove.addEventListener('click', () => {
      state.dayEditor.locations = state.dayEditor.locations.filter(item => item.id !== location.id);
      for (const activity of state.dayEditor.activities) if (activity.locationId === location.id) activity.locationId = '';
      renderDayLocationsEditor();
      renderDayAgendaEditor();
    });
    row.append(photo, editor, remove);
    dom.dayLocationsEditor.append(row);
  }
  if (focusLast) dom.dayLocationsEditor.lastElementChild?.querySelector('input[type="text"]')?.focus({ preventScroll: true });
}

function addDayLocation() {
  state.dayEditor.locations.push({ id: crypto.randomUUID(), name: '', photoUrl: '', provider: '', providerPlaceId: '', formattedAddress: '', latitude: null, longitude: null, category: '', placeType: '' });
  renderDayLocationsEditor(true);
  syncDayActivityLocationSelects();
}

function renderDayAgendaEditor(focusLast = false) {
  dom.dayAgendaEditor.replaceChildren();
  for (const activity of state.dayEditor.activities) {
    const row = document.createElement('div');
    row.className = 'day-agenda-row';
    const time = document.createElement('input');
    time.type = 'time';
    time.value = activity.time;
    time.addEventListener('input', () => { activity.time = time.value; });
    const text = document.createElement('input');
    text.type = 'text';
    text.placeholder = 'O que está programado?';
    text.value = activity.text;
    text.addEventListener('input', () => { activity.text = text.value; });
    const locationSelect = document.createElement('select');
    locationSelect.className = 'day-activity-location';
    locationSelect.dataset.activityId = activity.id;
    locationSelect.append(new Option('Sem local', ''));
    state.dayEditor.locations.forEach((item, index) => locationSelect.add(new Option(item.name.trim() || `Local ${index + 1}`, item.id)));
    locationSelect.value = activity.locationId || '';
    locationSelect.addEventListener('change', () => { activity.locationId = locationSelect.value; });
    const remove = document.createElement('button');
    remove.className = 'new-trip-passenger-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remover horário');
    remove.addEventListener('click', () => {
      state.dayEditor.activities = state.dayEditor.activities.filter(item => item.id !== activity.id);
      renderDayAgendaEditor();
    });
    row.append(time, text, remove, locationSelect);
    dom.dayAgendaEditor.append(row);
  }
  if (focusLast) dom.dayAgendaEditor.lastElementChild?.querySelector('input[type="text"]')?.focus({ preventScroll: true });
}

function addDayAgendaActivity() {
  state.dayEditor.activities.push({ id: crypto.randomUUID(), time: '09:00', text: '', locationId: '' });
  renderDayAgendaEditor(true);
}

function ensureDayTitleControl() {
  if (dom.dayPageTitle?.matches?.('button.day-inline-heading') && dom.dayPageTitle.isConnected) {
    if (dom.dayPageTitle.dataset.bound !== 'true') {
      dom.dayPageTitle.dataset.bound = 'true';
      dom.dayPageTitle.addEventListener('click', beginInlineDayTitleEdit);
    }
    return dom.dayPageTitle;
  }

  const control = document.createElement('button');
  control.id = 'day_page_title';
  control.type = 'button';
  control.className = 'day-inline-heading';
  control.setAttribute('aria-label', 'Editar nome do dia');
  control.dataset.bound = 'true';
  control.addEventListener('click', beginInlineDayTitleEdit);

  if (dom.dayPageTitle?.isConnected) {
    dom.dayPageTitle.replaceWith(control);
  } else {
    document.querySelector('.day-page-title-row')?.prepend(control);
  }
  dom.dayPageTitle = control;
  return control;
}

function openDayPage(dayId, { pushHistory = true } = {}) {
  const day = state.tripDays.find(item => String(item.id) === String(dayId));
  if (!day) return;
  if (pushHistory) window.history.pushState({ view: 'day', tripId: String(state.activeTripId), dayId: String(day.id) }, '', `#day-${day.id}`);
  state.activeDayId = String(day.id);
  const renderKey = `${state.activeTripId}:${day.id}:${state.activeTripDataVersion}`;
  if (dom.dayPage.dataset.renderKey === renderKey) {
    const activities = state.dayActivities.get(String(day.id)) || [];
    const locations = state.dayLocations.get(String(day.id)) || [];
    ensureDayTitleControl().textContent = dayTitle(day, activities, locations);
    dom.dayPageSaveStatus.dataset.state = state.daySaveStates.get(String(day.id)) || 'idle';
    dom.dayPage.setAttribute('aria-hidden', 'false');
    document.body.dataset.dayPage = 'open';
    return;
  }
  const activities = state.dayActivities.get(String(day.id)) || [];
  const locations = state.dayLocations.get(String(day.id)) || [];
  const photo = dayPhoto(day, activities, locations);
  dom.dayPageHero.style.backgroundImage = photo ? `url("${String(photo).replaceAll('"', '%22')}")` : '';
  dom.dayPageBadge.textContent = `dia ${day.day_number}`;
  ensureDayTitleControl().textContent = dayTitle(day, activities, locations);
  dom.dayPageSaveStatus.dataset.state = state.daySaveStates.get(String(day.id)) || 'idle';
  dom.dayPageDate.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${day.date}T12:00:00`));
  renderDayPageAgenda(day, activities, locations);
  renderDayPageMap(locations, activities);
  enrichDayPage(day, activities, locations).catch(error => console.warn('Não foi possível enriquecer o dia', error));
  dom.dayPage.dataset.renderKey = renderKey;
  dom.dayPage.setAttribute('aria-hidden', 'false');
  document.body.dataset.dayPage = 'open';
}



function setDaySaveState(dayId, status) {
  const key = String(dayId);
  const currentTimer = state.daySaveTimers.get(key);
  if (currentTimer) {
    clearTimeout(currentTimer);
    state.daySaveTimers.delete(key);
  }

  state.daySaveStates.set(key, status);
  if (state.activeDayId === key && dom.dayPageSaveStatus) {
    dom.dayPageSaveStatus.dataset.state = status;
    dom.dayPageSaveStatus.setAttribute(
      'aria-label',
      status === 'saving' ? 'Salvando alteração'
      : status === 'saved' ? 'Alteração salva'
      : status === 'error' ? 'Não foi possível salvar'
      : ''
    );
  }

  if (status === 'saved') {
    const timer = setTimeout(() => {
      if (state.daySaveStates.get(key) !== 'saved') return;
      state.daySaveStates.set(key, 'idle');
      if (state.activeDayId === key && dom.dayPageSaveStatus) dom.dayPageSaveStatus.dataset.state = 'idle';
      state.daySaveTimers.delete(key);
    }, 1000);
    state.daySaveTimers.set(key, timer);
  }
}

function queueDaySave(dayId, task) {
  const key = String(dayId);
  const previous = state.daySaveQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (state.daySaveQueues.get(key) === next) state.daySaveQueues.delete(key);
    });
  state.daySaveQueues.set(key, next);
  return next;
}

async function persistDayHeroChange(day, dayPatch, { rerender = true } = {}) {
  const dayId = String(day.id);
  const saveVersion = (state.daySaveVersions.get(dayId) || 0) + 1;
  state.daySaveVersions.set(dayId, saveVersion);
  setDaySaveState(dayId, 'saving');

  const activities = (state.dayActivities.get(dayId) || []).map(activity => ({ ...activity }));
  const locations = (state.dayLocations.get(dayId) || []).map(location => ({ ...location }));
  const patch = { status: day.status || 'planned', ...dayPatch };
  const updatedDay = { ...day, ...patch };

  return queueDaySave(dayId, async () => {
    try {
      setDaySaveState(dayId, 'saving');
      await offlineStore.saveDayBundle(updatedDay, activities, locations);
      await offlineStore.enqueueMutation({
        type: 'save-day',
        tripId: String(day.trip_id || state.activeTripId),
        dayId: day.id,
        dayPatch: patch,
        locations,
        activities,
        removedLocationIds: [],
        removedActivityIds: []
      });

      updateInlineDayState(updatedDay, activities, locations);
      await refreshSyncStatus();

      if (state.daySaveVersions.get(dayId) === saveVersion) setDaySaveState(dayId, 'saved');

      if (rerender && state.activeDayId === dayId) {
        openDayPage(day.id, { pushHistory: false });
      } else {
        renderTripDays(state.tripDays, state.dayActivities, state.dayLocations);
      }

      flushOutbox().catch(error => console.warn('Alteração do dia aguardando sincronização', error));
    } catch (error) {
      if (state.daySaveVersions.get(dayId) === saveVersion) setDaySaveState(dayId, 'error');
      throw error;
    }
  });
}

function beginInlineDayTitleEdit() {
  const day = state.tripDays.find(item => String(item.id) === String(state.activeDayId));
  if (!day) return;

  const editor = document.createElement('input');
  editor.type = 'text';
  editor.className = 'day-inline-heading-input';
  editor.value = day.title || dayTitle(
    day,
    state.dayActivities.get(String(day.id)) || [],
    state.dayLocations.get(String(day.id)) || []
  );

  let debounceTimer = null;
  let lastQueuedValue = editor.value.trim();
  let closed = false;

  const saveValue = async (value, { rerender = false } = {}) => {
    if (closed && !rerender) return;
    const normalized = value.trim();
    if (normalized === lastQueuedValue) {
      if (rerender) {
        const currentDay = state.tripDays.find(item => String(item.id) === String(day.id)) || day;
        ensureDayTitleControl().textContent = dayTitle(
          currentDay,
          state.dayActivities.get(String(day.id)) || [],
          state.dayLocations.get(String(day.id)) || []
        );
      }
      return;
    }
    lastQueuedValue = normalized;
    const currentDay = state.tripDays.find(item => String(item.id) === String(day.id)) || day;
    await persistDayHeroChange(currentDay, { title: normalized || null }, { rerender });
  };

  const schedule = () => {
    setDaySaveState(day.id, 'saving');
    clearTimeout(debounceTimer);
    const value = editor.value;
    debounceTimer = setTimeout(() => {
      saveValue(value).catch(error => console.warn('Autosave do nome do dia falhou', error));
    }, 550);
  };

  const finish = async () => {
    if (closed) return;
    closed = true;
    clearTimeout(debounceTimer);
    try {
      await saveValue(editor.value, { rerender: true });
    } catch (error) {
      console.warn('Autosave final do nome do dia falhou', error);
      openDayPage(day.id, { pushHistory: false });
    }
  };

  editor.addEventListener('input', schedule);
  editor.addEventListener('blur', finish, { once: true });
  editor.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      editor.blur();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      clearTimeout(debounceTimer);
      closed = true;
      const currentDay = state.tripDays.find(item => String(item.id) === String(day.id)) || day;
      ensureDayTitleControl().textContent = dayTitle(
        currentDay,
        state.dayActivities.get(String(day.id)) || [],
        state.dayLocations.get(String(day.id)) || []
      );
    }
  });

  dom.dayPageTitle.replaceWith(editor);
  dom.dayPageTitle = editor;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(editor.value.length, editor.value.length);
}

async function saveDayHeroPhoto(file) {
  const day = state.tripDays.find(item => String(item.id) === String(state.activeDayId));
  if (!day || !file) return;

  setDaySaveState(day.id, 'saving');
  try {
    const photoUrl = await compressImage(file);
    const currentDay = state.tripDays.find(item => String(item.id) === String(day.id)) || day;
    await persistDayHeroChange(currentDay, { photo_url: photoUrl });
  } catch (error) {
    setDaySaveState(day.id, 'error');
    throw error;
  }
}

function agendaSaveIndicator(activityId) {
  return dom.dayPageAgenda.querySelector('[data-activity-id="' + CSS.escape(String(activityId)) + '"] .day-inline-save-status');
}

function setAgendaSaveState(activityId, status) {
  const key = String(activityId);
  const currentTimer = state.agendaSaveTimers.get(key);
  if (currentTimer) {
    clearTimeout(currentTimer);
    state.agendaSaveTimers.delete(key);
  }

  state.agendaSaveStates.set(key, status);
  const indicator = agendaSaveIndicator(key);
  if (indicator) {
    indicator.dataset.state = status;
    indicator.setAttribute('aria-label',
      status === 'saving' ? 'Salvando alteração'
      : status === 'saved' ? 'Alteração salva'
      : status === 'error' ? 'Não foi possível salvar'
      : ''
    );
  }

  if (status === 'saved') {
    const timer = setTimeout(() => {
      if (state.agendaSaveStates.get(key) !== 'saved') return;
      state.agendaSaveStates.set(key, 'idle');
      const liveIndicator = agendaSaveIndicator(key);
      if (liveIndicator) liveIndicator.dataset.state = 'idle';
      state.agendaSaveTimers.delete(key);
    }, 1000);
    state.agendaSaveTimers.set(key, timer);
  }
}

function queueAgendaSave(activityId, task) {
  const key = String(activityId);
  const previous = state.agendaSaveQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (state.agendaSaveQueues.get(key) === next) state.agendaSaveQueues.delete(key);
    });
  state.agendaSaveQueues.set(key, next);
  return next;
}

function updateInlineDayState(day, activities, locations) {
  const dayId = String(day.id);
  state.tripDays = state.tripDays.map(item => String(item.id) === dayId ? day : item);
  state.dayActivities.set(dayId, activities);
  state.dayLocations.set(dayId, locations);

  if (state.activeTripId) {
    const data = {
      days: state.tripDays,
      activitiesByDay: state.dayActivities,
      locationsByDay: state.dayLocations,
      loadedAt: Date.now(),
      version: Date.now()
    };
    state.tripDataCache.set(String(state.activeTripId), data);
    state.activeTripDataVersion = data.version;
  }
}

async function persistInlineDayChange(day, activities, locations, dayPatch = {}, options = {}) {
  const { activityId = null, rerender = true } = options;
  const patch = { status: day.status || 'planned', ...dayPatch };
  const updatedDay = { ...day, ...patch };
  const saveVersion = activityId
    ? (state.agendaSaveVersions.get(String(activityId)) || 0) + 1
    : 0;

  if (activityId) {
    state.agendaSaveVersions.set(String(activityId), saveVersion);
    setAgendaSaveState(activityId, 'saving');
  }

  const save = async () => {
    try {
      if (activityId) setAgendaSaveState(activityId, 'saving');
      await offlineStore.saveDayBundle(updatedDay, activities, locations);
      await offlineStore.enqueueMutation({
        type: 'save-day',
        tripId: String(day.trip_id || state.activeTripId),
        dayId: day.id,
        dayPatch: patch,
        locations,
        activities,
        removedLocationIds: [],
        removedActivityIds: []
      });

      updateInlineDayState(updatedDay, activities, locations);
      await refreshSyncStatus();

      if (activityId && state.agendaSaveVersions.get(String(activityId)) === saveVersion) {
        setAgendaSaveState(activityId, 'saved');
      }

      if (rerender && state.activeDayId === String(day.id)) {
        openDayPage(day.id, { pushHistory: false });
      } else {
        renderTripDays(state.tripDays, state.dayActivities, state.dayLocations);
      }

      flushOutbox().catch(error => console.warn('Alteração inline aguardando sincronização', error));
    } catch (error) {
      if (activityId && state.agendaSaveVersions.get(String(activityId)) === saveVersion) {
        setAgendaSaveState(activityId, 'error');
      }
      throw error;
    }
  };

  return activityId ? queueAgendaSave(activityId, save) : save();
}

function cloneDayRecords(day) {
  const dayId = String(day.id);
  return {
    activities: (state.dayActivities.get(dayId) || []).map(activity => ({ ...activity })),
    locations: (state.dayLocations.get(dayId) || []).map(location => ({ ...location }))
  };
}

function beginInlineTimeEdit(button, day, activity) {
  const input = document.createElement('input');
  input.type = 'time';
  input.className = 'day-inline-time-input';
  input.value = activityTime(activity) || '09:00';

  let committed = false;
  const commit = async () => {
    if (committed) return;
    committed = true;

    const value = input.value;
    if (!value) {
      openDayPage(day.id, { pushHistory: false });
      return;
    }

    setAgendaSaveState(activity.id, 'saving');
    const records = cloneDayRecords(day);
    const target = records.activities.find(item => String(item.id) === String(activity.id));
    if (!target) return;

    target.starts_at = day.date + 'T' + value + ':00';
    target.period = periodFromTime(value);
    await persistInlineDayChange(day, records.activities, records.locations, {}, { activityId: activity.id });
  };

  button.replaceWith(input);
  input.addEventListener('change', commit, { once: true });
  input.addEventListener('blur', commit, { once: true });
  input.focus({ preventScroll: true });
  if (input.showPicker) input.showPicker();
}

function beginInlineTextEdit(button, day, activity, field, multiline = false) {
  const editor = document.createElement(multiline ? 'textarea' : 'input');
  editor.className = multiline ? 'day-inline-textarea' : 'day-inline-text-input';
  if (!multiline) editor.type = 'text';
  editor.value = activity[field] || '';
  if (multiline) editor.rows = 3;

  let debounceTimer = null;
  let lastQueuedValue = editor.value;
  let closed = false;

  const saveValue = async (value, { rerender = false } = {}) => {
    if (closed && !rerender) return;
    if (value === lastQueuedValue && !rerender) return;
    lastQueuedValue = value;

    const records = cloneDayRecords(day);
    const target = records.activities.find(item => String(item.id) === String(activity.id));
    if (!target) return;

    target[field] = value.trim() || null;
    updateInlineDayState(day, records.activities, records.locations);
    await persistInlineDayChange(day, records.activities, records.locations, {}, {
      activityId: activity.id,
      rerender
    });
  };

  const scheduleSave = () => {
    const value = editor.value;
    setAgendaSaveState(activity.id, 'saving');
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      saveValue(value).catch(error => console.warn('Autosave de texto falhou', error));
    }, 550);
  };

  const finish = async () => {
    if (closed) return;
    closed = true;
    clearTimeout(debounceTimer);
    const value = editor.value;
    try {
      await saveValue(value, { rerender: true });
    } catch (error) {
      console.warn('Autosave final de texto falhou', error);
      openDayPage(day.id, { pushHistory: false });
    }
  };

  editor.addEventListener('input', scheduleSave);
  editor.addEventListener('blur', finish, { once: true });
  editor.addEventListener('keydown', event => {
    if (!multiline && event.key === 'Enter') {
      event.preventDefault();
      editor.blur();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      clearTimeout(debounceTimer);
      closed = true;
      openDayPage(day.id, { pushHistory: false });
    }
  });

  button.replaceWith(editor);
  editor.focus({ preventScroll: true });
  if (editor.setSelectionRange) editor.setSelectionRange(editor.value.length, editor.value.length);
}

function locationDraft(location, activity) {
  return {
    id: location?.id || crypto.randomUUID(),
    name: location?.name || activity.place_name || primaryActivityPlace(activity) || '',
    selectedName: location?.name || activity.place_name || '',
    photoUrl: location?.photo_url || activity.photo_url || '',
    provider: location?.provider || '',
    providerPlaceId: location?.provider_place_id || '',
    formattedAddress: location?.formatted_address || activity.address || '',
    latitude: numericCoordinate(location?.latitude ?? activity.latitude),
    longitude: numericCoordinate(location?.longitude ?? activity.longitude),
    category: location?.category || '',
    placeType: location?.place_type || '',
    photoProvider: location?.photo_provider || '',
    photoAuthor: location?.photo_author || '',
    photoAuthorUrl: location?.photo_author_url || '',
    photoSourceUrl: location?.photo_source_url || ''
  };
}

function openInlinePlaceSearch(day, activity, location) {
  openPlaceSearch(locationDraft(location, activity), {
    inlineContext: {
      dayId: String(day.id),
      activityId: String(activity.id),
      originalLocationId: location?.id ? String(location.id) : null
    }
  });
}

async function saveInlinePlaceSelection(context, draft) {
  const day = state.tripDays.find(item => String(item.id) === String(context.dayId));
  if (!day) return;

  const records = cloneDayRecords(day);
  const activity = records.activities.find(item => String(item.id) === String(context.activityId));
  if (!activity) return;

  let location = context.originalLocationId
    ? records.locations.find(item => String(item.id) === String(context.originalLocationId))
    : null;

  const record = {
    ...(location || {}),
    id: location?.id || draft.id || crypto.randomUUID(),
    day_id: day.id,
    position: location?.position ?? records.locations.length,
    name: draft.name.trim(),
    provider: draft.provider || null,
    provider_place_id: draft.providerPlaceId || null,
    formatted_address: draft.formattedAddress || null,
    latitude: draft.latitude,
    longitude: draft.longitude,
    category: draft.category || null,
    place_type: draft.placeType || null,
    photo_provider: draft.photoProvider || null,
    photo_author: draft.photoAuthor || null,
    photo_author_url: draft.photoAuthorUrl || null,
    photo_source_url: draft.photoSourceUrl || null,
    photo_url: draft.photoUrl || location?.photo_url || activity.photo_url || null
  };

  if (location) Object.assign(location, record);
  else records.locations.push(record);

  activity.place_id = record.id;
  activity.place_name = record.name;
  activity.address = record.formatted_address;
  activity.latitude = record.latitude;
  activity.longitude = record.longitude;
  if (record.photo_url) activity.photo_url = record.photo_url;

  const patch = day.main_place_name ? {} : { main_place_name: record.name };
  setAgendaSaveState(activity.id, 'saving');
  await persistInlineDayChange(day, records.activities, records.locations, patch, { activityId: activity.id });
}

async function saveInlinePhoto(day, activity, location, file) {
  setAgendaSaveState(activity.id, 'saving');
  const photoUrl = await compressImage(file);
  const records = cloneDayRecords(day);
  const targetActivity = records.activities.find(item => String(item.id) === String(activity.id));
  if (!targetActivity) return;

  targetActivity.photo_url = photoUrl;

  if (location) {
    const targetLocation = records.locations.find(item => String(item.id) === String(location.id));
    if (targetLocation) {
      targetLocation.photo_url = photoUrl;
      targetLocation.photo_provider = null;
      targetLocation.photo_author = null;
      targetLocation.photo_author_url = null;
      targetLocation.photo_source_url = null;
      for (const linkedActivity of records.activities) {
        if (String(linkedActivity.place_id || '') === String(targetLocation.id)) linkedActivity.photo_url = photoUrl;
      }
    }
  }

  const patch = day.photo_url ? {} : { photo_url: photoUrl };
  await persistInlineDayChange(day, records.activities, records.locations, patch, { activityId: activity.id });
}

function renderDayPageAgenda(day, activities, locations) {
  dom.dayPageAgenda.replaceChildren();
  const ordered = [...activities].sort((a, b) => String(a.starts_at || '').localeCompare(String(b.starts_at || '')) || (a.position || 0) - (b.position || 0));

  for (const activity of ordered) {
    const location = activityLocation(activity, locations);
    const item = document.createElement('li');
    item.className = 'day-view-agenda-item';
    item.dataset.activityId = String(activity.id);

    const time = document.createElement('button');
    time.type = 'button';
    time.className = 'day-inline-time';
    time.textContent = activityTime(activity) || '—';
    time.setAttribute('aria-label', 'Editar horário de ' + (activity.title || 'atividade'));
    time.addEventListener('click', () => beginInlineTimeEdit(time, day, activity));

    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'day-view-pin day-inline-location';
    pin.setAttribute('aria-label', location?.name ? 'Editar local: ' + location.name : 'Definir local');
    pin.addEventListener('click', () => openInlinePlaceSearch(day, activity, location));

    const saveStatus = document.createElement('span');
    saveStatus.className = 'day-inline-save-status';
    saveStatus.dataset.state = state.agendaSaveStates.get(String(activity.id)) || 'idle';
    saveStatus.setAttribute('role', 'status');
    saveStatus.setAttribute('aria-live', 'polite');

    const copy = document.createElement('div');
    copy.className = 'day-view-agenda-copy';

    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'day-inline-title';
    title.textContent = activity.title || location?.name || activity.place_name || 'Atividade';
    title.setAttribute('aria-label', 'Editar título');
    title.addEventListener('click', () => beginInlineTextEdit(title, day, activity, 'title'));

    const place = document.createElement('button');
    place.type = 'button';
    place.className = 'day-inline-place-name';
    place.textContent = location?.name || activity.place_name || 'Sem local definido';
    place.addEventListener('click', () => openInlinePlaceSearch(day, activity, location));

    copy.append(title, place);

    const description = document.createElement('button');
    description.type = 'button';
    description.className = 'day-inline-description';
    description.textContent = activity.description || 'Adicionar observação';
    description.dataset.empty = String(!activity.description);
    description.setAttribute('aria-label', activity.description ? 'Editar observação' : 'Adicionar observação');
    description.addEventListener('click', () => beginInlineTextEdit(description, day, activity, 'description', true));
    copy.append(description);

    const photoUrl = location?.photo_url || activity.photo_url || '';
    item.dataset.hasPhoto = String(Boolean(photoUrl));
    item.append(time, pin, saveStatus, copy);

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.className = 'day-inline-photo-input';
    file.setAttribute('aria-label', 'Escolher foto de ' + (location?.name || activity.title || 'atividade'));

    const camera = document.createElement('label');
    camera.className = 'day-inline-camera';
    camera.setAttribute('aria-label', 'Alterar foto');
    camera.append(document.createTextNode('📷'), file);

    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      camera.dataset.loading = 'true';
      try {
        await saveInlinePhoto(day, activity, location, selected);
      } catch (error) {
        setAgendaSaveState(activity.id, 'error');
        console.warn(error);
        camera.dataset.loading = 'false';
      }
    });

    if (photoUrl) {
      const photoShell = document.createElement('div');
      photoShell.className = 'day-view-photo-shell';

      const photo = document.createElement('div');
      photo.className = 'day-view-place-photo';
      photo.style.backgroundImage = 'url("' + String(photoUrl).replaceAll('"', '%22') + '")';

      photoShell.append(photo, camera);
      item.append(photoShell);
    } else {
      camera.classList.add('day-inline-camera-empty');
      item.append(camera);
    }

    dom.dayPageAgenda.append(item);
  }

  dom.dayPageEmpty.textContent = ordered.length ? '' : 'Nenhum horário planejado para o dia ' + day.day_number + '.';
}

function dayMapPoints(locations, activities = []) {
  const points = [];
  const keys = new Set();

  const addPoint = point => {
    const latitude = numericCoordinate(point.latitude);
    const longitude = numericCoordinate(point.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const key = latitude.toFixed(6) + ':' + longitude.toFixed(6);
    if (keys.has(key)) return;
    keys.add(key);
    points.push({ ...point, latitude, longitude });
  };

  locations.forEach(addPoint);
  activities.forEach(activity => {
    if (activity.place_id && locations.some(location => String(location.id) === String(activity.place_id))) return;
    addPoint({
      name: activity.place_name || activity.title || 'Local',
      latitude: activity.latitude,
      longitude: activity.longitude
    });
  });

  return points;
}

function renderOsmMapFallback(points, token) {
  if (token !== state.dayMapRenderToken || !points.length) return;
  const latitudes = points.map(point => point.latitude);
  const longitudes = points.map(point => point.longitude);
  let south = Math.min(...latitudes);
  let north = Math.max(...latitudes);
  let west = Math.min(...longitudes);
  let east = Math.max(...longitudes);

  const minLatSpan = 0.012;
  const minLonSpan = 0.016;
  if (north - south < minLatSpan) {
    const center = (north + south) / 2;
    south = center - minLatSpan / 2;
    north = center + minLatSpan / 2;
  }
  if (east - west < minLonSpan) {
    const center = (east + west) / 2;
    west = center - minLonSpan / 2;
    east = center + minLonSpan / 2;
  }

  const latPad = (north - south) * 0.18;
  const lonPad = (east - west) * 0.18;
  const first = points[0];
  const bbox = [west - lonPad, south - latPad, east + lonPad, north + latPad].join(',');

  const iframe = document.createElement('iframe');
  iframe.title = 'Mapa do dia';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent(bbox)
    + '&layer=mapnik&marker=' + first.latitude + '%2C' + first.longitude;
  dom.dayPageMap.replaceChildren(iframe);
}

function renderDayPageMap(locations, activities = []) {
  const points = dayMapPoints(locations, activities);
  const token = ++state.dayMapRenderToken;

  if (state.dayMap) {
    state.dayMap.remove();
    state.dayMap = null;
  }

  dom.dayPageMap.replaceChildren();
  dom.dayPageDirections.replaceChildren();

  if (!points.length) {
    dom.dayPageMap.textContent = 'Adicione locais ao dia para ver o mapa.';
    return;
  }

  const pinList = document.createElement('ol');
  pinList.className = 'day-view-map-pins';
  points.forEach((point, index) => {
    const item = document.createElement('li');
    const marker = document.createElement('span');
    marker.textContent = String(index + 1);
    const name = document.createElement('strong');
    name.textContent = point.name || ('Local ' + String(index + 1));
    item.append(marker, name);
    pinList.append(item);
  });

  const routeLink = document.createElement('a');
  routeLink.className = 'day-view-route-link';
  routeLink.target = '_blank';
  routeLink.rel = 'noopener';
  if (points.length > 1) {
    routeLink.href = 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route='
      + points.map(point => point.latitude + '%2C' + point.longitude).join('%3B');
    routeLink.textContent = 'Abrir direções do dia';
  } else {
    routeLink.href = 'https://www.openstreetmap.org/?mlat=' + points[0].latitude
      + '&mlon=' + points[0].longitude
      + '#map=16/' + points[0].latitude + '/' + points[0].longitude;
    routeLink.textContent = 'Abrir local no mapa';
  }
  dom.dayPageDirections.append(pinList, routeLink);

  dom.dayPageMap.textContent = 'Carregando mapa…';

  loadLeaflet().then(L => {
    if (token !== state.dayMapRenderToken || document.body.dataset.dayPage !== 'open') return;
    dom.dayPageMap.replaceChildren();

    const map = L.map(dom.dayPageMap, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true
    });
    state.dayMap = map;

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      minZoom: 2,
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const bounds = [];
    points.forEach((point, index) => {
      const latLng = [point.latitude, point.longitude];
      bounds.push(latLng);
      const icon = L.divIcon({
        className: 'day-map-numbered-marker',
        html: '<span><b>' + String(index + 1) + '</b></span>',
        iconSize: [30, 36],
        iconAnchor: [15, 36],
        popupAnchor: [0, -34]
      });
      L.marker(latLng, { icon })
        .addTo(map)
        .bindPopup(point.name || ('Local ' + String(index + 1)));
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    requestAnimationFrame(() => map.invalidateSize());
  }).catch(() => renderOsmMapFallback(points, token));
}

function closeDayPage() {
  state.activeDayId = null;
  state.dayMapRenderToken += 1;
  if (state.dayMap) {
    state.dayMap.remove();
    state.dayMap = null;
  }
  document.body.dataset.dayPage = 'closed';
  dom.dayPage.setAttribute('aria-hidden', 'true');
}

function navigateBackFromDay() {
  if (window.history.state?.view === 'day') window.history.back();
  else closeDayPage();
}

function openDayEditor(day) {
  const locations = state.dayLocations.get(String(day.id)) || [];
  const activities = state.dayActivities.get(String(day.id)) || [];
  state.dayEditor = {
    day,
    title: day.title || '',
    notes: day.summary || '',
    locations: locations.length ? locations.map(location => ({ id: location.id || crypto.randomUUID(), name: location.name || '', photoUrl: location.photo_url || '', provider: location.provider || '', providerPlaceId: location.provider_place_id || '', formattedAddress: location.formatted_address || '', latitude: numericCoordinate(location.latitude), longitude: numericCoordinate(location.longitude), category: location.category || '', placeType: location.place_type || '', photoProvider: location.photo_provider || '', photoAuthor: location.photo_author || '', photoAuthorUrl: location.photo_author_url || '', photoSourceUrl: location.photo_source_url || '' })) : [{ id: crypto.randomUUID(), name: day.main_place_name || '', photoUrl: day.photo_url || '', provider: '', providerPlaceId: '', formattedAddress: '', latitude: null, longitude: null, category: '', placeType: '' }],
    activities: activities.length ? activities.map(activity => ({ id: activity.id || crypto.randomUUID(), time: activityTime(activity) || '09:00', text: activity.title || '', locationId: activity.place_id || '' })) : [{ id: crypto.randomUUID(), time: '09:00', text: '', locationId: '' }]
  };
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  const destination = trip?.destination?.trim() || trip?.name?.trim() || 'seu destino';
  dom.dayEditTitle.textContent = `Dia ${day.day_number}`;
  dom.dayEditDate.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${day.date}T12:00:00`));
  dom.dayTitleInput.placeholder = `Primeiro dia em ${destination}`;
  dom.dayTitleInput.value = state.dayEditor.title;
  dom.dayNotesInput.value = state.dayEditor.notes;
  dom.dayEditMessage.textContent = '';
  renderDayLocationsEditor();
  renderDayAgendaEditor();
  dom.dayEditSheet.setAttribute('aria-hidden', 'false');
  document.body.dataset.daySheet = 'open';
}

function closeDayEditor() {
  if (state.saving) return;
  if (state.placeSearch) closePlaceSearch();
  state.dayEditor = null;
  document.body.dataset.daySheet = 'closed';
  dom.dayEditSheet.setAttribute('aria-hidden', 'true');
}

async function syncMutation(mutation) {
  if (mutation.type !== 'save-day') return;
  const client = await trySupabase();
  if (!client) throw new Error('Backend indisponível.');

  const savedDay = await client.from('trip_days').update(mutation.dayPatch).eq('id', mutation.dayId);
  if (savedDay.error) throw savedDay.error;

  if (mutation.locations?.length) {
    const savedLocations = await client.from('day_locations').upsert(mutation.locations);
    if (savedLocations.error) throw savedLocations.error;
  }

  if (mutation.activities?.length) {
    const savedActivities = await client.from('activities').upsert(mutation.activities);
    if (savedActivities.error) throw savedActivities.error;
  }

  if (mutation.removedActivityIds?.length) {
    const removed = await client.from('activities').delete().in('id', mutation.removedActivityIds).eq('day_id', mutation.dayId);
    if (removed.error) throw removed.error;
  }

  if (mutation.removedLocationIds?.length) {
    const removed = await client.from('day_locations').delete().in('id', mutation.removedLocationIds).eq('day_id', mutation.dayId);
    if (removed.error) throw removed.error;
  }
}

async function flushOutbox() {
  if (!navigator.onLine || !state.user) {
    await refreshSyncStatus();
    return false;
  }
  if (!await trySupabase()) {
    await refreshSyncStatus();
    return false;
  }
  const mutations = await offlineStore.listOutbox();
  for (const mutation of mutations) {
    try {
      await syncMutation(mutation);
      await offlineStore.removeMutation(mutation.id);
    } catch (error) {
      console.warn('Sincronização pendente', error);
      await refreshSyncStatus();
      return false;
    }
  }
  await refreshSyncStatus();
  return true;
}

function applyLocalDaySave(day, activities, locations) {
  const dayId = String(day.id);
  state.tripDays = state.tripDays.map(item => String(item.id) === dayId ? day : item);
  state.dayActivities.set(dayId, activities);
  state.dayLocations.set(dayId, locations);

  const data = {
    days: state.tripDays,
    activitiesByDay: state.dayActivities,
    locationsByDay: state.dayLocations,
    loadedAt: Date.now(),
    version: Date.now()
  };
  if (state.activeTripId) state.tripDataCache.set(String(state.activeTripId), data);
  applyTripData(data);

  if (state.activeDayId === dayId) openDayPage(dayId, { pushHistory: false });
}

async function saveDayEditor() {
  if (!state.dayEditor) return;
  state.saving = true;
  setLoading(dom.saveDayEdit, true);

  const editor = state.dayEditor;
  const unresolvedLocation = editor.locations.find(location => location.name.trim() && (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)));

  if (unresolvedLocation) {
    dom.dayEditMessage.textContent = `Busque e escolha “${unresolvedLocation.name.trim()}” na lista antes de salvar.`;
    state.saving = false;
    setLoading(dom.saveDayEdit, false);
    return;
  }

  const dayPatch = {
    title: editor.title.trim() || null,
    summary: editor.notes.trim() || null,
    status: 'planned'
  };
  const localDay = { ...editor.day, ...dayPatch };

  const previousLocations = state.dayLocations.get(String(editor.day.id)) || [];
  const previousActivities = state.dayActivities.get(String(editor.day.id)) || [];
  const previousLocationById = new Map(previousLocations.map(item => [String(item.id), item]));
  const previousActivityById = new Map(previousActivities.map(item => [String(item.id), item]));

  const locations = editor.locations
    .filter(location => location.name.trim())
    .map((location, position) => ({
      ...(previousLocationById.get(String(location.id)) || {}),
      id: location.id,
      day_id: editor.day.id,
      position,
      name: location.name.trim(),
      provider: location.provider || null,
      provider_place_id: location.providerPlaceId || null,
      formatted_address: location.formattedAddress || null,
      latitude: location.latitude,
      longitude: location.longitude,
      category: location.category || null,
      place_type: location.placeType || null,
      photo_provider: location.photoProvider || null,
      photo_author: location.photoAuthor || null,
      photo_author_url: location.photoAuthorUrl || null,
      photo_source_url: location.photoSourceUrl || null,
      photo_url: location.photoUrl || null
    }));

  const activities = editor.activities
    .filter(activity => activity.text.trim())
    .map((activity, position) => {
      const location = editor.locations.find(item => item.id === activity.locationId);
      return {
        ...(previousActivityById.get(String(activity.id)) || {}),
        id: activity.id,
        day_id: editor.day.id,
        period: periodFromTime(activity.time),
        position,
        title: activity.text.trim(),
        starts_at: `${editor.day.date}T${activity.time || '09:00'}:00`,
        place_id: activity.locationId || null,
        place_name: location?.name.trim() || null,
        address: location?.formattedAddress || null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        photo_url: location?.photoUrl || null
      };
    });

  const retainedLocationIds = new Set(locations.map(location => String(location.id)));
  const removedLocationIds = previousLocations
    .filter(location => !retainedLocationIds.has(String(location.id)))
    .map(location => location.id);

  const retainedActivityIds = new Set(activities.map(activity => String(activity.id)));
  const removedActivityIds = previousActivities
    .filter(activity => !retainedActivityIds.has(String(activity.id)))
    .map(activity => activity.id);

  try {
    await offlineStore.saveDayBundle(localDay, activities, locations);
    await offlineStore.enqueueMutation({
      type: 'save-day',
      tripId: String(editor.day.trip_id || state.activeTripId),
      dayId: editor.day.id,
      dayPatch,
      locations,
      activities,
      removedLocationIds,
      removedActivityIds
    });
    await refreshSyncStatus();

    applyLocalDaySave(localDay, activities, locations);

    state.saving = false;
    setLoading(dom.saveDayEdit, false);
    closeDayEditor();

    flushOutbox().then(synced => {
      if (synced && state.activeTripId) state.tripDataCache.get(String(state.activeTripId)).loadedAt = Date.now();
    }).catch(error => console.warn('Falha ao processar fila local', error));
  } catch (error) {
    dom.dayEditMessage.textContent = error.message || 'Não foi possível salvar a alteração neste aparelho.';
    state.saving = false;
    setLoading(dom.saveDayEdit, false);
  }
}

function groupByDay(records = []) {
  const grouped = new Map();
  for (const record of records) {
    const key = String(record.day_id);
    const list = grouped.get(key) || [];
    list.push(record);
    grouped.set(key, list);
  }
  return grouped;
}

function applyTripData(data) {
  state.tripDays = data.days;
  state.dayActivities = data.activitiesByDay;
  state.dayLocations = data.locationsByDay;
  state.activeTripDataVersion = data.version;
  renderTripDays(data.days, data.activitiesByDay, data.locationsByDay);
}

async function fetchTripData(tripId) {
  const key = String(tripId);
  if (state.tripDataLoads.has(key)) return state.tripDataLoads.get(key);
  const load = (async () => {
    const pendingLocalChanges = await offlineStore.hasPendingForTrip(key);
    if (pendingLocalChanges) {
      const local = await offlineStore.loadTripData(key);
      if (local.days.length) {
        const data = {
          days: local.days,
          activitiesByDay: groupByDay(local.activities),
          locationsByDay: groupByDay(local.locations),
          loadedAt: Date.now(),
          version: Date.now(),
          offline: true
        };
        state.tripDataCache.set(key, data);
        return data;
      }
    }
    try {
      const client = await trySupabase();
    if (!client) throw new Error('Backend indisponível.');
      const result = await client.from('trip_days').select('*').eq('trip_id', tripId).order('day_number');
      if (result.error) throw result.error;
      const days = result.data || [];
      let activities = [], locations = [];
      if (days.length) {
        const [activityResult, locationResult] = await Promise.all([
          client.from('activities').select('*').in('day_id', days.map(day => day.id)).order('position'),
          client.from('day_locations').select('*').in('day_id', days.map(day => day.id)).order('position')
        ]);
        if (activityResult.error || locationResult.error) throw activityResult.error || locationResult.error;
        activities = activityResult.data || [];
        locations = locationResult.data || [];
      }
      await offlineStore.replaceTripData(key, days, activities, locations);
      const data = {
        days,
        activitiesByDay: groupByDay(activities),
        locationsByDay: groupByDay(locations),
        loadedAt: Date.now(),
        version: Date.now()
      };
      state.tripDataCache.set(key, data);
      return data;
    } catch (remoteError) {
      const local = await offlineStore.loadTripData(key);
      if (!local.days.length) throw remoteError;
      const data = {
        days: local.days,
        activitiesByDay: groupByDay(local.activities),
        locationsByDay: groupByDay(local.locations),
        loadedAt: Date.now(),
        version: Date.now(),
        offline: true
      };
      state.tripDataCache.set(key, data);
      return data;
    }
  })().finally(() => state.tripDataLoads.delete(key));
  state.tripDataLoads.set(key, load);
  return load;
}

async function openTrip(tripId, { pushHistory = true, forceRefresh = false } = {}) {
  const trip = state.trips.find(item => String(item.id) === String(tripId));
  if (!trip) return;
  if (pushHistory && (document.body.dataset.tripPage !== 'open' || state.activeTripId !== String(trip.id))) {
    window.history.pushState({ view: 'trip', tripId: String(trip.id) }, '', `#trip-${trip.id}`);
  }
  state.activeTripId = String(trip.id);
  const accent = /^#[0-9a-f]{6}$/i.test(trip.secondary_color || '') ? trip.secondary_color : '#4775d1';
  dom.tripPage.style.setProperty('--trip-page-color', accent);
  dom.tripPageHero.style.backgroundImage = trip.cover_url ? `url("${trip.cover_url.replaceAll('"', '%22')}")` : '';
  dom.tripPageTitle.textContent = trip.name;
  dom.tripPageDates.textContent = `${displayDate(trip.start_date)} — ${displayDate(trip.end_date)}`;
  dom.tripPagePassengers._count = dom.tripPagePassengerCount;
  syncPassengerList(dom.tripPagePassengers, state.passengers.get(trip.id) || []);
  dom.tripPage.setAttribute('aria-hidden', 'false');
  document.body.dataset.tripPage = 'open';
  const key = String(trip.id);
  const cached = forceRefresh ? null : state.tripDataCache.get(key);
  if (cached) {
    applyTripData(cached);
    dom.tripDayMessage.textContent = '';
    if (state.activeDayId && cached.days.some(day => String(day.id) === String(state.activeDayId))) openDayPage(state.activeDayId, { pushHistory: false });
    if (Date.now() - cached.loadedAt < TRIP_CACHE_FRESH_MS) return;
  } else {
    dom.tripDayList.replaceChildren();
    dom.tripDayMessage.textContent = 'Carregando dias…';
  }
  try {
    const data = await fetchTripData(trip.id);
    if (state.activeTripId !== key) return;
    applyTripData(data);
    dom.tripDayMessage.textContent = '';
    if (state.activeDayId && data.days.some(day => String(day.id) === String(state.activeDayId))) openDayPage(state.activeDayId, { pushHistory: false });
  } catch (error) {
    if (state.activeTripId === key && !cached) dom.tripDayMessage.textContent = error.message;
  }
}

function closeTripPage() {
  state.activeTripId = null;
  state.tripDays = [];
  state.dayActivities = new Map();
  state.dayLocations = new Map();
  closeDayPage();
  document.body.dataset.tripPage = 'closed';
  dom.tripPage.setAttribute('aria-hidden', 'true');
}

function navigateBackFromTrip() {
  if (window.history.state?.view === 'trip') window.history.back();
  else closeTripPage();
}

function createTripNode(trip) {
  const item = document.createElement('li');
  const article = document.createElement('article'); article.className = 'trip-card'; article.dataset.pressed = 'false';
  const button = document.createElement('button'); button.className = 'trip-card-button'; button.type = 'button';
  const releasePress = () => { article.dataset.pressed = 'false'; };
  button.addEventListener('pointerdown', () => { article.dataset.pressed = 'true'; });
  button.addEventListener('pointerup', releasePress);
  button.addEventListener('pointercancel', releasePress);
  button.addEventListener('click', () => {
    button.blur();
    if (state.editing) toggleTripSelection(button.dataset.tripId);
    else openTrip(button.dataset.tripId);
  });
  const owner = document.createElement('span'); owner.className = 'trip-owner-flag';
  const timing = document.createElement('span'); timing.className = 'trip-status';
  const copy = document.createElement('span'); copy.className = 'trip-copy';
  const title = document.createElement('h2');
  const dates = document.createElement('span'); dates.className = 'trip-dates';
  const footer = document.createElement('span'); footer.className = 'trip-footer';
  const stack = document.createElement('span'); stack.className = 'passenger-stack';
  const count = document.createElement('span'); count.className = 'passenger-count'; stack._count = count; stack.append(count);
  const selection = document.createElement('span'); selection.className = 'trip-selection-control'; selection.setAttribute('aria-hidden', 'true'); selection.dataset.selected = 'false';
  footer.append(stack); copy.append(title, dates, footer); button.append(owner, timing, copy, selection); article.append(button); item.append(article);
  item._refs = { article, button, owner, timing, title, dates, stack, selection };
  updateTripNode(item, trip);
  return item;
}

function updateTripNode(item, trip) {
  item.dataset.tripId = trip.id;
  const refs = item._refs, owned = trip.user_id === state.user.id;
  const accent = /^#[0-9a-f]{6}$/i.test(trip.secondary_color || '') ? trip.secondary_color : '#4775d1';
  refs.article.style.setProperty('--card-accent', accent);
  refs.article.style.backgroundImage = trip.cover_url ? `url("${trip.cover_url.replaceAll('"', '%22')}")` : '';
  refs.button.dataset.tripId = trip.id;
  refs.button.setAttribute('aria-label', `Abrir ${trip.name}`);
  refs.owner.textContent = owned ? 'criada por você' : 'viagem compartilhada';
  refs.timing.textContent = tripTiming(trip);
  refs.title.textContent = trip.name;
  refs.dates.textContent = `${displayDate(trip.start_date)} — ${displayDate(trip.end_date)}`;
  refs.selection.dataset.selected = String(state.selectedTripIds.has(String(trip.id)));
  syncPassengerList(refs.stack, state.passengers.get(trip.id) || []);
}

function syncTripSelectionUI() {
  for (const item of dom.tripList.children) {
    const selected = state.selectedTripIds.has(String(item.dataset.tripId));
    if (item._refs?.selection) item._refs.selection.dataset.selected = String(selected);
    item._refs?.button?.setAttribute('aria-pressed', String(selected));
  }
  dom.deleteSelectedTrips.disabled = state.selectedTripIds.size === 0;
}

function toggleTripSelection(tripId) {
  const id = String(tripId);
  if (state.selectedTripIds.has(id)) state.selectedTripIds.delete(id);
  else state.selectedTripIds.add(id);
  syncTripSelectionUI();
}

function setEditingMode(editing) {
  state.editing = editing;
  if (!editing) state.selectedTripIds.clear();
  document.body.dataset.editing = String(editing);
  dom.editTripsButton.textContent = editing ? 'OK' : 'Editar';
  dom.tripEditFooter.setAttribute('aria-hidden', String(!editing));
  syncTripSelectionUI();
}

async function softDeleteSelectedTrips() {
  if (!state.selectedTripIds.size) return;
  const client = await trySupabase();
  if (!client) {
    dom.deleteSelectedTrips.textContent = 'Exclusão requer conexão';
    return;
  }
  const ids = [...state.selectedTripIds];
  dom.deleteSelectedTrips.disabled = true;
  const result = await client.from('trips').update({ deleted_at: new Date().toISOString() }).in('id', ids).eq('user_id', state.user.id);
  if (result.error) {
    dom.deleteSelectedTrips.textContent = result.error.message;
    dom.deleteSelectedTrips.disabled = false;
    return;
  }
  setEditingMode(false);
  await loadTrips();
  dom.deleteSelectedTrips.textContent = 'Excluir selecionadas';
}

function syncTripList() {
  const visibleTrips = state.trips.filter(trip => Number(String(trip.start_date).slice(0, 4)) === state.selectedYear);
  const wanted = new Set(visibleTrips.map(trip => String(trip.id)));
  for (const item of [...dom.tripList.children]) if (!wanted.has(item.dataset.tripId)) item.remove();
  for (const trip of visibleTrips) {
    let item = [...dom.tripList.children].find(node => node.dataset.tripId === String(trip.id));
    if (!item) item = createTripNode(trip); else updateTripNode(item, trip);
    dom.tripList.append(item);
  }
  syncTripSelectionUI();
  const empty = visibleTrips.length === 0;
  dom.homeEmpty.setAttribute('aria-hidden', String(!empty));
  dom.tripList.setAttribute('aria-hidden', String(empty));
}

function setYearMenu(open) {
  document.body.dataset.yearMenu = open ? 'open' : 'closed';
  dom.yearButton.setAttribute('aria-expanded', String(open));
  dom.yearMenu.setAttribute('aria-hidden', String(!open));
}

function selectYear(year) {
  state.selectedYear = Number(year);
  dom.currentYear.textContent = String(state.selectedYear);
  for (const button of dom.yearList.querySelectorAll('button')) button.setAttribute('aria-current', String(Number(button.dataset.year) === state.selectedYear));
  syncTripList();
  setYearMenu(false);
}

function syncYearList() {
  const years = [...new Set(state.trips.map(trip => Number(String(trip.start_date).slice(0, 4))).filter(Boolean))].sort((a, b) => b - a);
  if (!years.length) years.push(new Date().getFullYear());
  if (!years.includes(state.selectedYear)) {
    const current = new Date().getFullYear();
    state.selectedYear = years.includes(current) ? current : years.reduce((closest, year) => Math.abs(year - current) < Math.abs(closest - current) ? year : closest, years[0]);
  }
  const wanted = new Set(years.map(String));
  for (const item of [...dom.yearList.children]) if (!wanted.has(item.dataset.year)) item.remove();
  for (const year of years) {
    let item = [...dom.yearList.children].find(node => node.dataset.year === String(year));
    if (!item) {
      item = document.createElement('li'); item.dataset.year = String(year);
      const button = document.createElement('button'); button.type = 'button'; button.dataset.year = String(year); button.addEventListener('click', () => selectYear(year)); item.append(button);
    }
    item.firstElementChild.textContent = String(year);
    item.firstElementChild.setAttribute('aria-current', String(year === state.selectedYear));
    dom.yearList.append(item);
  }
  dom.currentYear.textContent = String(state.selectedYear);
}

function applyPassengers(records = []) {
  state.passengers.clear();
  for (const passenger of records) {
    const list = state.passengers.get(passenger.trip_id) || [];
    list.push(passenger);
    state.passengers.set(passenger.trip_id, list);
  }
}

async function cacheCompleteWorkspace() {
  if (!state.user?.id || !state.trips.length || !navigator.onLine) return;
  const client = await trySupabase();
  if (!client) return;
  const lastSnapshot = await offlineStore.getMeta(`complete_snapshot:${state.user.id}`);
  if (lastSnapshot && Date.now() - new Date(lastSnapshot).getTime() < 30 * 60 * 1000) return;

  const tripIds = state.trips.map(trip => trip.id);
  const daysResult = await client.from('trip_days').select('*').in('trip_id', tripIds).order('day_number');
  if (daysResult.error) throw daysResult.error;
  const allDays = daysResult.data || [];

  let allActivities = [];
  let allLocations = [];
  if (allDays.length) {
    const dayIds = allDays.map(day => day.id);
    const [activityResult, locationResult] = await Promise.all([
      client.from('activities').select('*').in('day_id', dayIds).order('position'),
      client.from('day_locations').select('*').in('day_id', dayIds).order('position')
    ]);
    if (activityResult.error || locationResult.error) throw activityResult.error || locationResult.error;
    allActivities = activityResult.data || [];
    allLocations = locationResult.data || [];
  }

  const dayById = new Map(allDays.map(day => [String(day.id), day]));
  for (const trip of state.trips) {
    if (await offlineStore.hasPendingForTrip(trip.id)) continue;
    const days = allDays.filter(day => String(day.trip_id) === String(trip.id));
    const ids = new Set(days.map(day => String(day.id)));
    const activities = allActivities.filter(activity => ids.has(String(activity.day_id)));
    const locations = allLocations.filter(location => ids.has(String(location.day_id)));
    await offlineStore.replaceTripData(String(trip.id), days, activities, locations);

    state.tripDataCache.set(String(trip.id), {
      days,
      activitiesByDay: groupByDay(activities),
      locationsByDay: groupByDay(locations),
      loadedAt: Date.now(),
      version: Date.now()
    });
  }

  await offlineStore.setMeta(`complete_snapshot:${state.user.id}`, new Date().toISOString());
}

async function loadTrips({ allowLocalFallback = true } = {}) {
  try {
    const client = await trySupabase();
    if (!client) throw new Error('Backend indisponível.');
    const result = await client.from('trips').select('*').is('deleted_at', null).order('start_date', { ascending: true });
    if (result.error) throw result.error;
    state.trips = result.data || [];
    let passengerRecords = [];
    if (state.trips.length) {
      const passengers = await client.from('passengers').select('*').in('trip_id', state.trips.map(trip => trip.id)).order('created_at');
      if (passengers.error) throw passengers.error;
      passengerRecords = passengers.data || [];
    }
    applyPassengers(passengerRecords);
    if (state.user?.id) await offlineStore.replaceWorkspace(state.user.id, state.trips, passengerRecords);
  } catch (remoteError) {
    if (!allowLocalFallback || !state.user?.id) throw remoteError;
    const local = await offlineStore.loadWorkspace(state.user.id);
    if (!local.trips.length) throw remoteError;
    state.trips = local.trips;
    applyPassengers(local.passengers);
  }
  syncYearList();
  syncTripList();
}

async function loadProfile({ allowLocalFallback = true } = {}) {
  try {
    const client = await trySupabase();
    if (!client) throw new Error('Backend indisponível.');
    const result = await client.from('passenger_profiles').select('*').eq('user_id', state.user.id).maybeSingle();
    if (result.error) throw result.error;
    state.profile = result.data || { user_id: state.user.id, name: state.user.user_metadata?.name || 'Cíntia', birth_date: null, avatar_path: null };
    if (state.profile.is_deleted) { await client.auth.signOut(); throw new Error('Esta conta está desativada. Seus dados continuam preservados.'); }
    if (state.profile.avatar_path) {
      const signed = await client.storage.from('profile-photos').createSignedUrl(state.profile.avatar_path, 3600);
      if (!signed.error) state.profile.avatar_url = signed.data.signedUrl;
    }
    await offlineStore.saveProfile(state.profile);
  } catch (remoteError) {
    if (!allowLocalFallback) throw remoteError;
    state.profile = await offlineStore.getProfile(state.user.id);
    if (!state.profile) state.profile = { user_id: state.user.id, name: state.user.user_metadata?.name || 'Cíntia', birth_date: null, avatar_path: null };
  }
  syncProfileUI();
}

function selectTripColor(color, custom = false) {
  state.tripColor = color;
  dom.tripColorValue.value = color;
  dom.tripColorCustom.value = color;
  for (const option of dom.tripColorPalette.querySelectorAll('.trip-color-option')) option.setAttribute('aria-pressed', String(!custom && option.dataset.color === color));
  dom.tripColorCustom.parentElement.dataset.selected = String(custom);
}

function createTripPassengerRow(passenger) {
  const row = document.createElement('div');
  row.className = 'new-trip-passenger-row';

  const avatar = document.createElement('label');
  avatar.className = 'new-trip-passenger-avatar';
  avatar.setAttribute('aria-label', `Escolher foto de ${passenger.name || 'passageiro'}`);
  const image = document.createElement('img');
  image.alt = '';
  const initial = document.createElement('span');
  initial.textContent = passenger.name.trim()[0]?.toUpperCase() || '＋';
  const photoInput = document.createElement('input');
  photoInput.type = 'file';
  photoInput.accept = 'image/*';
  const photoSource = passenger.photoUrl || (passenger.session ? profileImage() : '');
  if (photoSource) {
    image.src = photoSource;
    image.hidden = false;
    initial.hidden = true;
  } else {
    image.hidden = true;
  }
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    try {
      passenger.photoUrl = await compressPassengerPhoto(file);
      image.src = passenger.photoUrl;
      image.hidden = false;
      initial.hidden = true;
    } catch {
      dom.newTripMessage.textContent = 'Não foi possível preparar a foto do passageiro.';
    }
  });
  avatar.append(image, initial, photoInput);

  const fields = document.createElement('div');
  fields.className = 'new-trip-passenger-fields';
  const nameField = document.createElement('label');
  nameField.className = 'new-trip-passenger-field';
  nameField.innerHTML = '<span>Nome</span>';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Nome do passageiro';
  nameInput.autocomplete = 'off';
  nameInput.value = passenger.name;
  nameInput.required = true;
  nameInput.addEventListener('input', () => {
    passenger.name = nameInput.value;
    initial.textContent = passenger.name.trim()[0]?.toUpperCase() || '＋';
    avatar.setAttribute('aria-label', `Escolher foto de ${passenger.name || 'passageiro'}`);
  });
  nameField.append(nameInput);

  const birthField = document.createElement('label');
  birthField.className = 'new-trip-passenger-field';
  birthField.innerHTML = '<span>Nascimento</span>';
  const birthInput = document.createElement('input');
  birthInput.type = 'date';
  birthInput.value = passenger.birthDate || '';
  birthInput.addEventListener('input', () => { passenger.birthDate = birthInput.value; });
  birthField.append(birthInput);
  fields.append(nameField, birthField);

  const control = document.createElement(passenger.session ? 'span' : 'button');
  if (passenger.session) {
    control.className = 'new-trip-passenger-session-mark';
    control.textContent = '✓';
    control.setAttribute('aria-label', 'Pessoa da sessão incluída');
  } else {
    control.className = 'new-trip-passenger-remove';
    control.type = 'button';
    control.textContent = '×';
    control.setAttribute('aria-label', 'Remover passageiro');
    control.addEventListener('click', () => {
      state.newTripPassengers = state.newTripPassengers.filter(item => item.id !== passenger.id);
      renderTripPassengers();
    });
  }

  row.append(avatar, fields, control);
  dom.newTripPassengerList.append(row);
}

function renderTripPassengers(focusLast = false) {
  dom.newTripPassengerList.replaceChildren();
  for (const passenger of state.newTripPassengers) createTripPassengerRow(passenger);
  if (focusLast) dom.newTripPassengerList.lastElementChild?.querySelector('input[type="text"]')?.focus({ preventScroll: true });
}

function addTripPassenger() {
  state.newTripPassengers.push({
    id: crypto.randomUUID(),
    session: false,
    userId: null,
    name: '',
    birthDate: '',
    photoUrl: ''
  });
  renderTripPassengers(true);
}

function resetTripPassengers() {
  state.newTripPassengers = [{
    id: crypto.randomUUID(),
    session: true,
    userId: state.user.id,
    name: profileName(),
    birthDate: state.profile?.birth_date || '',
    photoUrl: ''
  }];
  renderTripPassengers();
}

function passengerEditorKey(passenger) {
  if (passenger.userId) return `user:${passenger.userId}`;
  return [passenger.name, passenger.birthDate, passenger.photoUrl]
    .map(value => String(value || '').trim().toLocaleLowerCase('pt-BR'))
    .join('|');
}

function uniqueTripPassengers(passengers) {
  const keys = new Set();
  return passengers.filter(passenger => {
    const key = passengerEditorKey(passenger);
    if (!passenger.name.trim() || keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function openNewTrip() {
  setYearMenu(false);
  state.editingTripId = null;
  state.imageData = '';
  dom.newTripForm.reset();
  dom.newTripTitle.textContent = 'Nova viagem';
  dom.saveNewTrip.setAttribute('aria-label', 'Criar viagem');
  selectTripColor('#4775d1');
  resetTripPassengers();
  dom.coverPreview.removeAttribute('src');
  dom.coverPreview.parentElement.dataset.hasImage = 'false';
  dom.newTripMessage.textContent = '';
  setActiveSheet('new-trip');
  requestAnimationFrame(() => document.querySelector('#trip-name').focus({ preventScroll: true }));
}

function openTripEditor() {
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (!trip) return;
  state.editingTripId = String(trip.id);
  state.imageData = trip.cover_url || '';
  dom.newTripForm.reset();
  dom.newTripForm.elements.name.value = trip.name || '';
  dom.newTripForm.elements.destination.value = trip.destination || '';
  dom.newTripForm.elements.start_date.value = trip.start_date || '';
  dom.newTripForm.elements.end_date.value = trip.end_date || '';
  dom.newTripForm.elements.arrival_method.value = trip.arrival_method || 'avião';
  dom.newTripForm.elements.location_label.value = trip.location_label || '';
  selectTripColor(trip.secondary_color || '#4775d1');
  state.newTripPassengers = uniqueTripPassengers((state.passengers.get(trip.id) || []).map(passenger => ({
    id: passenger.id || crypto.randomUUID(),
    session: String(passenger.user_id || '') === String(state.user.id),
    userId: passenger.user_id || null,
    name: passenger.name || '',
    birthDate: passenger.birth_date || '',
    photoUrl: passenger.photo_url || ''
  })));
  renderTripPassengers();
  if (state.imageData) {
    dom.coverPreview.src = state.imageData;
    dom.coverPreview.parentElement.dataset.hasImage = 'true';
  } else {
    dom.coverPreview.removeAttribute('src');
    dom.coverPreview.parentElement.dataset.hasImage = 'false';
  }
  dom.newTripTitle.textContent = 'Editar viagem';
  dom.saveNewTrip.setAttribute('aria-label', 'Salvar viagem');
  dom.newTripMessage.textContent = '';
  setActiveSheet('new-trip');
}

function openProfile() {
  setYearMenu(false);
  state.avatarFile = null; state.avatarPreview = '';
  dom.profilePhotoInput.value = '';
  dom.profileMessage.textContent = '';
  dom.profileMessage.dataset.kind = 'info';
  syncProfileUI();
  setActiveSheet('profile');
}

function closeSheets() {
  if (state.saving) return;
  if (state.avatarPreview) URL.revokeObjectURL(state.avatarPreview);
  state.avatarFile = null; state.avatarPreview = ''; state.imageData = '';
  state.editingTripId = null;
  setActiveSheet('none');
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file), maxWidth = 1600, scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return canvas.toDataURL('image/webp', .78);
}

async function compressPassengerPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 320, 320);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', .82);
}

async function prepareAvatar(file) {
  const bitmap = await createImageBitmap(file), size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 512, 512); bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
  if (!blob) throw new Error('Falha ao preparar foto');
  return { blob, preview: URL.createObjectURL(blob) };
}

async function saveProfile() {
  const client = await trySupabase();
  if (!client) {
    dom.profileMessage.dataset.kind = 'error';
    dom.profileMessage.textContent = 'Perfil requer conexão. O roteiro continua disponível offline.';
    return;
  }
  state.saving = true; setLoading(dom.saveProfile, true);
  dom.profileMessage.dataset.kind = 'info';
  dom.profileMessage.textContent = state.avatarFile ? 'Enviando foto…' : 'Salvando perfil…';
  let avatarPath = state.profile?.avatar_path || null;
  try {
    if (state.avatarFile) {
      const extension = state.avatarFile.type === 'image/png' ? 'png' : state.avatarFile.type === 'image/webp' ? 'webp' : 'jpg';
      avatarPath = `${state.user.id}/avatar-${Date.now()}.${extension}`;
      const upload = await client.storage.from('profile-photos').upload(avatarPath, state.avatarFile, { contentType: state.avatarFile.type || 'image/jpeg', upsert: false });
      if (upload.error) throw new Error(`Foto: ${upload.error.message}`);
      dom.profileMessage.textContent = 'Salvando perfil…';
    }
    const saved = await client.from('passenger_profiles').upsert({ user_id: state.user.id, name: dom.profileNameInput.value.trim(), birth_date: dom.birthDateInput.value || null, avatar_path: avatarPath, updated_at: new Date().toISOString() }).select().single();
    if (saved.error) throw new Error(`Perfil: ${saved.error.message}`);
    await client.from('passengers').update({ name: dom.profileNameInput.value.trim(), age: ageFromBirthDate(dom.birthDateInput.value) }).eq('user_id', state.user.id);
    state.profile = saved.data;
    state.avatarFile = null;
    if (state.avatarPreview) URL.revokeObjectURL(state.avatarPreview);
    state.avatarPreview = '';
    try { await loadProfile(); } catch (error) { console.warn(error); }
    try { await loadTrips(); } catch (error) { console.warn(error); }
    state.saving = false;
    closeSheets();
  } catch (error) {
    dom.profileMessage.dataset.kind = 'error';
    dom.profileMessage.textContent = /mime type .* is not supported/i.test(error.message || '')
      ? 'O formato desta foto não é aceito pelo armazenamento. Atualize a configuração do banco e tente novamente.'
      : error.message || 'Não foi possível salvar o perfil.';
  }
  finally { state.saving = false; setLoading(dom.saveProfile, false); }
}

function createDays(tripId, startValue, endValue) {
  const days = [], end = new Date(`${endValue}T12:00:00`);
  for (let date = new Date(`${startValue}T12:00:00`), number = 1; date <= end; date.setDate(date.getDate() + 1), number += 1) days.push({ trip_id: tripId, day_number: number, date: date.toISOString().slice(0, 10), status: 'empty' });
  return days;
}

async function saveTrip() {
  const client = await trySupabase();
  if (!client) {
    dom.newTripMessage.textContent = 'Criar ou alterar a viagem requer conexão. O roteiro já salvo continua editável offline.';
    return;
  }
  const values = Object.fromEntries(new FormData(dom.newTripForm));
  if (values.end_date < values.start_date) { dom.newTripMessage.textContent = 'A data final deve ser igual ou posterior à inicial.'; return; }
  if (!state.imageData) { dom.newTripMessage.textContent = 'Escolha a imagem da viagem.'; return; }
  state.saving = true; setLoading(dom.saveNewTrip, true);
  if (state.editingTripId) {
    const tripId = state.editingTripId;
    const payload = { name: values.name.trim(), destination: values.destination.trim(), start_date: values.start_date, end_date: values.end_date, arrival_method: values.arrival_method, location_label: values.location_label.trim() || null, cover_url: state.imageData, secondary_color: state.tripColor };
    const updated = await client.from('trips').update(payload).eq('id', tripId);
    let failure = updated.error;
    if (!failure) {
      const existingPassengers = state.passengers.get(tripId) || [];
      const existingIds = new Set(existingPassengers.map(passenger => String(passenger.id)));
      const editedPassengers = uniqueTripPassengers(state.newTripPassengers);
      const retainedIds = new Set(editedPassengers.filter(passenger => existingIds.has(String(passenger.id))).map(passenger => String(passenger.id)));
      const removedIds = existingPassengers.filter(passenger => !retainedIds.has(String(passenger.id))).map(passenger => passenger.id);
      if (removedIds.length) {
        const removed = await client.from('passengers').delete().in('id', removedIds).eq('trip_id', tripId).select('id');
        failure = removed.error;
        if (!failure && (removed.data || []).length !== removedIds.length) failure = new Error('Não foi possível remover todos os passageiros duplicados.');
      }
      for (const passenger of editedPassengers) {
        if (failure) break;
        const payload = { user_id: passenger.session ? state.user.id : passenger.userId || null, name: passenger.name.trim(), birth_date: passenger.birthDate || null, photo_url: passenger.photoUrl || null, age: ageFromBirthDate(passenger.birthDate) };
        failure = existingIds.has(String(passenger.id))
          ? (await client.from('passengers').update(payload).eq('id', passenger.id).eq('trip_id', tripId)).error
          : (await client.from('passengers').insert({ ...payload, trip_id: tripId })).error;
      }
    }
    if (!failure) {
      const existing = await client.from('trip_days').select('id,date').eq('trip_id', tripId);
      failure = existing.error;
      if (!failure) {
        const wanted = createDays(tripId, values.start_date, values.end_date);
        const wantedDates = new Set(wanted.map(day => day.date));
        const obsoleteIds = (existing.data || []).filter(day => !wantedDates.has(day.date)).map(day => day.id);
        if (obsoleteIds.length) failure = (await client.from('trip_days').delete().in('id', obsoleteIds)).error;
        const existingByDate = new Map((existing.data || []).map(day => [day.date, day]));
        for (const day of wanted) {
          if (failure) break;
          const current = existingByDate.get(day.date);
          failure = current
            ? (await client.from('trip_days').update({ day_number: day.day_number }).eq('id', current.id)).error
            : (await client.from('trip_days').insert(day)).error;
        }
      }
    }
    if (failure) dom.newTripMessage.textContent = failure.message;
    else {
      state.selectedYear = Number(String(values.start_date).slice(0, 4));
      state.tripDataCache.delete(String(tripId));
      await loadTrips();
      state.saving = false;
      closeSheets();
      await openTrip(tripId, { pushHistory: false });
    }
    state.saving = false; setLoading(dom.saveNewTrip, false);
    return;
  }
  const created = await client.from('trips').insert({ user_id: state.user.id, name: values.name.trim(), destination: values.destination.trim(), start_date: values.start_date, end_date: values.end_date, arrival_method: values.arrival_method, location_label: values.location_label.trim() || null, cover_url: state.imageData, secondary_color: state.tripColor }).select().single();
  if (created.error) { dom.newTripMessage.textContent = created.error.message; state.saving = false; setLoading(dom.saveNewTrip, false); return; }
  const trip = created.data;
  const member = await client.from('trip_members').insert({ trip_id: trip.id, user_id: state.user.id, role: 'owner' });
  let failure = member.error;
  if (!failure) {
    const passengerPayload = state.newTripPassengers.map(passenger => ({
      trip_id: trip.id,
      user_id: passenger.session ? state.user.id : null,
      name: passenger.name.trim(),
      birth_date: passenger.birthDate || null,
      photo_url: passenger.photoUrl || null,
      age: ageFromBirthDate(passenger.birthDate)
    })).filter(passenger => passenger.name);
    if (passengerPayload.length) {
      const passengers = await client.from('passengers').insert(passengerPayload);
      failure = passengers.error;
    }
  }
  if (!failure) {
    const days = await client.from('trip_days').insert(createDays(trip.id, values.start_date, values.end_date));
    failure = days.error;
  }
  if (failure) {
    await client.from('trip_days').delete().eq('trip_id', trip.id);
    await client.from('passengers').delete().eq('trip_id', trip.id);
    await client.from('trip_members').delete().eq('trip_id', trip.id);
    await client.from('trips').delete().eq('id', trip.id);
    dom.newTripMessage.textContent = failure.message;
  } else {
    state.selectedYear = Number(String(values.start_date).slice(0, 4));
    await loadTrips();
    state.saving = false;
    closeSheets();
  }
  state.saving = false; setLoading(dom.saveNewTrip, false);
}

async function deleteAccount() {
  const client = await trySupabase();
  if (!client) { dom.profileMessage.textContent = 'Excluir conta requer conexão.'; return; }
  if (!window.confirm('Desativar esta conta? A sessão será encerrada, mas nenhuma viagem, foto ou outro dado será apagado.')) return;
  const result = await client.rpc('soft_delete_own_account');
  if (result.error) { dom.profileMessage.textContent = result.error.message; return; }
  await offlineStore.clearSession().catch(console.warn);
  await client.auth.signOut();
}

dom.closeDayEdit.addEventListener('click', closeDayEditor);
dom.daySheetScrim.addEventListener('click', closeDayEditor);
dom.closePlaceSearch.addEventListener('click', closePlaceSearch);
dom.placeSearchScrim.addEventListener('click', closePlaceSearch);
dom.runPlaceSearch.addEventListener('click', runPlaceSearch);
dom.placeSearchForm.addEventListener('submit', event => {
  event.preventDefault();
  if (state.placeSearch?.selectedIndex >= 0) confirmPlaceSearch();
  else runPlaceSearch();
});
dom.placeSearchInput.addEventListener('search', () => { if (dom.placeSearchInput.value.trim().length >= 3) runPlaceSearch(); });
dom.addDayLocation.addEventListener('click', addDayLocation);
dom.addDayActivity.addEventListener('click', addDayAgendaActivity);
dom.dayTitleInput.addEventListener('input', () => { if (state.dayEditor) state.dayEditor.title = dom.dayTitleInput.value; });
dom.dayNotesInput.addEventListener('input', () => { if (state.dayEditor) state.dayEditor.notes = dom.dayNotesInput.value; });
dom.dayEditForm.addEventListener('submit', event => { event.preventDefault(); saveDayEditor(); });

dom.closeTripPage.addEventListener('click', navigateBackFromTrip);
dom.editTripButton.addEventListener('click', openTripEditor);
dom.closeDayPage.addEventListener('click', navigateBackFromDay);
ensureDayTitleControl();
dom.dayPagePhotoInput.addEventListener('change', async () => {
  const file = dom.dayPagePhotoInput.files?.[0];
  if (!file) return;
  dom.dayPageCamera.dataset.loading = 'true';
  try {
    await saveDayHeroPhoto(file);
  } catch (error) {
    console.warn('Não foi possível salvar a imagem do dia', error);
  } finally {
    dom.dayPageCamera.dataset.loading = 'false';
    dom.dayPagePhotoInput.value = '';
  }
});
dom.editDayButton.addEventListener('click', () => {
  const day = state.tripDays.find(item => String(item.id) === String(state.activeDayId));
  if (day) openDayEditor(day);
});
window.addEventListener('popstate', event => {
  if (event.state?.view === 'day' && event.state.dayId) {
    if (event.state.tripId && String(state.activeTripId) !== String(event.state.tripId)) openTrip(event.state.tripId, { pushHistory: false }).then(() => openDayPage(event.state.dayId, { pushHistory: false }));
    else openDayPage(event.state.dayId, { pushHistory: false });
  } else if (event.state?.view === 'trip' && event.state.tripId) {
    closeDayPage();
    if (String(state.activeTripId) !== String(event.state.tripId) || !state.tripDays.length) openTrip(event.state.tripId, { pushHistory: false });
  } else closeTripPage();
});
dom.profileButton.addEventListener('click', openProfile);
dom.newTripButton.addEventListener('click', openNewTrip);
dom.emptyNewTripButton.addEventListener('click', openNewTrip);
dom.closeNewTrip.addEventListener('click', closeSheets);
dom.closeProfile.addEventListener('click', closeSheets);
dom.scrim.addEventListener('click', closeSheets);
dom.editTripsButton.addEventListener('click', () => setEditingMode(!state.editing));
dom.deleteSelectedTrips.addEventListener('click', softDeleteSelectedTrips);
dom.yearButton.addEventListener('click', () => setYearMenu(document.body.dataset.yearMenu !== 'open'));
document.addEventListener('click', event => { if (document.body.dataset.yearMenu === 'open' && !dom.tripHeading.contains(event.target)) setYearMenu(false); });
dom.birthDateInput.addEventListener('input', syncAge);
dom.logoutButton.addEventListener('click', async () => {
  await offlineStore.clearSession().catch(console.warn);
  const client = await trySupabase();
  if (client) await client.auth.signOut().catch(console.warn);
  state.user = null;
  state.profile = null;
  state.trips = [];
  state.passengers.clear();
  state.tripDataCache.clear();
  state.tripDataLoads.clear();
  syncTripList();
  closeSheets();
  setSessionView('anonymous');
});
dom.deleteAccountButton.addEventListener('click', deleteAccount);

for (const option of dom.tripColorPalette.querySelectorAll('.trip-color-option')) option.addEventListener('click', () => selectTripColor(option.dataset.color));
dom.tripColorCustom.addEventListener('input', () => selectTripColor(dom.tripColorCustom.value, true));
dom.addTripPassenger.addEventListener('click', addTripPassenger);

dom.coverInput.addEventListener('change', async () => {
  const file = dom.coverInput.files?.[0]; if (!file) return;
  try { state.imageData = await compressImage(file); dom.coverPreview.src = state.imageData; dom.coverPreview.parentElement.dataset.hasImage = 'true'; }
  catch { dom.newTripMessage.textContent = 'Não foi possível ler essa imagem. Escolha outra.'; }
});

dom.profilePhotoInput.addEventListener('change', async () => {
  const file = dom.profilePhotoInput.files?.[0]; if (!file) return;
  try {
    if (state.avatarPreview) URL.revokeObjectURL(state.avatarPreview);
    const prepared = await prepareAvatar(file); state.avatarFile = prepared.blob; state.avatarPreview = prepared.preview; dom.profileEditorImage.src = prepared.preview;
  } catch { dom.profileMessage.textContent = 'Não foi possível preparar essa foto.'; }
});

dom.newTripForm.addEventListener('submit', event => { event.preventDefault(); saveTrip(); });
dom.profileForm.addEventListener('submit', event => { event.preventDefault(); saveProfile(); });
dom.authForm.addEventListener('submit', async event => {
  event.preventDefault(); dom.authMessage.textContent = '';
  const client = await trySupabase();
  if (!client) { dom.authMessage.textContent = 'Sem conexão. Abra o app normalmente se este aparelho já tiver uma cópia da viagem.'; return; }
  const result = await client.auth.signInWithPassword(Object.fromEntries(new FormData(dom.authForm)));
  if (result.error) { dom.authMessage.textContent = result.error.message; return; }
  state.user = result.data.user;
  await offlineStore.cacheSession(state.user);
  try {
    await loadProfile();
    await loadTrips();
    await cacheCompleteWorkspace().catch(error => console.warn('Snapshot offline incompleto', error));
    setSessionView('authenticated');
    await refreshSyncStatus();
  }
  catch (error) { dom.authMessage.textContent = error.message; setSessionView('anonymous'); }
});

async function boot() {
  try {
    setSplashStatus('Preparando armazenamento local…');
    await offlineStore.open();
    navigator.storage?.persist?.().catch(() => {});

    const cachedUser = await offlineStore.getCachedSession();
    if (cachedUser) {
      state.user = cachedUser;
      const hasLocalWorkspace = await loadLocalWorkspace(cachedUser);

      if (hasLocalWorkspace) {
        setSessionView('authenticated');
        await refreshSyncStatus();
        setSplashStatus('Pronto');
        refreshWorkspaceInBackground();
        return;
      }
    }

    setSplashStatus('Conectando à sua conta…');
    const client = await trySupabase(2200);
    let remoteUser = null;

    if (client) {
      const { data } = await client.auth.getSession();
      remoteUser = data.session?.user || null;
    }

    state.user = remoteUser || cachedUser || null;
    if (!state.user) {
      setSessionView('anonymous');
      setSplashStatus('Pronto');
      return;
    }

    await offlineStore.cacheSession(state.user);

    setSplashStatus('Carregando seu perfil…');
    await loadProfile({ allowLocalFallback: true });

    setSplashStatus('Carregando suas viagens…');
    await loadTrips({ allowLocalFallback: true });

    setSessionView('authenticated');
    await refreshSyncStatus();
    setSplashStatus('Pronto');

    refreshWorkspaceInBackground();
  } catch (error) {
    const localUser = await offlineStore.getCachedSession().catch(() => null);

    if (localUser) {
      try {
        state.user = localUser;
        setSplashStatus('Abrindo a cópia salva neste iPhone…');
        await loadLocalWorkspace(localUser);
        setSessionView('authenticated');
        await refreshSyncStatus();
        dom.authMessage.textContent = 'Modo offline: usando a cópia salva neste aparelho.';
      } catch {
        dom.authMessage.textContent = error.message || 'Não foi possível iniciar o aplicativo.';
        setSessionView('anonymous');
      }
    } else {
      dom.authMessage.textContent = error.message || 'Não foi possível iniciar o aplicativo.';
      setSessionView('anonymous');
    }
  } finally {
    const revealApp = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.dataset.appReady = 'true';
    }));
    if (window.__appStylesReady) revealApp();
    else document.addEventListener('appstylesready', revealApp, { once: true });
  }
}

window.addEventListener('offline', () => { refreshSyncStatus().catch(console.warn); });
window.addEventListener('online', () => {
  refreshSyncStatus().catch(console.warn);
  flushOutbox().then(synced => {
    if (synced && state.activeTripId) {
      state.tripDataCache.delete(String(state.activeTripId));
      openTrip(state.activeTripId, { pushHistory: false, forceRefresh: true }).catch(console.warn);
    }
  }).catch(console.warn);
});

ensureSupabase()
  .then(client => client.auth.onAuthStateChange((_event, session) => {
    if (session) {
      offlineStore.cacheSession(session.user).catch(console.warn);
      return;
    }
    if (!navigator.onLine && state.user) return;
    state.user = null; state.profile = null; state.trips = []; state.passengers.clear(); state.tripDataCache.clear(); state.tripDataLoads.clear();
    syncTripList(); closeSheets(); setSessionView('anonymous');
  }))
  .catch(() => {});

boot();
