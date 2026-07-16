import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(
  'https://siabldasqinpfmxslwji.supabase.co',
  'sb_publishable_UgbBIOq1TnInuPRrQpAFag_JLIzYuFf'
);

const app = document.querySelector('#app');
const profilePhoto = 'assets/paulo.jpeg';

const state = {
  user: null,
  trips: [],
  passengers: new Map(),
  sheetOpen: false,
  imageData: '',
  saving: false,
  editing: false
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

const displayDate = value => value
  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      .format(new Date(`${value}T12:00:00`)).replace('.', '')
  : '';

function profileName() {
  return state.user?.user_metadata?.full_name || state.user?.user_metadata?.name || 'Paulo';
}

function profileImage() {
  return state.user?.user_metadata?.avatar_url || profilePhoto;
}

function tripTiming(trip) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${trip.start_date}T00:00:00`);
  const end = new Date(`${trip.end_date}T23:59:59`);
  if (today > end) return 'viagem realizada';
  if (today >= start) return 'em andamento';
  const days = Math.ceil((start - today) / 86400000);
  return days === 1 ? 'amanhã' : `em ${days} dias`;
}

function passengerAvatar(passenger) {
  const initial = esc(passenger.name?.trim()?.[0]?.toUpperCase() || '?');
  return `<span class="passenger-photo">${passenger.photo_url
    ? `<img src="${esc(passenger.photo_url)}" alt="">`
    : initial}</span>`;
}

function tripCard(trip) {
  const passengers = state.passengers.get(trip.id) || [];
  const owned = trip.user_id === state.user.id;
  const background = trip.cover_url ? `style="background-image:url('${esc(trip.cover_url)}')"` : '';
  return `<li>
    <article class="trip-card" ${background}>
      <button class="trip-card-button" type="button" data-action="open-trip" data-id="${trip.id}" aria-label="Abrir ${esc(trip.name)}">
        <span class="trip-status">${esc(tripTiming(trip))}</span>
        <span class="trip-copy">
          <h2>${esc(trip.name)}</h2>
          <span class="trip-dates">${esc(displayDate(trip.start_date))} — ${esc(displayDate(trip.end_date))}</span>
          <span class="trip-footer">
            <span class="passenger-stack">
              ${passengers.slice(0, 5).map(passengerAvatar).join('')}
              <span class="passenger-count">${passengers.length} ${passengers.length === 1 ? 'passageiro' : 'passageiros'}</span>
            </span>
            <span class="trip-owner">${owned ? 'criada por você' : 'viagem compartilhada'}</span>
          </span>
        </span>
      </button>
    </article>
  </li>`;
}

function newTripSheet() {
  return `<button class="scrim" type="button" data-action="close-sheet" aria-label="Fechar formulário"></button>
    <section id="home_new_trip" class="new-trip-sheet" aria-hidden="${!state.sheetOpen}" aria-labelledby="new-trip-title">
      <form data-form="new-trip">
        <header class="sheet-header">
          <button class="sheet-control" type="button" data-action="close-sheet" aria-label="Cancelar">×</button>
          <h2 id="new-trip-title">Nova viagem</h2>
          <button class="sheet-control confirm" type="submit" aria-label="Criar viagem" ${state.saving ? 'disabled' : ''}>✓</button>
        </header>

        <section class="form-section">
          <h3>Viagem</h3>
          <div class="form-group">
            <div class="form-row"><label for="trip-name">Nome</label><input id="trip-name" name="name" required autocomplete="off" placeholder="Lisboa e Paris"></div>
            <div class="form-row"><label for="destination">Destino</label><input id="destination" name="destination" required autocomplete="off" placeholder="Portugal e França"></div>
            <div class="form-row"><label for="start-date">Início</label><input id="start-date" name="start_date" type="date" required></div>
            <div class="form-row"><label for="end-date">Fim</label><input id="end-date" name="end_date" type="date" required></div>
          </div>
        </section>

        <section class="form-section">
          <h3>Chegada</h3>
          <div class="form-group">
            <div class="form-row"><label for="arrival-method">Transporte</label><select id="arrival-method" name="arrival_method"><option value="avião">Avião</option><option value="trem">Trem</option><option value="carro">Carro</option><option value="ônibus">Ônibus</option><option value="navio">Navio</option><option value="outro">Outro</option></select></div>
            <div class="form-row"><label for="arrival-place">Local</label><input id="arrival-place" name="location_label" autocomplete="off" placeholder="Aeroporto de Lisboa"></div>
          </div>
        </section>

        <section class="form-section">
          <h3>Imagem</h3>
          <div class="form-group">
            <label class="form-row upload-row" for="cover-image">
              <span class="upload-copy">Foto da viagem<small>Escolha uma imagem do aparelho</small></span>
              <span class="upload-preview">${state.imageData ? `<img src="${state.imageData}" alt="Prévia da imagem">` : '<span class="upload-placeholder">＋</span>'}</span>
              <input id="cover-image" name="cover" type="file" accept="image/*" required>
            </label>
          </div>
          <p class="form-note">A imagem será ajustada para o card antes de ser salva.</p>
          <p class="form-message" data-message></p>
        </section>
      </form>
    </section>`;
}

function homeView() {
  const tripList = state.trips.length
    ? `<ol class="trip-list">${state.trips.map(tripCard).join('')}</ol>`
    : `<section class="home-empty"><h2>Nenhuma viagem ainda</h2><p>Sua próxima história começa aqui.</p><button class="glass-button" type="button" data-action="open-sheet">Criar viagem</button></section>`;

  return `<section id="user_home" class="home">
    <header class="home-header">
      <div class="header-actions">
        <button class="profile-button" type="button" aria-label="${esc(profileName())}, ${esc(state.user.email)}">
          <img src="${esc(profileImage())}" alt="${esc(profileName())}" onerror="this.outerHTML='<span class=&quot;profile-fallback&quot;>${esc(profileName()[0])}</span>'">
        </button>
        <div class="header-buttons">
          <button class="glass-button" type="button" data-action="toggle-edit">${state.editing ? 'OK' : 'Editar'}</button>
          <button class="circle-button" type="button" data-action="open-sheet" aria-label="Nova viagem">＋</button>
        </div>
      </div>
      <div><h1 class="home-title">Minhas viagens</h1></div>
      <p class="session-reference">${esc(state.user.email)}</p>
    </header>
    ${tripList}
    ${newTripSheet()}
  </section>`;
}

function authView() {
  return `<section class="auth"><form class="auth-card" data-form="auth"><h1>Viagens</h1><p>Entre para acessar suas viagens como passageiro.</p><input name="email" type="email" autocomplete="email" placeholder="E-mail" required><input name="password" type="password" autocomplete="current-password" placeholder="Senha" required><button type="submit">Entrar</button><p class="form-message" data-message></p></form></section>`;
}

function render() {
  document.body.dataset.sheetOpen = String(state.sheetOpen);
  app.innerHTML = state.user ? homeView() : authView();
}

function setMessage(text) {
  const message = document.querySelector('[data-message]');
  if (message) message.textContent = text;
}

async function loadTrips() {
  const { data, error } = await supabase.from('trips').select('*').order('start_date', { ascending: true });
  if (error) throw error;
  state.trips = data || [];
  state.passengers.clear();
  if (!state.trips.length) return;
  const ids = state.trips.map(trip => trip.id);
  const result = await supabase.from('passengers').select('*').in('trip_id', ids).order('created_at');
  if (result.error) throw result.error;
  for (const passenger of result.data || []) {
    const list = state.passengers.get(passenger.trip_id) || [];
    list.push(passenger);
    state.passengers.set(passenger.trip_id, list);
  }
}

function openSheet() {
  state.sheetOpen = true;
  state.imageData = '';
  render();
  requestAnimationFrame(() => document.querySelector('#trip-name')?.focus({ preventScroll: true }));
}

function closeSheet() {
  if (state.saving) return;
  state.sheetOpen = false;
  state.imageData = '';
  render();
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/webp', .78);
}

function createDays(tripId, startValue, endValue) {
  const days = [];
  const end = new Date(`${endValue}T12:00:00`);
  for (let date = new Date(`${startValue}T12:00:00`), number = 1; date <= end; date.setDate(date.getDate() + 1), number += 1) {
    days.push({ trip_id: tripId, day_number: number, date: date.toISOString().slice(0, 10), status: 'empty' });
  }
  return days;
}

async function saveTrip(form) {
  const values = Object.fromEntries(new FormData(form));
  if (values.end_date < values.start_date) return setMessage('A data final deve ser igual ou posterior à inicial.');
  if (!state.imageData) return setMessage('Escolha a imagem da viagem.');
  state.saving = true;
  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;

  const payload = {
    user_id: state.user.id,
    name: values.name.trim(),
    destination: values.destination.trim(),
    start_date: values.start_date,
    end_date: values.end_date,
    arrival_method: values.arrival_method,
    location_label: values.location_label.trim() || null,
    cover_url: state.imageData
  };

  const created = await supabase.from('trips').insert(payload).select().single();
  if (created.error) {
    state.saving = false;
    if (submit) submit.disabled = false;
    return setMessage(created.error.message);
  }

  const trip = created.data;
  const operations = [
    supabase.from('trip_members').insert({ trip_id: trip.id, user_id: state.user.id, role: 'owner' }),
    supabase.from('passengers').insert({ trip_id: trip.id, name: profileName(), photo_url: profileImage() }),
    supabase.from('trip_days').insert(createDays(trip.id, values.start_date, values.end_date))
  ];
  const results = await Promise.all(operations);
  const failure = results.find(result => result.error);
  state.saving = false;
  if (failure) {
    if (submit) submit.disabled = false;
    return setMessage(failure.error.message);
  }

  state.sheetOpen = false;
  state.imageData = '';
  await loadTrips();
  render();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'open-sheet') openSheet();
  if (button.dataset.action === 'close-sheet') closeSheet();
  if (button.dataset.action === 'toggle-edit') { state.editing = !state.editing; render(); }
});

document.addEventListener('change', async event => {
  if (event.target.id !== 'cover-image') return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    state.imageData = await compressImage(file);
    const preview = document.querySelector('.upload-preview');
    if (preview) preview.innerHTML = `<img src="${state.imageData}" alt="Prévia da imagem">`;
  } catch {
    setMessage('Não foi possível ler essa imagem. Escolha outra.');
  }
});

document.addEventListener('submit', async event => {
  const form = event.target;
  if (form.dataset.form === 'new-trip') {
    event.preventDefault();
    await saveTrip(form);
  }
  if (form.dataset.form === 'auth') {
    event.preventDefault();
    const credentials = Object.fromEntries(new FormData(form));
    const result = await supabase.auth.signInWithPassword(credentials);
    if (result.error) return setMessage(result.error.message);
    state.user = result.data.user;
    await loadTrips();
    render();
  }
});

async function boot() {
  const { data } = await supabase.auth.getSession();
  state.user = data.session?.user || null;
  if (state.user) {
    try { await loadTrips(); }
    catch (error) { console.error(error); }
  }
  render();
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    state.user = null;
    state.trips = [];
    render();
  }
});

boot();
