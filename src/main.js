import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient('https://siabldasqinpfmxslwji.supabase.co', 'sb_publishable_UgbBIOq1TnInuPRrQpAFag_JLIzYuFf');
const profilePhoto = 'assets/cintia.png';

const state = {
  user: null,
  profile: null,
  trips: [],
  passengers: new Map(),
  imageData: '',
  avatarFile: null,
  avatarPreview: '',
  saving: false,
  editing: false
};

const dom = {
  authView: document.querySelector('#auth_view'), authForm: document.querySelector('#auth_form'), authMessage: document.querySelector('#auth_message'),
  home: document.querySelector('#user_home'), profileButton: document.querySelector('#profile_button'), headerProfileImage: document.querySelector('#header_profile_image'), headerProfileFallback: document.querySelector('#header_profile_fallback'),
  editTripsButton: document.querySelector('#edit_trips_button'), newTripButton: document.querySelector('#new_trip_button'), emptyNewTripButton: document.querySelector('#empty_new_trip_button'), sessionEmail: document.querySelector('#session_email'),
  tripList: document.querySelector('#trip_list'), homeEmpty: document.querySelector('#home_empty'), scrim: document.querySelector('#sheet_scrim'),
  newTripSheet: document.querySelector('#home_new_trip'), newTripForm: document.querySelector('#new_trip_form'), closeNewTrip: document.querySelector('#close_new_trip'), saveNewTrip: document.querySelector('#save_new_trip'), newTripMessage: document.querySelector('#new_trip_message'), coverInput: document.querySelector('#cover-image'), coverPreview: document.querySelector('#cover_preview_image'),
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

function createTripNode(trip) {
  const item = document.createElement('li');
  const article = document.createElement('article'); article.className = 'trip-card';
  const button = document.createElement('button'); button.className = 'trip-card-button'; button.type = 'button';
  const owner = document.createElement('span'); owner.className = 'trip-owner-flag';
  const timing = document.createElement('span'); timing.className = 'trip-status';
  const copy = document.createElement('span'); copy.className = 'trip-copy';
  const title = document.createElement('h2');
  const dates = document.createElement('span'); dates.className = 'trip-dates';
  const footer = document.createElement('span'); footer.className = 'trip-footer';
  const stack = document.createElement('span'); stack.className = 'passenger-stack';
  const count = document.createElement('span'); count.className = 'passenger-count'; stack._count = count; stack.append(count);
  footer.append(stack); copy.append(title, dates, footer); button.append(owner, timing, copy); article.append(button); item.append(article);
  item._refs = { article, button, owner, timing, title, dates, stack };
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
  syncPassengerList(refs.stack, state.passengers.get(trip.id) || []);
}

function syncTripList() {
  const wanted = new Set(state.trips.map(trip => String(trip.id)));
  for (const item of [...dom.tripList.children]) if (!wanted.has(item.dataset.tripId)) item.remove();
  for (const trip of state.trips) {
    let item = [...dom.tripList.children].find(node => node.dataset.tripId === String(trip.id));
    if (!item) item = createTripNode(trip); else updateTripNode(item, trip);
    dom.tripList.append(item);
  }
  const empty = state.trips.length === 0;
  dom.homeEmpty.setAttribute('aria-hidden', String(!empty));
  dom.tripList.setAttribute('aria-hidden', String(empty));
}

async function loadTrips() {
  const result = await supabase.from('trips').select('*').order('start_date', { ascending: true });
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

function openNewTrip() {
  state.imageData = '';
  dom.newTripForm.reset();
  dom.coverPreview.removeAttribute('src');
  dom.coverPreview.parentElement.dataset.hasImage = 'false';
  dom.newTripMessage.textContent = '';
  setActiveSheet('new-trip');
  requestAnimationFrame(() => document.querySelector('#trip-name').focus({ preventScroll: true }));
}

function openProfile() {
  state.avatarFile = null; state.avatarPreview = '';
  dom.profilePhotoInput.value = '';
  dom.profileMessage.textContent = '';
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

async function prepareAvatar(file) {
  const bitmap = await createImageBitmap(file), size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 512, 512); bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
  if (!blob) throw new Error('Falha ao preparar foto');
  return { blob, preview: URL.createObjectURL(blob) };
}

async function saveProfile() {
  state.saving = true; setLoading(dom.saveProfile, true);
  dom.profileMessage.textContent = state.avatarFile ? 'Enviando foto…' : 'Salvando perfil…';
  let avatarPath = state.profile?.avatar_path || null;
  try {
    if (state.avatarFile) {
      avatarPath = `${state.user.id}/avatar-${Date.now()}.webp`;
      const upload = await supabase.storage.from('profile-photos').upload(avatarPath, state.avatarFile, { contentType: 'image/webp', upsert: false });
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
  } catch (error) { dom.profileMessage.textContent = error.message || 'Não foi possível salvar o perfil.'; }
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
  const created = await supabase.from('trips').insert({ user_id: state.user.id, name: values.name.trim(), destination: values.destination.trim(), start_date: values.start_date, end_date: values.end_date, arrival_method: values.arrival_method, location_label: values.location_label.trim() || null, cover_url: state.imageData }).select().single();
  if (created.error) { dom.newTripMessage.textContent = created.error.message; state.saving = false; setLoading(dom.saveNewTrip, false); return; }
  const trip = created.data;
  const results = await Promise.all([
    supabase.from('trip_members').insert({ trip_id: trip.id, user_id: state.user.id, role: 'owner' }),
    supabase.from('passengers').insert({ trip_id: trip.id, user_id: state.user.id, name: profileName(), photo_url: null, age: ageFromBirthDate(state.profile?.birth_date) }),
    supabase.from('trip_days').insert(createDays(trip.id, values.start_date, values.end_date))
  ]);
  const failure = results.find(result => result.error);
  if (failure) dom.newTripMessage.textContent = failure.error.message;
  else { await loadTrips(); state.saving = false; closeSheets(); }
  state.saving = false; setLoading(dom.saveNewTrip, false);
}

async function deleteAccount() {
  if (!window.confirm('Desativar esta conta? A sessão será encerrada, mas nenhuma viagem, foto ou outro dado será apagado.')) return;
  const result = await supabase.rpc('soft_delete_own_account');
  if (result.error) { dom.profileMessage.textContent = result.error.message; return; }
  await supabase.auth.signOut();
}

dom.profileButton.addEventListener('click', openProfile);
dom.newTripButton.addEventListener('click', openNewTrip);
dom.emptyNewTripButton.addEventListener('click', openNewTrip);
dom.closeNewTrip.addEventListener('click', closeSheets);
dom.closeProfile.addEventListener('click', closeSheets);
dom.scrim.addEventListener('click', closeSheets);
dom.editTripsButton.addEventListener('click', () => { state.editing = !state.editing; document.body.dataset.editing = String(state.editing); dom.editTripsButton.textContent = state.editing ? 'OK' : 'Editar'; });
dom.birthDateInput.addEventListener('input', syncAge);
dom.logoutButton.addEventListener('click', () => supabase.auth.signOut());
dom.deleteAccountButton.addEventListener('click', deleteAccount);

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
  const { data } = await supabase.auth.getSession(); state.user = data.session?.user || null;
  if (!state.user) { setSessionView('anonymous'); return; }
  try { await loadProfile(); await loadTrips(); setSessionView('authenticated'); }
  catch (error) { dom.authMessage.textContent = error.message; setSessionView('anonymous'); }
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) return;
  state.user = null; state.profile = null; state.trips = []; state.passengers.clear();
  syncTripList(); closeSheets(); setSessionView('anonymous');
});

boot();
