import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient('https://siabldasqinpfmxslwji.supabase.co', 'sb_publishable_UgbBIOq1TnInuPRrQpAFag_JLIzYuFf');
const profilePhoto = 'assets/cintia.png';

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
  activeTripId: null,
  dayEditor: null
};

const dom = {
  authView: document.querySelector('#auth_view'), authForm: document.querySelector('#auth_form'), authMessage: document.querySelector('#auth_message'),
  home: document.querySelector('#user_home'), profileButton: document.querySelector('#profile_button'), headerProfileImage: document.querySelector('#header_profile_image'), headerProfileFallback: document.querySelector('#header_profile_fallback'),
  editTripsButton: document.querySelector('#edit_trips_button'), newTripButton: document.querySelector('#new_trip_button'), emptyNewTripButton: document.querySelector('#empty_new_trip_button'), sessionEmail: document.querySelector('#session_email'), tripHeading: document.querySelector('#trip_heading'), yearButton: document.querySelector('#year_selector_button'), currentYear: document.querySelector('#current_year'), yearMenu: document.querySelector('#year_menu'), yearList: document.querySelector('#year_list'),
  tripList: document.querySelector('#trip_list'), homeEmpty: document.querySelector('#home_empty'), scrim: document.querySelector('#sheet_scrim'), tripEditFooter: document.querySelector('#trip_edit_footer'), deleteSelectedTrips: document.querySelector('#delete_selected_trips'), tripPage: document.querySelector('#trip_page'), closeTripPage: document.querySelector('#close_trip_page'), tripPageHero: document.querySelector('#trip_page_hero'), tripPageTitle: document.querySelector('#trip_page_title'), tripPageDates: document.querySelector('#trip_page_dates'), tripPagePassengers: document.querySelector('#trip_page_passengers'), tripPagePassengerCount: document.querySelector('#trip_page_passenger_count'), tripDayList: document.querySelector('#trip_day_list'), tripDayMessage: document.querySelector('#trip_day_message'),
  newTripSheet: document.querySelector('#home_new_trip'), newTripForm: document.querySelector('#new_trip_form'), closeNewTrip: document.querySelector('#close_new_trip'), saveNewTrip: document.querySelector('#save_new_trip'), newTripMessage: document.querySelector('#new_trip_message'), coverInput: document.querySelector('#cover-image'), coverPreview: document.querySelector('#cover_preview_image'), tripColorValue: document.querySelector('#trip-color-value'), tripColorPalette: document.querySelector('#trip_color_palette'), tripColorCustom: document.querySelector('#trip-color-custom'), newTripPassengerList: document.querySelector('#new_trip_passenger_list'), addTripPassenger: document.querySelector('#add_trip_passenger'),
  dayEditSheet: document.querySelector('#day_edit_sheet'), daySheetScrim: document.querySelector('#day_sheet_scrim'), dayEditForm: document.querySelector('#day_edit_form'), closeDayEdit: document.querySelector('#close_day_edit'), saveDayEdit: document.querySelector('#save_day_edit'), dayEditTitle: document.querySelector('#day_edit_title'), dayEditDate: document.querySelector('#day_edit_date'), dayTitleInput: document.querySelector('#day-title-input'), dayPlaceInput: document.querySelector('#day-place-input'), dayPhotoInput: document.querySelector('#day-photo-input'), dayPhotoPreview: document.querySelector('#day_photo_preview'), dayPhotoPreviewImage: document.querySelector('#day_photo_preview_image'), dayAgendaEditor: document.querySelector('#day_agenda_editor'), addDayActivity: document.querySelector('#add_day_activity'), dayNotesInput: document.querySelector('#day-notes-input'), dayEditMessage: document.querySelector('#day_edit_message'),
  profileSheet: document.querySelector('#profile-sheet'), profileForm: document.querySelector('#profile_form'), closeProfile: document.querySelector('#close_profile'), saveProfile: document.querySelector('#save_profile'), profileMessage: document.querySelector('#profile_message'), profileEditorImage: document.querySelector('#profile_editor_image'), profilePhotoInput: document.querySelector('#profile-photo'), profileDisplayName: document.querySelector('#profile_display_name'), profileEmail: document.querySelector('#profile_email'), profileNameInput: document.querySelector('#profile-name'), birthDateInput: document.querySelector('#birth-date'), profileAge: document.querySelector('#profile_age'), profileCreatedAt: document.querySelector('#profile_created_at'), logoutButton: document.querySelector('#logout_button'), deleteAccountButton: document.querySelector('#delete_account_button')
};

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

function syncPassengerList(container, passengers) {
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

function renderTripDays(days, activitiesByDay = new Map()) {
  dom.tripDayList.replaceChildren();
  const periodLabels = { morning: 'manhã', afternoon: 'tarde', night: 'noite' };
  for (const day of days) {
    const activities = activitiesByDay.get(String(day.id)) || [];
    const firstPlace = activities.find(activity => activity.place_name) || activities[0];
    const photo = day.photo_url || activities.find(activity => activity.photo_url)?.photo_url || '';
    const titleText = day.title || day.main_place_name || firstPlace?.place_name || firstPlace?.title || `Dia ${day.day_number}`;

    const card = document.createElement('li');
    card.className = 'trip-day-card';

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
          time.textContent = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(activity.starts_at));
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
    const empty = !day.title && !day.summary && !day.main_place_name && !day.photo_url && activities.length === 0;
    button.setAttribute('aria-label', empty ? `Preencher dia ${day.day_number}` : `Abrir dia ${day.day_number}`);
    button.addEventListener('click', () => {
      if (empty) openDayEditor(day);
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
    const remove = document.createElement('button');
    remove.className = 'new-trip-passenger-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remover horário');
    remove.addEventListener('click', () => {
      state.dayEditor.activities = state.dayEditor.activities.filter(item => item.id !== activity.id);
      renderDayAgendaEditor();
    });
    row.append(time, text, remove);
    dom.dayAgendaEditor.append(row);
  }
  if (focusLast) dom.dayAgendaEditor.lastElementChild?.querySelector('input[type="text"]')?.focus({ preventScroll: true });
}

function addDayAgendaActivity() {
  state.dayEditor.activities.push({ id: crypto.randomUUID(), time: '09:00', text: '' });
  renderDayAgendaEditor(true);
}

function openDayEditor(day) {
  state.dayEditor = {
    day,
    title: day.title || '',
    place: day.main_place_name || '',
    photoUrl: day.photo_url || '',
    notes: day.summary || '',
    activities: [{ id: crypto.randomUUID(), time: '09:00', text: '' }]
  };
  dom.dayEditTitle.textContent = `Dia ${day.day_number}`;
  dom.dayEditDate.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${day.date}T12:00:00`));
  dom.dayTitleInput.value = state.dayEditor.title;
  dom.dayPlaceInput.value = state.dayEditor.place;
  dom.dayNotesInput.value = state.dayEditor.notes;
  dom.dayPhotoInput.value = '';
  dom.dayPhotoPreview.dataset.hasImage = String(Boolean(state.dayEditor.photoUrl));
  if (state.dayEditor.photoUrl) dom.dayPhotoPreviewImage.src = state.dayEditor.photoUrl;
  else dom.dayPhotoPreviewImage.removeAttribute('src');
  dom.dayEditMessage.textContent = '';
  renderDayAgendaEditor();
  dom.dayEditSheet.setAttribute('aria-hidden', 'false');
  document.body.dataset.daySheet = 'open';
}

function closeDayEditor() {
  if (state.saving) return;
  state.dayEditor = null;
  document.body.dataset.daySheet = 'closed';
  dom.dayEditSheet.setAttribute('aria-hidden', 'true');
}

async function saveDayEditor() {
  if (!state.dayEditor) return;
  state.saving = true;
  setLoading(dom.saveDayEdit, true);
  const editor = state.dayEditor;
  const savedDay = await supabase.from('trip_days').update({
    title: editor.title.trim() || null,
    summary: editor.notes.trim() || null,
    main_place_name: editor.place.trim() || null,
    photo_url: editor.photoUrl || null,
    status: 'planned'
  }).eq('id', editor.day.id);
  if (savedDay.error) {
    dom.dayEditMessage.textContent = savedDay.error.message;
    state.saving = false;
    setLoading(dom.saveDayEdit, false);
    return;
  }
  const activities = editor.activities.filter(activity => activity.text.trim()).map((activity, position) => ({
    day_id: editor.day.id,
    period: periodFromTime(activity.time),
    position,
    title: activity.text.trim(),
    starts_at: `${editor.day.date}T${activity.time || '09:00'}:00`,
    place_name: position === 0 ? editor.place.trim() || null : null,
    photo_url: position === 0 ? editor.photoUrl || null : null
  }));
  if (activities.length) {
    const inserted = await supabase.from('activities').insert(activities);
    if (inserted.error) {
      dom.dayEditMessage.textContent = inserted.error.message;
      state.saving = false;
      setLoading(dom.saveDayEdit, false);
      return;
    }
  }
  state.saving = false;
  setLoading(dom.saveDayEdit, false);
  closeDayEditor();
  if (state.activeTripId) await openTrip(state.activeTripId, { pushHistory: false });
}

async function openTrip(tripId, { pushHistory = true } = {}) {
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
  dom.tripDayList.replaceChildren();
  dom.tripDayMessage.textContent = 'Carregando dias…';
  dom.tripPage.setAttribute('aria-hidden', 'false');
  document.body.dataset.tripPage = 'open';

  const result = await supabase.from('trip_days').select('*').eq('trip_id', trip.id).order('day_number');
  if (state.activeTripId !== String(trip.id)) return;
  if (result.error) {
    dom.tripDayMessage.textContent = result.error.message;
    return;
  }
  const days = result.data || [];
  const activitiesByDay = new Map();
  if (days.length) {
    const activityResult = await supabase.from('activities').select('*').in('day_id', days.map(day => day.id)).order('position');
    if (state.activeTripId !== String(trip.id)) return;
    if (activityResult.error) {
      dom.tripDayMessage.textContent = activityResult.error.message;
      return;
    }
    for (const activity of activityResult.data || []) {
      const key = String(activity.day_id);
      const list = activitiesByDay.get(key) || [];
      list.push(activity);
      activitiesByDay.set(key, list);
    }
  }
  renderTripDays(days, activitiesByDay);
}

function closeTripPage() {
  state.activeTripId = null;
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
  const ids = [...state.selectedTripIds];
  dom.deleteSelectedTrips.disabled = true;
  const result = await supabase.from('trips').update({ deleted_at: new Date().toISOString() }).in('id', ids).eq('user_id', state.user.id);
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

async function loadTrips() {
  const result = await supabase.from('trips').select('*').is('deleted_at', null).order('start_date', { ascending: true });
  if (result.error) throw result.error;
  state.trips = result.data || [];
  state.passengers.clear();
  if (state.trips.length) {
    const passengers = await supabase.from('passengers').select('*').in('trip_id', state.trips.map(trip => trip.id)).order('created_at');
    if (passengers.error) throw passengers.error;
    for (const passenger of passengers.data || []) {
      const list = state.passengers.get(passenger.trip_id) || [];
      list.push(passenger); state.passengers.set(passenger.trip_id, list);
    }
  }
  syncYearList();
  syncTripList();
}

async function loadProfile() {
  const result = await supabase.from('passenger_profiles').select('*').eq('user_id', state.user.id).maybeSingle();
  if (result.error) state.profile = { user_id: state.user.id, name: state.user.user_metadata?.name || 'Cíntia', birth_date: null, avatar_path: null };
  else state.profile = result.data || { user_id: state.user.id, name: state.user.user_metadata?.name || 'Cíntia', birth_date: null, avatar_path: null };
  if (state.profile.is_deleted) { await supabase.auth.signOut(); throw new Error('Esta conta está desativada. Seus dados continuam preservados.'); }
  if (state.profile.avatar_path) {
    const signed = await supabase.storage.from('profile-photos').createSignedUrl(state.profile.avatar_path, 3600);
    if (!signed.error) state.profile.avatar_url = signed.data.signedUrl;
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

function openNewTrip() {
  setYearMenu(false);
  state.imageData = '';
  dom.newTripForm.reset();
  selectTripColor('#4775d1');
  resetTripPassengers();
  dom.coverPreview.removeAttribute('src');
  dom.coverPreview.parentElement.dataset.hasImage = 'false';
  dom.newTripMessage.textContent = '';
  setActiveSheet('new-trip');
  requestAnimationFrame(() => document.querySelector('#trip-name').focus({ preventScroll: true }));
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
  state.saving = true; setLoading(dom.saveProfile, true);
  dom.profileMessage.dataset.kind = 'info';
  dom.profileMessage.textContent = state.avatarFile ? 'Enviando foto…' : 'Salvando perfil…';
  let avatarPath = state.profile?.avatar_path || null;
  try {
    if (state.avatarFile) {
      const extension = state.avatarFile.type === 'image/png' ? 'png' : state.avatarFile.type === 'image/webp' ? 'webp' : 'jpg';
      avatarPath = `${state.user.id}/avatar-${Date.now()}.${extension}`;
      const upload = await supabase.storage.from('profile-photos').upload(avatarPath, state.avatarFile, { contentType: state.avatarFile.type || 'image/jpeg', upsert: false });
      if (upload.error) throw new Error(`Foto: ${upload.error.message}`);
      dom.profileMessage.textContent = 'Salvando perfil…';
    }
    const saved = await supabase.from('passenger_profiles').upsert({ user_id: state.user.id, name: dom.profileNameInput.value.trim(), birth_date: dom.birthDateInput.value || null, avatar_path: avatarPath, updated_at: new Date().toISOString() }).select().single();
    if (saved.error) throw new Error(`Perfil: ${saved.error.message}`);
    await supabase.from('passengers').update({ name: dom.profileNameInput.value.trim(), age: ageFromBirthDate(dom.birthDateInput.value) }).eq('user_id', state.user.id);
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
  const values = Object.fromEntries(new FormData(dom.newTripForm));
  if (values.end_date < values.start_date) { dom.newTripMessage.textContent = 'A data final deve ser igual ou posterior à inicial.'; return; }
  if (!state.imageData) { dom.newTripMessage.textContent = 'Escolha a imagem da viagem.'; return; }
  state.saving = true; setLoading(dom.saveNewTrip, true);
  const created = await supabase.from('trips').insert({ user_id: state.user.id, name: values.name.trim(), destination: values.destination.trim(), start_date: values.start_date, end_date: values.end_date, arrival_method: values.arrival_method, location_label: values.location_label.trim() || null, cover_url: state.imageData, secondary_color: state.tripColor }).select().single();
  if (created.error) { dom.newTripMessage.textContent = created.error.message; state.saving = false; setLoading(dom.saveNewTrip, false); return; }
  const trip = created.data;
  const member = await supabase.from('trip_members').insert({ trip_id: trip.id, user_id: state.user.id, role: 'owner' });
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
      const passengers = await supabase.from('passengers').insert(passengerPayload);
      failure = passengers.error;
    }
  }
  if (!failure) {
    const days = await supabase.from('trip_days').insert(createDays(trip.id, values.start_date, values.end_date));
    failure = days.error;
  }
  if (failure) {
    await supabase.from('trip_days').delete().eq('trip_id', trip.id);
    await supabase.from('passengers').delete().eq('trip_id', trip.id);
    await supabase.from('trip_members').delete().eq('trip_id', trip.id);
    await supabase.from('trips').delete().eq('id', trip.id);
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
  if (!window.confirm('Desativar esta conta? A sessão será encerrada, mas nenhuma viagem, foto ou outro dado será apagado.')) return;
  const result = await supabase.rpc('soft_delete_own_account');
  if (result.error) { dom.profileMessage.textContent = result.error.message; return; }
  await supabase.auth.signOut();
}

dom.closeDayEdit.addEventListener('click', closeDayEditor);
dom.daySheetScrim.addEventListener('click', closeDayEditor);
dom.addDayActivity.addEventListener('click', addDayAgendaActivity);
dom.dayTitleInput.addEventListener('input', () => { if (state.dayEditor) state.dayEditor.title = dom.dayTitleInput.value; });
dom.dayPlaceInput.addEventListener('input', () => { if (state.dayEditor) state.dayEditor.place = dom.dayPlaceInput.value; });
dom.dayNotesInput.addEventListener('input', () => { if (state.dayEditor) state.dayEditor.notes = dom.dayNotesInput.value; });
dom.dayPhotoInput.addEventListener('change', async () => {
  const file = dom.dayPhotoInput.files?.[0];
  if (!file || !state.dayEditor) return;
  try {
    state.dayEditor.photoUrl = await compressImage(file);
    dom.dayPhotoPreviewImage.src = state.dayEditor.photoUrl;
    dom.dayPhotoPreview.dataset.hasImage = 'true';
  } catch {
    dom.dayEditMessage.textContent = 'Não foi possível preparar a foto do dia.';
  }
});
dom.dayEditForm.addEventListener('submit', event => { event.preventDefault(); saveDayEditor(); });

dom.closeTripPage.addEventListener('click', navigateBackFromTrip);
window.addEventListener('popstate', event => {
  if (event.state?.view === 'trip' && event.state.tripId) openTrip(event.state.tripId, { pushHistory: false });
  else closeTripPage();
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
dom.logoutButton.addEventListener('click', () => supabase.auth.signOut());
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
  const result = await supabase.auth.signInWithPassword(Object.fromEntries(new FormData(dom.authForm)));
  if (result.error) { dom.authMessage.textContent = result.error.message; return; }
  state.user = result.data.user;
  try { await loadProfile(); await loadTrips(); setSessionView('authenticated'); }
  catch (error) { dom.authMessage.textContent = error.message; setSessionView('anonymous'); }
});

async function boot() {
  try {
    const { data } = await supabase.auth.getSession();
    state.user = data.session?.user || null;
    if (!state.user) {
      setSessionView('anonymous');
      return;
    }
    try {
      await loadProfile();
      await loadTrips();
      setSessionView('authenticated');
    } catch (error) {
      dom.authMessage.textContent = error.message;
      setSessionView('anonymous');
    }
  } catch (error) {
    dom.authMessage.textContent = error.message || 'Não foi possível iniciar o aplicativo.';
    setSessionView('anonymous');
  } finally {
    const revealApp = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.dataset.appReady = 'true';
    }));
    if (window.__appStylesReady) revealApp();
    else document.addEventListener('appstylesready', revealApp, { once: true });
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) return;
  state.user = null; state.profile = null; state.trips = []; state.passengers.clear();
  syncTripList(); closeSheets(); setSessionView('anonymous');
});

boot();
