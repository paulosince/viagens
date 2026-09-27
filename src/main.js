import { offlineStore } from './offline-store.js?v=20260927-44';

const SUPABASE_URL = 'https://siabldasqinpfmxslwji.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UgbBIOq1TnInuPRrQpAFag_JLIzYuFf';
const VIAGGIO_MCP_URL = 'https://siabldasqinpfmxslwji.supabase.co/functions/v1/viaggio-mcp';
const CHATGPT_PLUGIN_URL = '';
const NEW_AGENDA_TITLE = 'Nova atividade';
const NEW_AGENDA_DESCRIPTION = 'Adicione uma descrição';
const HISTORY_RESET_AT = '2026-09-27T01:32:01.347Z';
let supabase = null;
let supabaseLoad = null;
let leafletLoad = null;
let orderedDaySchemaSupport = null;
let outboxFlushPromise = null;
let outboxSyncing = false;
let lastOutboxError = null;

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
const profilePlaceholder = 'assets/avatar-placeholder.svg';
const placeSearchCache = new Map();
const TRIP_CACHE_FRESH_MS = 60_000;
let lastPlaceSearchAt = 0;

const state = {
  user: null,
  chatgptConnected: false,
  profile: null,
  trips: [],
  passengers: new Map(),
  savedPassengers: [],
  profileSavedPassengers: [],
  selectedTripIds: new Set(),
  collapsedTripSections: new Set(),
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
  dayMapBounds: null,
  dayMapScrollTop: null,
  dayMapRenderToken: 0,
  dayAttachments: new Map(),
  dayAttachmentLoads: new Map(),
  budgetByTrip: new Map(),
  tripFilesByTrip: new Map(),
  tripFileDeckIndexes: new Map(),
  tripTabScroll: new Map(),
  activeTripTab: 'roteiro',
  enrichingDays: new Set(),
  agendaSaveStates: new Map(),
  agendaSaveTimers: new Map(),
  agendaSaveQueues: new Map(),
  agendaSaveVersions: new Map(),
  daySaveStates: new Map(),
  daySaveTimers: new Map(),
  daySaveQueues: new Map(),
  daySaveVersions: new Map(),
  changeLog: [],
  baselineSnapshotsEnsured: new Set(),
  tripRoles: new Map(), tripOwners: new Map()
};

const dom = {
  dayMapSection: document.querySelector('#day_map_section'),
  dayMapToggle: document.querySelector('#day_map_toggle'),
  tripPageDuration: document.querySelector('#trip_page_duration'),
  tripPageShare: document.querySelector('#trip_page_share'), tripShareSheet: document.querySelector('#trip_share_sheet'), tripShareScrim: document.querySelector('#trip_share_scrim'), closeTripShare: document.querySelector('#close_trip_share'), tripShareForm: document.querySelector('#trip_share_form'), tripShareRecipient: document.querySelector('#trip_share_recipient'), sendTripShare: document.querySelector('#send_trip_share'), tripShareStatus: document.querySelector('#trip_share_status'), tripShareList: document.querySelector('#trip_share_list'),
  tripCreateMessage: document.querySelector('#trip_create_message'),
  splashStatus: document.querySelector('#splash_status'),
  authView: document.querySelector('#auth_view'), authForm: document.querySelector('#auth_form'), authMessage: document.querySelector('#auth_message'), authIntro: document.querySelector('#auth_intro'), authCard: document.querySelector('.auth-card'), signupForm: document.querySelector('#signup_form'), signupMessage: document.querySelector('#signup_message'), signupPhotoInput: document.querySelector('#signup_photo'), signupPhotoPreview: document.querySelector('#signup_photo_preview'), signupPhotoPlaceholder: document.querySelector('#signup_photo_placeholder'), showSignup: document.querySelector('#show_signup'), showLogin: document.querySelector('#show_login'),
  home: document.querySelector('#user_home'), profileButton: document.querySelector('#profile_button'), headerProfileImage: document.querySelector('#header_profile_image'), headerProfileFallback: document.querySelector('#header_profile_fallback'), homeChatgptButton: document.querySelector('#home_chatgpt_button'),
  editTripsButton: document.querySelector('#edit_trips_button'), newTripButton: document.querySelector('#new_trip_button'), emptyNewTripButton: document.querySelector('#empty_new_trip_button'), sessionEmail: document.querySelector('#session_email'), syncStatus: document.querySelector('#sync_status'), tripHeading: document.querySelector('#trip_heading'), yearButton: document.querySelector('#year_selector_button'), currentYear: document.querySelector('#current_year'), yearMenu: document.querySelector('#year_menu'), yearList: document.querySelector('#year_list'),
  tripList: document.querySelector('#trip_list'), homeEmpty: document.querySelector('#home_empty'), scrim: document.querySelector('#sheet_scrim'), tripEditFooter: document.querySelector('#trip_edit_footer'), deleteSelectedTrips: document.querySelector('#delete_selected_trips'), tripPage: document.querySelector('#trip_page'), closeTripPage: document.querySelector('#close_trip_page'), tripPageHero: document.querySelector('#trip_page_hero'), tripPageTitle: document.querySelector('#trip_page_title'), tripPageTitleInput: document.querySelector('#trip_page_title_input'), tripPageDates: document.querySelector('#trip_page_dates'), tripDateEditor: document.querySelector('#trip_page_date_editor'), tripStartDate: document.querySelector('#trip_page_start_date'), tripDayCount: document.querySelector('#trip_page_day_count'), tripDateDone: document.querySelector('#trip_page_date_done'), tripPageColor: document.querySelector('#trip_page_color'), tripPageCoverInput: document.querySelector('#trip_page_cover_input'), tripPageSaveStatus: document.querySelector('#trip_page_save_status'), tripPagePassengers: document.querySelector('#trip_page_passengers'), tripPagePassengerCount: document.querySelector('#trip_page_passenger_count'), tripPassengerSheet: document.querySelector('#trip_passenger_sheet'), tripPassengerSheetBody: document.querySelector('#trip_passenger_sheet_body'), tripPassengerSelf: document.querySelector('#trip_passenger_self'), tripPassengerSelfImage: document.querySelector('#trip_passenger_self_image'), tripPassengerSelfName: document.querySelector('#trip_passenger_self_name'), tripPassengerClose: document.querySelector('#close_trip_passengers'), tripPassengerMessage: document.querySelector('#trip_passenger_message'), tripDayList: document.querySelector('#trip_day_list'), tripDayMessage: document.querySelector('#trip_day_message'),
  tripTabs: document.querySelector('.trip-tabs'), tripPanels: { roteiro: document.querySelector('#trip_panel_roteiro'), orcamento: document.querySelector('#trip_panel_orcamento'), arquivos: document.querySelector('#trip_panel_arquivos') }, budgetSummary: document.querySelector('#budget_summary'), budgetStatus: document.querySelector('#budget_status'), budgetList: document.querySelector('#budget_list'), budgetPage: document.querySelector('#budget_item_page'), budgetPageTitle: document.querySelector('#budget_item_page_title'), closeBudgetPage: document.querySelector('#close_budget_item_page'), budgetEditor: document.querySelector('#budget_editor'), budgetPageMessage: document.querySelector('#budget_item_message'), budgetAdd: document.querySelector('#budget_add'), tripFilesStatus: document.querySelector('#trip_files_status'), tripFilesList: document.querySelector('#trip_files_list'), tripFilesDay: document.querySelector('#trip_files_day'), tripFilesInput: document.querySelector('#trip_files_input'),
  tripFileViewer: document.querySelector('#trip_file_viewer'), tripFileViewerTitle: document.querySelector('#trip_file_viewer_title'), tripFileViewerMedia: document.querySelector('#trip_file_viewer_media'), tripFileViewerStatus: document.querySelector('#trip_file_viewer_status'), tripFileViewerDelete: document.querySelector('#delete_trip_file_viewer'), tripFileViewerPosition: document.querySelector('#trip_file_viewer_position'), tripFileViewerPrevious: document.querySelector('#previous_trip_file_viewer'), tripFileViewerNext: document.querySelector('#next_trip_file_viewer'), closeTripFileViewer: document.querySelector('#close_trip_file_viewer'),
  dayPage: document.querySelector('#day_page'), closeDayPage: document.querySelector('#close_day_page'), addDayPageActivity: document.querySelector('#add_day_page_activity'), dayAgendaStickyMarker: document.querySelector('#day_agenda_sticky_marker'), dayPageHero: document.querySelector('#day_page_hero'), dayPageBadge: document.querySelector('#day_page_badge'), dayPageTitle: document.querySelector('#day_page_title'), dayPageDate: document.querySelector('#day_page_date'), dayPageSaveStatus: document.querySelector('#day_page_save_status'), dayPagePhotoInput: document.querySelector('#day_page_photo_input'), dayPageCamera: document.querySelector('#day_page_camera'), dayPageAgenda: document.querySelector('#day_page_agenda'), dayPageEmpty: document.querySelector('#day_page_empty'), dayPageMap: document.querySelector('#day_page_map'), dayPageDirections: document.querySelector('#day_page_directions'),
  dayAttachmentsButton: document.querySelector('#day_attachments_button'), dayAttachmentsCount: document.querySelector('#day_attachments_count'), dayAttachmentsScrim: document.querySelector('#day_attachments_scrim'), dayAttachmentsSheet: document.querySelector('#day_attachments_sheet'), closeDayAttachments: document.querySelector('#close_day_attachments'), dayAttachmentsInput: document.querySelector('#day_attachments_input'), dayAttachmentsStatus: document.querySelector('#day_attachments_status'), dayAttachmentsList: document.querySelector('#day_attachments_list'),
  newTripSheet: document.querySelector('#home_new_trip'), newTripForm: document.querySelector('#new_trip_form'), newTripTitle: document.querySelector('#new-trip-title'), closeNewTrip: document.querySelector('#close_new_trip'), saveNewTrip: document.querySelector('#save_new_trip'), newTripMessage: document.querySelector('#new_trip_message'), coverInput: document.querySelector('#cover-image'), coverPreview: document.querySelector('#cover_preview_image'), tripColorValue: document.querySelector('#trip-color-value'), tripColorPalette: document.querySelector('#trip_color_palette'), tripColorCustom: document.querySelector('#trip-color-custom'), savedTripPassengers: document.querySelector('#saved_trip_passengers'), savedTripPassengerList: document.querySelector('#saved_trip_passenger_list'), newTripPassengerList: document.querySelector('#new_trip_passenger_list'), addTripPassenger: document.querySelector('#add_trip_passenger'), tripSharingSection: document.querySelector('#trip_sharing_section'), tripMemberList: document.querySelector('#trip_member_list'), tripShareEmail: document.querySelector('#trip_share_email'), tripShareButton: document.querySelector('#trip_share_button'), tripShareMessage: document.querySelector('#trip_share_message'),
  dayEditSheet: document.querySelector('#day_edit_sheet'), daySheetScrim: document.querySelector('#day_sheet_scrim'), dayEditForm: document.querySelector('#day_edit_form'), closeDayEdit: document.querySelector('#close_day_edit'), saveDayEdit: document.querySelector('#save_day_edit'), dayEditTitle: document.querySelector('#day_edit_title'), dayEditDate: document.querySelector('#day_edit_date'), dayTitleInput: document.querySelector('#day-title-input'), dayLocationsEditor: document.querySelector('#day_locations_editor'), addDayLocation: document.querySelector('#add_day_location'), dayAgendaEditor: document.querySelector('#day_agenda_editor'), addDayActivity: document.querySelector('#add_day_activity'), dayNotesInput: document.querySelector('#day-notes-input'), dayEditMessage: document.querySelector('#day_edit_message'),
  placeSearchSheet: document.querySelector('#place_search_sheet'), placeSearchScrim: document.querySelector('#place_search_scrim'), placeSearchForm: document.querySelector('#place_search_form'), closePlaceSearch: document.querySelector('#close_place_search'), confirmPlaceSearch: document.querySelector('#confirm_place_search'), placeSearchInput: document.querySelector('#place_search_input'), runPlaceSearch: document.querySelector('#run_place_search'), placeSearchMessage: document.querySelector('#place_search_message'), placeSearchResults: document.querySelector('#place_search_results'), placePhotoSection: document.querySelector('#place_photo_section'), placePhotoMessage: document.querySelector('#place_photo_message'), placePhotoResults: document.querySelector('#place_photo_results'),
  profileSheet: document.querySelector('#profile-sheet'), profileForm: document.querySelector('#profile_form'), closeProfile: document.querySelector('#close_profile'), saveProfile: document.querySelector('#save_profile'), profileMessage: document.querySelector('#profile_message'), profileEditorImage: document.querySelector('#profile_editor_image'), profilePhotoInput: document.querySelector('#profile-photo'), profileDisplayName: document.querySelector('#profile_display_name'), profileEmail: document.querySelector('#profile_email'), profileNameInput: document.querySelector('#profile-name'), birthDateInput: document.querySelector('#birth-date'), profileAge: document.querySelector('#profile_age'), profileCreatedAt: document.querySelector('#profile_created_at'), profileSavedPassengerList: document.querySelector('#profile_saved_passenger_list'), addProfileSavedPassenger: document.querySelector('#add_profile_saved_passenger'), chatgptButton: document.querySelector('#chatgpt_button'), chatgptSheet: document.querySelector('#chatgpt_sheet'), closeChatgpt: document.querySelector('#close_chatgpt'), connectChatgpt: document.querySelector('#connect_chatgpt'), copyMcpUrl: document.querySelector('#copy_mcp_url'), chatgptMessage: document.querySelector('#chatgpt_message'), chatgptMcpUrl: document.querySelector('#chatgpt_mcp_url'), changeLogButton: document.querySelector('#change_log_button'), changeLogSheet: document.querySelector('#change_log_sheet'), closeChangeLog: document.querySelector('#close_change_log'), changeLogList: document.querySelector('#change_log_list'), changeLogEmpty: document.querySelector('#change_log_empty'), changeLogMessage: document.querySelector('#change_log_message'), logoutButton: document.querySelector('#logout_button'), deleteAccountButton: document.querySelector('#delete_account_button')
};

// As folhas são camadas globais. Fora da Home, não ficam presas ao contexto
// de empilhamento criado por transform/isolation daquele contêiner.
dom.tripPage.after(dom.scrim, dom.newTripSheet, dom.profileSheet, dom.chatgptSheet, dom.changeLogSheet);

const displayDate = value => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)).replace('.', '') : '';

function addDaysToDate(value, offset) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(offset || 0), 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

function inclusiveDayCount(startValue, endValue) {
  if (!startValue || !endValue) return 1;
  const start = new Date(String(startValue) + 'T12:00:00Z');
  const end = new Date(String(endValue) + 'T12:00:00Z');
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function tripDayCount(trip) {
  const explicit = Number(trip?.day_count);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  return inclusiveDayCount(trip?.start_date, trip?.end_date);
}

function tripEndDate(trip) {
  return addDaysToDate(trip?.start_date, tripDayCount(trip) - 1);
}

function dayPosition(day) {
  const explicit = Number(day?.position);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  const legacy = Number(day?.day_number);
  return Number.isInteger(legacy) && legacy > 0 ? legacy - 1 : 0;
}

function dayNumber(day) {
  return dayPosition(day) + 1;
}

function dayIsHidden(day) {
  return day?.is_hidden === true || day?.status === 'hidden';
}

function dayDeletedAt(day) {
  if (day?.deleted_at) return day.deleted_at;
  const status = String(day?.status || '');
  return status.startsWith('deleted:') ? status.slice(8) : null;
}

function activeTripForDay(day) {
  return state.trips.find(trip => String(trip.id) === String(day?.trip_id || state.activeTripId)) || null;
}

function derivedDayDate(day, trip = activeTripForDay(day)) {
  return trip?.start_date ? addDaysToDate(trip.start_date, dayPosition(day)) : '';
}

function normalizeTripRecord(trip) {
  return { ...trip, day_count: tripDayCount(trip) };
}

function tripRole(trip) {
  if (!trip) return 'viewer';
  if (String(trip.user_id) === String(state.user?.id)) return 'owner';
  return state.tripRoles.get(String(trip.id)) || trip.access_role || 'viewer';
}

function canEditTrip(trip) { return tripRole(trip) !== 'viewer'; }
function canEditActiveTrip() { return canEditTrip(state.trips.find(trip => String(trip.id) === String(state.activeTripId))); }

function normalizeDayRecord(day) {
  return {
    ...day,
    position: dayPosition(day),
    is_hidden: dayIsHidden(day),
    deleted_at: dayDeletedAt(day)
  };
}

function normalizeActivityRecord(activity) {
  if (activity?.start_time) return activity;
  const time = activity?.starts_at ? String(activity.starts_at).slice(11, 19) : null;
  return { ...activity, start_time: time };
}

async function supportsOrderedDaySchema(client = null) {
  if (orderedDaySchemaSupport !== null) return orderedDaySchemaSupport;
  const activeClient = client || await trySupabase();
  if (!activeClient) return false;
  try {
    const probe = await activeClient.from('trips').select('day_count').limit(1);
    orderedDaySchemaSupport = !probe.error;
  } catch {
    orderedDaySchemaSupport = false;
  }
  return orderedDaySchemaSupport;
}
const defaultProfileName = user => user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Viajante';
const profileName = () => state.profile?.name || defaultProfileName(state.user);
const profileImage = () => state.avatarPreview || state.profile?.avatar_url || state.user?.user_metadata?.avatar_url || '';

function ageFromBirthDate(value) {
  if (!value) return null;
  const birth = new Date(`${value}T12:00:00`), today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function tripTiming(trip) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(`${trip.start_date}T00:00:00`), end = new Date(`${tripEndDate(trip)}T23:59:59`);
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
  const [profile, workspace, cachedOwners] = await Promise.all([
    offlineStore.getProfile(user.id),
    offlineStore.loadWorkspace(user.id),
    offlineStore.getMeta(`shared_trip_owners:${user.id}`)
  ]);

  state.profile = profile || {
    user_id: user.id,
    name: defaultProfileName(user),
    birth_date: null,
    avatar_path: null
  };
  state.trips = (workspace.trips || []).map(normalizeTripRecord);
  state.tripOwners = new Map((cachedOwners || []).map(owner => [String(owner.tripId), { name: owner.name, avatarUrl: owner.avatarUrl || '' }]));
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
      // The avatar and shared-owner badge should not wait for pending trip edits.
      const client = await trySupabase(5000);
      if (client) {
        await Promise.allSettled([loadProfile(), refreshSharedTripOwners(client)]);
        syncTripList();
      }
      await flushOutbox().catch(error => console.warn('Fila local aguardando sincronização', error));
      await applyPendingSignupAvatar().catch(error => console.warn('Foto de cadastro aguardando envio', error));
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
  if (window.__viaggioBootGuard) {
    clearTimeout(window.__viaggioBootGuard);
    window.__viaggioBootGuard = null;
  }
  document.body.dataset.session = session;
  dom.authView.setAttribute('aria-hidden', String(session !== 'anonymous'));
  dom.home.setAttribute('aria-hidden', String(session !== 'authenticated'));
  document.body.dataset.appReady = 'true';
  if (session === 'authenticated') refreshChatgptConnection().catch(console.warn);
  else {
    state.chatgptConnected = false;
    state.collapsedTripSections.clear();
    dom.home.dataset.chatgptConnected = 'false';
  }
}

function setActiveSheet(name = 'none') {
  document.body.dataset.activeSheet = name;
  dom.newTripSheet.setAttribute('aria-hidden', String(name !== 'new-trip'));
  dom.tripPassengerSheet.setAttribute('aria-hidden', String(name !== 'trip-passengers'));
  dom.tripShareSheet.setAttribute('aria-hidden', String(name !== 'trip-share'));
  dom.profileSheet.setAttribute('aria-hidden', String(name !== 'profile'));
  dom.chatgptSheet.setAttribute('aria-hidden', String(name !== 'chatgpt'));
  dom.changeLogSheet.setAttribute('aria-hidden', String(name !== 'change-log'));
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
    const count = `${pending} ${pending === 1 ? 'alteração pendente' : 'alterações pendentes'}`;
    dom.syncStatus.textContent = outboxSyncing
      ? `Sincronizando · ${count}`
      : `Salvo neste iPhone · ${count}${lastOutboxError ? ` · ${lastOutboxError.code === '57014' ? 'servidor demorou a responder' : 'falha na sincronização'} · tocar para tentar novamente` : ''}`;
    dom.syncStatus.title = lastOutboxError ? `Última falha: ${lastOutboxError.message || lastOutboxError}` : '';
    return;
  }

  dom.syncStatus.title = '';
  if (!snapshotAt) {
    dom.syncStatus.dataset.kind = 'pending';
    dom.syncStatus.textContent = 'Cópia offline ainda não concluída';
    return;
  }

  dom.syncStatus.dataset.kind = 'synced';
  dom.syncStatus.textContent = 'Sincronizado · disponível offline';
}


function tripNameForLog(tripId) {
  return state.trips.find(trip => String(trip.id) === String(tripId))?.name || 'Viagem';
}

function renderChangeLog(entries = state.changeLog) {
  dom.changeLogList.replaceChildren();
  const records = [...entries]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 150);

  for (const entry of records) {
    const item = document.createElement('li');
    item.className = 'change-log-item';

    const marker = document.createElement('span');
    marker.className = 'change-log-marker';
    marker.dataset.action = entry.action || 'update';

    const copy = document.createElement('div');
    copy.className = 'change-log-copy';

    const summary = document.createElement('strong');
    summary.textContent = entry.summary || 'Alteração registrada';

    const meta = document.createElement('span');
    const when = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(entry.created_at));
    const sourceLabel = entry.source === 'chatgpt' ? ' · via ChatGPT' : entry.source === 'api' ? ' · via API' : '';
    meta.textContent = (entry.trip_id ? tripNameForLog(entry.trip_id) + ' · ' : '') + when + sourceLabel;

    copy.append(summary, meta);

    if (entry.snapshot_id) {
      const snapshotRow = document.createElement('div');
      snapshotRow.className = 'change-log-snapshot';

      const snapshotId = document.createElement('button');
      snapshotId.type = 'button';
      snapshotId.className = 'change-log-snapshot-id';
      snapshotId.textContent = 'Snapshot ' + String(entry.snapshot_id).slice(0, 8);
      snapshotId.title = String(entry.snapshot_id);
      snapshotId.setAttribute('aria-label', 'Copiar ID completo do snapshot ' + String(entry.snapshot_id));
      snapshotId.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(String(entry.snapshot_id));
          dom.changeLogMessage.textContent = 'ID do snapshot copiado.';
        } catch {
          dom.changeLogMessage.textContent = String(entry.snapshot_id);
        }
      });

      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'change-log-restore';
      restore.textContent = 'Restaurar';
      restore.setAttribute('aria-label', 'Restaurar a viagem para este momento');
      restore.addEventListener('click', () => restoreSnapshot(entry.snapshot_id, restore));

      snapshotRow.append(snapshotId, restore);
      copy.append(snapshotRow);
    }

    item.append(marker, copy);
    dom.changeLogList.append(item);
  }

  dom.changeLogEmpty.hidden = records.length > 0;
}

async function restoreSnapshot(snapshotId, button = null) {
  if (!snapshotId) return;

  dom.changeLogMessage.textContent = '';

  if (!navigator.onLine) {
    dom.changeLogMessage.textContent = 'Restaurar um snapshot requer conexão.';
    return;
  }

  if (!window.confirm('Restaurar toda a viagem para este momento? O estado atual será salvo antes como um snapshot de segurança.')) {
    return;
  }

  if (button) button.disabled = true;
  dom.changeLogMessage.textContent = 'Sincronizando alterações pendentes…';

  try {
    const synced = await flushOutbox();
    if (!synced) throw new Error('Há alterações pendentes que ainda não puderam ser sincronizadas.');

    const client = await trySupabase();
    if (!client) throw new Error('Backend indisponível.');

    dom.changeLogMessage.textContent = 'Restaurando snapshot…';
    const restored = await client.rpc('restore_trip_snapshot', {
      p_snapshot_id: snapshotId
    });
    if (restored.error) throw restored.error;

    const tripId = restored.data?.trip_id || state.activeTripId;
    if (tripId) state.tripDataCache.delete(String(tripId));

    await loadTrips();

    if (tripId && String(state.activeTripId || '') === String(tripId)) {
      await openTrip(tripId, { pushHistory: false, forceRefresh: true });
    }

    dom.changeLogMessage.textContent = 'Viagem restaurada. O estado anterior também foi guardado para desfazer esta restauração.';
    await refreshChangeLog();
  } catch (error) {
    console.warn('Falha ao restaurar snapshot', error);
    dom.changeLogMessage.textContent = error.message || 'Não foi possível restaurar este snapshot.';
  } finally {
    if (button) button.disabled = false;
  }
}

async function refreshChangeLog() {
  if (!state.user?.id) return;

  const local = await offlineStore.listChangeLogs(state.user.id, 150).catch(() => []);
  state.changeLog = local;
  renderChangeLog(local);

  const client = await trySupabase();
  if (!client) return;

  const remote = await client
    .from('change_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(150);

  if (remote.error) {
    console.warn('Histórico remoto indisponível', remote.error);
    return;
  }

  await offlineStore.saveChangeLogs(remote.data || []).catch(console.warn);
  const merged = new Map();
  for (const entry of [...local, ...(remote.data || [])]) merged.set(String(entry.id), entry);
  state.changeLog = [...merged.values()]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 150);
  renderChangeLog(state.changeLog);
}

function openChatgptIntegration() {
  dom.chatgptMcpUrl.textContent = VIAGGIO_MCP_URL;
  dom.chatgptMessage.textContent = state.chatgptConnected
    ? 'ChatGPT conectado à sua conta.'
    : CHATGPT_PLUGIN_URL
      ? 'A integração pública está disponível para instalação.'
      : 'O servidor do Viaggio já está pronto. A publicação no diretório do ChatGPT ainda precisa ser concluída.';
  setActiveSheet('chatgpt');
  refreshChatgptConnection().catch(console.warn);
}

async function refreshChatgptConnection() {
  const userId = state.user?.id;
  if (!userId) return;
  const client = await trySupabase();
  if (!client) return;
  const { data, error } = await client.rpc('has_chatgpt_connection');
  if (error || state.user?.id !== userId) return;
  state.chatgptConnected = data === true;
  dom.home.dataset.chatgptConnected = String(state.chatgptConnected);
  dom.homeChatgptButton.setAttribute('aria-label', state.chatgptConnected ? 'ChatGPT conectado · abrir integração' : 'Conectar o Viaggio ao ChatGPT');
  if (document.body.dataset.activeSheet === 'chatgpt' && state.chatgptConnected) {
    dom.chatgptMessage.textContent = 'ChatGPT conectado à sua conta.';
  }
}

async function copyMcpUrl() {
  try {
    await navigator.clipboard.writeText(VIAGGIO_MCP_URL);
    dom.chatgptMessage.textContent = 'Endereço da integração copiado.';
  } catch {
    dom.chatgptMessage.textContent = VIAGGIO_MCP_URL;
  }
}

function openChatgptApp() {
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!isiOS) {
    window.open('https://chatgpt.com/', '_blank', 'noopener');
    return;
  }

  let didLeave = false;
  const markLeave = () => {
    if (document.visibilityState === 'hidden') didLeave = true;
  };

  document.addEventListener('visibilitychange', markLeave, { once: true });

  // The iOS ChatGPT app registers the chatgpt:// scheme. Keep this navigation
  // inside the original user gesture; installed PWAs are more restrictive than Safari.
  const link = document.createElement('a');
  link.href = 'chatgpt://';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => {
    if (!didLeave && document.visibilityState === 'visible') {
      dom.chatgptMessage.textContent = 'Não consegui abrir o app automaticamente. Abra o ChatGPT no iPhone e conclua a conexão em Configurações → Plugins.';
    }
  }, 1500);
}

function connectChatgpt() {
  if (CHATGPT_PLUGIN_URL) {
    window.location.href = CHATGPT_PLUGIN_URL;
    return;
  }

  navigator.clipboard.writeText(VIAGGIO_MCP_URL).catch(() => {});
  dom.chatgptMessage.textContent = 'Endereço MCP copiado. Abrindo o app ChatGPT. Como o Viaggio ainda não está publicado no diretório, a primeira conexão precisa ser adicionada uma vez em Configurações → Plugins no modo de desenvolvedor.';
  openChatgptApp();
}

async function openChangeLog() {
  setActiveSheet('change-log');
  await refreshChangeLog();
}

async function recordChange({
  tripId = null,
  entityType = 'app',
  entityId = null,
  action = 'update',
  summary,
  beforeState = null,
  afterState = null
}) {
  if (!state.user?.id || !summary) return null;

  const snapshotId = tripId ? crypto.randomUUID() : null;
  const entry = {
    id: crypto.randomUUID(),
    user_id: state.user.id,
    trip_id: tripId || null,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    action,
    summary,
    before_state: beforeState,
    after_state: afterState,
    snapshot_id: snapshotId,
    created_at: new Date().toISOString()
  };

  await offlineStore.saveChangeLog(entry);
  await offlineStore.enqueueMutation({
    type: 'record-change',
    tripId: tripId || null,
    snapshotId,
    entry
  });

  state.changeLog = [entry, ...state.changeLog.filter(item => String(item.id) !== String(entry.id))].slice(0, 150);
  if (document.body.dataset.activeSheet === 'change-log') renderChangeLog(state.changeLog);

  flushOutbox().catch(error => console.warn('Histórico aguardando sincronização', error));
  return entry;
}

function setLoading(button, loading) {
  button.disabled = loading;
  button.dataset.loading = String(loading);
  button.setAttribute('aria-busy', String(loading));
}

function setImage(image, fallback, source, label) {
  fallback.textContent = label?.trim()?.[0]?.toUpperCase() || '?';
  if (!source) {
    image.removeAttribute('src');
    image.hidden = true;
    fallback.hidden = false;
    return;
  }
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
  dom.profileEditorImage.onerror = () => { dom.profileEditorImage.onerror = null; dom.profileEditorImage.src = profilePlaceholder; };
  dom.profileEditorImage.src = image || profilePlaceholder;
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

function profileSavedPassengerDraft(person = {}) {
  const persistedId = person.persistedId || person.id || null;
  return {
    localId: person.localId || persistedId || crypto.randomUUID(),
    persistedId,
    name: person.name || '',
    birthDate: person.birth_date || person.birthDate || '',
    photoUrl: person.photo_url || person.photoUrl || ''
  };
}

function resetProfileSavedPassengers() {
  state.profileSavedPassengers = state.savedPassengers.map(profileSavedPassengerDraft);
}

function createProfileSavedPassengerRow(passenger) {
  const row = document.createElement('div');
  row.className = 'new-trip-passenger-row profile-saved-passenger-row';
  row.dataset.localId = passenger.localId;

  const avatar = document.createElement('label');
  avatar.className = 'new-trip-passenger-avatar';
  avatar.setAttribute('aria-label', 'Escolher foto de ' + (passenger.name || 'passageiro'));
  const image = document.createElement('img');
  image.alt = '';
  const initial = document.createElement('span');
  initial.textContent = passenger.name.trim()[0]?.toUpperCase() || '＋';
  const photoInput = document.createElement('input');
  photoInput.type = 'file';
  photoInput.accept = 'image/*';

  if (passenger.photoUrl) {
    image.src = passenger.photoUrl;
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
      dom.profileMessage.dataset.kind = 'error';
      dom.profileMessage.textContent = 'Não foi possível preparar a foto do passageiro.';
    }
  });
  avatar.append(image, initial, photoInput);

  const fields = document.createElement('div');
  fields.className = 'new-trip-passenger-fields';

  const nameField = document.createElement('label');
  nameField.className = 'new-trip-passenger-field';
  const nameLabel = document.createElement('span');
  nameLabel.textContent = 'Nome';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.autocomplete = 'off';
  nameInput.placeholder = 'Nome do passageiro';
  nameInput.value = passenger.name;
  nameInput.addEventListener('input', () => {
    passenger.name = nameInput.value;
    initial.textContent = passenger.name.trim()[0]?.toUpperCase() || '＋';
    avatar.setAttribute('aria-label', 'Escolher foto de ' + (passenger.name || 'passageiro'));
  });
  nameField.append(nameLabel, nameInput);

  const birthField = document.createElement('label');
  birthField.className = 'new-trip-passenger-field';
  const birthLabel = document.createElement('span');
  birthLabel.textContent = 'Nascimento';
  const birthInput = document.createElement('input');
  birthInput.type = 'date';
  birthInput.value = passenger.birthDate;
  birthInput.addEventListener('input', () => { passenger.birthDate = birthInput.value; });
  birthField.append(birthLabel, birthInput);

  fields.append(nameField, birthField);

  const remove = document.createElement('button');
  remove.className = 'new-trip-passenger-remove';
  remove.type = 'button';
  remove.textContent = '×';
  remove.setAttribute('aria-label', 'Remover ' + (passenger.name || 'passageiro') + ' dos passageiros salvos');
  remove.addEventListener('click', () => {
    state.profileSavedPassengers = state.profileSavedPassengers.filter(item => item.localId !== passenger.localId);
    renderProfileSavedPassengers();
  });

  row.append(avatar, fields, remove);
  return row;
}

function renderProfileSavedPassengers(focusLast = false) {
  dom.profileSavedPassengerList.replaceChildren();
  for (const passenger of state.profileSavedPassengers) {
    dom.profileSavedPassengerList.append(createProfileSavedPassengerRow(passenger));
  }
  if (focusLast) {
    dom.profileSavedPassengerList.lastElementChild?.querySelector('input[type="text"]')?.focus({ preventScroll: true });
  }
}

function addProfileSavedPassenger() {
  state.profileSavedPassengers.push(profileSavedPassengerDraft());
  renderProfileSavedPassengers(true);
}

async function saveProfileSavedPassengers(client) {
  const drafts = state.profileSavedPassengers.filter(passenger =>
    passenger.name.trim() || passenger.birthDate || passenger.photoUrl
  );

  if (drafts.some(passenger => !passenger.name.trim())) {
    throw new Error('Dê um nome a cada passageiro salvo ou remova a linha vazia.');
  }

  const seen = new Set();
  for (const passenger of drafts) {
    const key = savedPassengerKey(passenger);
    if (seen.has(key)) throw new Error('Há passageiros salvos duplicados com o mesmo nome e nascimento.');
    seen.add(key);
  }

  const retainedIds = new Set(
    drafts.map(passenger => passenger.persistedId).filter(Boolean).map(String)
  );
  const removedIds = state.savedPassengers
    .filter(passenger => !retainedIds.has(String(passenger.id)))
    .map(passenger => passenger.id);

  if (removedIds.length) {
    const removed = await client
      .from('saved_passengers')
      .delete()
      .in('id', removedIds)
      .eq('owner_id', state.user.id)
      .select('id');
    if (removed.error) throw new Error('Passageiros salvos: ' + removed.error.message);
  }

  const savedPassengers = [];
  for (const passenger of drafts) {
    const payload = {
      owner_id: state.user.id,
      name: passenger.name.trim(),
      birth_date: passenger.birthDate || null,
      photo_url: passenger.photoUrl || null,
      updated_at: new Date().toISOString()
    };
    const result = passenger.persistedId
      ? await client.from('saved_passengers').update(payload).eq('id', passenger.persistedId).eq('owner_id', state.user.id).select().single()
      : await client.from('saved_passengers').insert(payload).select().single();

    if (result.error) throw new Error('Passageiros salvos: ' + result.error.message);
    passenger.persistedId = result.data.id;
    passenger.localId = result.data.id;
    savedPassengers.push(result.data);
  }

  state.savedPassengers = savedPassengers.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  resetProfileSavedPassengers();
}

function passengerImage(passenger) {
  const name = passenger.name || '';
  if (passenger.user_id && String(passenger.user_id) === String(state.user?.id)) return { src: profileImage(), position: '50% 46%' };
  const saved = state.savedPassengers.find(person => savedPassengerKey(person) === savedPassengerKey(passenger));
  if (saved?.photo_url) return { src: saved.photo_url, position: '50% 50%' };
  if (passenger.photo_url) return { src: passenger.photo_url, position: '50% 50%' };
  const trip = state.trips.find(item => String(item.id) === String(passenger.trip_id));
  const owner = state.tripOwners.get(String(passenger.trip_id));
  const sameName = (a, b) => String(a || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
    === String(b || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  if (owner && sameName(name, owner.name)) return { src: owner.avatarUrl || '', position: '50% 46%' };
  if (trip && String(trip.user_id) === String(state.user?.id) && sameName(name, profileName())) {
    return { src: profileImage(), position: '50% 46%' };
  }
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
  return day.title || firstPlace?.title || firstPlace?.place_name || firstLocation?.name || `Dia ${dayNumber(day)}`;
}

function dayPhoto(day, activities = [], locations = []) {
  return day.photo_url || locations[0]?.photo_url || activities.find(activity => activity.photo_url)?.photo_url || '';
}

function activityTime(activity) {
  if (activity?.start_time) return String(activity.start_time).slice(0, 5);
  if (!activity?.starts_at) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(activity.starts_at));
}

function activityLocation(activity, locations = []) {
  return locations.find(location => String(location.id) === String(activity.place_id))
    || locations.find(location => location.name && location.name === activity.place_name)
    || null;
}

function googleMapsAddressUrl(activity, location) {
  const address = String(location?.formatted_address || activity?.address || '').trim();
  return address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) : null;
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
  return !/^(almo[cç]o|jantar|caf[eé]|lanche|check[- ]?in|check[- ]?out|deslocamento|transfer|voo|trem|metr[oô]|[oô]nibus|chegada|sa[ií]da|manh[ãa]|tarde|noite|dia livre|tempo livre|nova atividade)(?:$|[\s,.:;—–-])/.test(value);
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
            photo_url: null
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
            photo_url: null
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
          changed = true;
        }
      }
    }

    if (!changed) return;

    await queueDaySave(dayId, async () => {
      // An image search can take seconds. Let a newer user edit win if this day
      // changed while the search was running; enrichment can retry next opening.
      if (state.dayActivities.get(dayId) !== activities || state.dayLocations.get(dayId) !== locations) return;

      const updatedDay = state.tripDays.find(item => String(item.id) === dayId) || day;
      await offlineStore.saveDayBundle(updatedDay, updatedActivities, updatedLocations);
      await offlineStore.enqueueMutation({
        type: 'save-day-items',
        tripId: String(day.trip_id || state.activeTripId),
        dayId: day.id,
        locations: updatedLocations.filter(location => recordsDiffer(location, locations.find(item => String(item.id) === String(location.id)))),
        activities: updatedActivities.filter(activity => recordsDiffer(activity, activities.find(item => String(item.id) === String(activity.id))))
      });
      await refreshSyncStatus();

      applyLocalDaySave(updatedDay, updatedActivities, updatedLocations);
      flushOutbox().catch(error => console.warn('Enriquecimento aguardando sincronização', error));
    });
  } finally {
    state.enrichingDays.delete(dayId);
  }
}



function revealMovedDay(dayId) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const card = dom.tripDayList.querySelector('[data-day-id="' + CSS.escape(String(dayId)) + '"]');
      if (!card) return;

      card.dataset.recentlyMoved = 'true';
      card.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });

      setTimeout(() => {
        if (card.isConnected) card.dataset.recentlyMoved = 'false';
      }, 1200);
    });
  });
}

async function persistDayOrder(orderIds, focusDayId = null) {
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (!trip || !orderIds.length) return;

  const positionById = new Map(orderIds.map((id, position) => [String(id), position]));
  const updatedDays = state.tripDays.map(day => (
    positionById.has(String(day.id))
      ? { ...day, position: positionById.get(String(day.id)) }
      : day
  )).sort((a, b) => dayPosition(a) - dayPosition(b));

  state.tripDays = updatedDays;

  const allActivities = [...state.dayActivities.values()].flat();
  const allLocations = [...state.dayLocations.values()].flat();
  await offlineStore.replaceTripData(String(trip.id), updatedDays, allActivities, allLocations);
  await offlineStore.enqueueMutation({
    type: 'reorder-days',
    tripId: String(trip.id),
    order: orderIds.map((id, position) => ({ id, position }))
  });

  const data = {
    days: updatedDays,
    activitiesByDay: state.dayActivities,
    locationsByDay: state.dayLocations,
    loadedAt: Date.now(),
    version: Date.now()
  };
  state.tripDataCache.set(String(trip.id), data);
  applyTripData(data);
  if (focusDayId) revealMovedDay(focusDayId);
  await refreshSyncStatus();

  flushOutbox().catch(error => console.warn('Reordenação aguardando sincronização', error));
}

async function moveDayByOffset(dayId, offset) {
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (!trip || !offset) return;

  const dayCount = tripDayCount(trip);
  const orderedVisible = state.tripDays
    .map(normalizeDayRecord)
    .filter(day => !dayDeletedAt(day) && dayPosition(day) < dayCount)
    .sort((a, b) => dayPosition(a) - dayPosition(b));

  const currentIndex = orderedVisible.findIndex(day => String(day.id) === String(dayId));
  const targetIndex = currentIndex + offset;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedVisible.length) return;

  const reordered = [...orderedVisible];
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

  const movedDay = orderedVisible[currentIndex];
  const movedTitle = dayTitle(
    movedDay,
    state.dayActivities.get(String(movedDay.id)) || [],
    state.dayLocations.get(String(movedDay.id)) || []
  );

  await persistDayOrder(reordered.map(day => String(day.id)), dayId);
  await recordChange({
    tripId: trip.id,
    entityType: 'trip_day',
    entityId: dayId,
    action: 'reorder',
    summary: 'Dia ' + (currentIndex + 1) + ' movido para o dia ' + (targetIndex + 1) + ': ' + movedTitle,
    beforeState: { position: currentIndex },
    afterState: { position: targetIndex }
  });
}

async function recoverHiddenDay(day) {
  const records = cloneDayRecords(day);
  const patch = {
    is_hidden: false,
    status: (day.status === 'hidden' || !day.status) ? 'planned' : day.status
  };
  await persistInlineDayChange(day, records.activities, records.locations, patch);
  await recordChange({
    tripId: day.trip_id || state.activeTripId,
    entityType: 'trip_day',
    entityId: day.id,
    action: 'restore',
    summary: 'Dia ' + dayNumber(day) + ' recuperado',
    beforeState: { is_hidden: true },
    afterState: { is_hidden: false }
  });
}

async function softDeleteHiddenDay(day) {
  const client = await trySupabase();
  if (!client || !await supportsOrderedDaySchema(client)) {
    throw new Error('A lixeira de dias ficará disponível após a migração do banco.');
  }

  const trip = activeTripForDay(day);
  const position = dayPosition(day);
  const deletedAt = new Date().toISOString();

  const deleted = await client
    .from('trip_days')
    .update({ deleted_at: deletedAt, is_hidden: true })
    .eq('id', day.id)
    .select()
    .single();
  if (deleted.error) throw deleted.error;

  const replacement = await client
    .from('trip_days')
    .insert({
      trip_id: day.trip_id,
      position,
      is_hidden: false,
      status: 'empty'
    })
    .select()
    .single();
  if (replacement.error) {
    await client.from('trip_days').update({ deleted_at: null }).eq('id', day.id);
    throw replacement.error;
  }

  const deletedDay = normalizeDayRecord(deleted.data);
  const replacementDay = normalizeDayRecord(replacement.data);
  const updatedDays = state.tripDays
    .map(item => String(item.id) === String(day.id) ? deletedDay : item)
    .concat(replacementDay)
    .sort((a, b) => dayPosition(a) - dayPosition(b));

  state.tripDays = updatedDays;
  const allActivities = [...state.dayActivities.values()].flat();
  const allLocations = [...state.dayLocations.values()].flat();
  await offlineStore.replaceTripData(String(trip.id), updatedDays, allActivities, allLocations);

  const data = {
    days: updatedDays,
    activitiesByDay: state.dayActivities,
    locationsByDay: state.dayLocations,
    loadedAt: Date.now(),
    version: Date.now()
  };
  state.tripDataCache.set(String(trip.id), data);
  applyTripData(data);
  await refreshSyncStatus();
  await recordChange({
    tripId: trip.id,
    entityType: 'trip_day',
    entityId: day.id,
    action: 'delete',
    summary: 'Dia ' + (position + 1) + ' movido para Apagados recentemente',
    beforeState: { deleted_at: null, position },
    afterState: { deleted_at: deletedAt, position }
  });
}

function renderTripDays(days, activitiesByDay = new Map(), locationsByDay = new Map()) {
  dom.tripDayList.replaceChildren();
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  const dayCount = tripDayCount(trip);
  const periodLabels = { morning: 'manhã', afternoon: 'tarde', night: 'noite' };
  const visibleDays = [...days]
    .map(normalizeDayRecord)
    .filter(day => !dayDeletedAt(day) && dayPosition(day) < dayCount)
    .sort((a, b) => dayPosition(a) - dayPosition(b));

  for (const day of visibleDays) {
    const activities = activitiesByDay.get(String(day.id)) || [];
    const locations = locationsByDay.get(String(day.id)) || [];
    const firstLocation = locations[0];
    const photo = dayPhoto(day, activities, locations);
    const titleText = dayTitle(day, activities, locations);
    const hidden = dayIsHidden(day);

    const card = document.createElement('li');
    card.className = 'trip-day-card';
    card.dataset.dayId = String(day.id);
    card.dataset.pressed = 'false';
    card.dataset.restorable = String(hidden);

    const image = document.createElement('div');
    image.className = 'trip-day-image';
    if (photo) image.style.backgroundImage = 'url("' + String(photo).replaceAll('"', '%22') + '")';

    const badge = document.createElement('div');
    badge.className = 'trip-day-badge';
    const label = document.createElement('span');
    label.className = 'trip-day-label';
    label.textContent = 'dia';
    const number = document.createElement('strong');
    number.className = 'trip-day-number';
    number.textContent = String(dayNumber(day));
    badge.append(label, number);

    const derivedDate = derivedDayDate(day, trip);
    const timingData = dayTiming(derivedDate);
    const timing = document.createElement('span');
    timing.className = 'trip-day-timing';
    timing.textContent = timingData.label;
    timing.dataset.today = String(timingData.today);
    image.append(badge, timing);

    if (!day.photo_url && firstLocation?.photo_provider === 'unsplash' && firstLocation.photo_author) {
      const credit = document.createElement('a');
      credit.className = 'trip-day-photo-credit';
      const authorUrl = firstLocation.photo_author_url || 'https://unsplash.com';
      credit.href = authorUrl + (authorUrl.includes('?') ? '&' : '?') + 'utm_source=viaggio&utm_medium=referral';
      credit.target = '_blank';
      credit.rel = 'noopener';
      credit.textContent = 'Foto: ' + firstLocation.photo_author + ' · Unsplash';
      credit.addEventListener('click', event => event.stopPropagation());
      image.append(credit);
    }

    const body = document.createElement('div');
    body.className = 'trip-day-body';
    const title = document.createElement('h2');
    title.textContent = titleText;
    const date = document.createElement('span');
    date.className = 'trip-day-date';
    date.textContent = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }).format(new Date(derivedDate + 'T12:00:00'));
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
        const timeText = activityTime(activity);
        if (timeText) {
          const time = document.createElement('time');
          time.textContent = timeText;
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

    const empty = !day.title && !day.summary && !day.photo_url && activities.length === 0 && locations.length === 0;
    button.setAttribute(
      'aria-label',
      hidden
        ? 'Dia ' + dayNumber(day) + ' oculto, disponível para recuperação'
        : empty
          ? 'Preencher dia ' + dayNumber(day)
          : 'Abrir dia ' + dayNumber(day)
    );

    if (!hidden) {
      const releasePress = () => { card.dataset.pressed = 'false'; };
      button.addEventListener('pointerdown', () => { card.dataset.pressed = 'true'; });
      button.addEventListener('pointerup', releasePress);
      button.addEventListener('pointercancel', releasePress);
      button.addEventListener('click', () => {
        button.blur();
        if (empty && canEditActiveTrip()) openDayEditor(day);
        else openDayPage(day.id);
      });
    } else {
      button.disabled = true;
    }

    button.append(image, body);
    card.append(button);

    if (hidden) {
      const recovery = document.createElement('div');
      recovery.className = 'trip-day-recovery';
      const message = document.createElement('span');
      message.textContent = 'Este dia existia antes da redução da viagem.';
      const recover = document.createElement('button');
      recover.type = 'button';
      recover.className = 'trip-day-recover';
      recover.textContent = 'Recuperar';
      recover.addEventListener('click', () => {
        recover.disabled = true;
        recoverHiddenDay(day).catch(error => {
          console.warn('Não foi possível recuperar o dia', error);
          recover.disabled = false;
        });
      });
      recovery.append(message, recover);

      if (orderedDaySchemaSupport === true) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'trip-day-remove';
        remove.textContent = 'Excluir';
        remove.addEventListener('click', () => {
          if (!window.confirm('Mover este dia para Apagados recentemente por 30 dias?')) return;
          remove.disabled = true;
          softDeleteHiddenDay(day).catch(error => {
            console.warn('Não foi possível excluir o dia', error);
            remove.disabled = false;
          });
        });
        recovery.append(remove);
      }

      card.append(recovery);
    } else {
      const currentIndex = visibleDays.findIndex(item => String(item.id) === String(day.id));
      const orderControls = document.createElement('div');
      orderControls.className = 'trip-day-order-controls';
      orderControls.setAttribute('aria-label', 'Mover dia ' + dayNumber(day));

      const moveUp = document.createElement('button');
      moveUp.type = 'button';
      moveUp.className = 'trip-day-order-button';
      moveUp.textContent = '↑';
      moveUp.setAttribute('aria-label', 'Subir dia ' + dayNumber(day) + ' uma posição');
      moveUp.disabled = currentIndex <= 0;
      moveUp.addEventListener('click', async event => {
        event.stopPropagation();
        moveUp.disabled = true;
        moveDown.disabled = true;
        try {
          await moveDayByOffset(day.id, -1);
        } catch (error) {
          console.warn('Não foi possível subir o dia', error);
          renderTripDays(state.tripDays, state.dayActivities, state.dayLocations);
        }
      });

      const moveDown = document.createElement('button');
      moveDown.type = 'button';
      moveDown.className = 'trip-day-order-button';
      moveDown.textContent = '↓';
      moveDown.setAttribute('aria-label', 'Descer dia ' + dayNumber(day) + ' uma posição');
      moveDown.disabled = currentIndex >= visibleDays.length - 1;
      moveDown.addEventListener('click', async event => {
        event.stopPropagation();
        moveUp.disabled = true;
        moveDown.disabled = true;
        try {
          await moveDayByOffset(day.id, 1);
        } catch (error) {
          console.warn('Não foi possível descer o dia', error);
          renderTripDays(state.tripDays, state.dayActivities, state.dayLocations);
        }
      });

      orderControls.append(moveUp, moveDown);
      card.append(orderControls);
    }

    dom.tripDayList.append(card);
  }

  dom.tripDayMessage.textContent = visibleDays.length ? '' : 'Nenhum dia encontrado para esta viagem.';
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

function updateAgendaAddStickyState() {
  const markerTop = dom.dayAgendaStickyMarker.getBoundingClientRect().top;
  const backTop = dom.closeDayPage.getBoundingClientRect().top;
  dom.addDayPageActivity.dataset.stuck = markerTop <= backTop + 1 ? 'true' : 'false';
}

const DAY_ATTACHMENT_BUCKET = 'day-attachments';
const DAY_ATTACHMENT_MAX_BYTES = 6 * 1024 * 1024;
const DAY_ATTACHMENT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function dayAttachmentType(file) {
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  const type = DAY_ATTACHMENT_TYPES[extension];
  if (!type) return null;
  // The Photos/Files picker may omit the MIME type; extensions stay allowlisted.
  if (file.type && file.type !== type && file.type !== 'application/octet-stream'
    && !(type === 'image/jpeg' && file.type === 'image/jpg')) return null;
  return { type, extension };
}

function dayAttachmentPath(tripId, dayId, extension) {
  return `${tripId}/${dayId || 'general'}/${crypto.randomUUID()}.${extension}`;
}

async function storeTripAttachment(client, tripId, dayId, file) {
  const accepted = dayAttachmentType(file);
  if (!accepted || !file.size || file.size > DAY_ATTACHMENT_MAX_BYTES) {
    throw new Error('Use fotos, PDF ou Word de até 6 MB: ' + file.name);
  }
  const path = dayAttachmentPath(tripId, dayId, accepted.extension);
  const uploaded = await client.storage.from(DAY_ATTACHMENT_BUCKET).upload(path, file, {
    contentType: accepted.type, upsert: false
  });
  if (uploaded.error) throw uploaded.error;
  const inserted = await client.from('day_attachments').insert({
    trip_id: tripId, day_id: dayId, storage_path: path, file_name: file.name.slice(0, 180),
    mime_type: accepted.type, size_bytes: file.size
  });
  if (inserted.error) {
    await client.storage.from(DAY_ATTACHMENT_BUCKET).remove([path]);
    throw inserted.error;
  }
}

function setDayAttachmentStatus(message, kind = 'info') {
  dom.dayAttachmentsStatus.dataset.kind = kind;
  dom.dayAttachmentsStatus.textContent = message;
}

function renderDayAttachments(dayId) {
  if (state.activeDayId !== String(dayId)) return;
  const items = state.dayAttachments.get(String(dayId)) || [];
  dom.dayAttachmentsCount.textContent = String(items.length);
  dom.dayAttachmentsCount.hidden = !items.length;
  dom.dayAttachmentsList.replaceChildren();
  for (const attachment of items) {
    const row = document.createElement('li');
    row.className = 'day-attachment';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'day-attachment-open';
    open.setAttribute('aria-label', `Visualizar ${attachment.file_name}`);
    open.addEventListener('click', () => openTripFileViewer(attachment, items));
    const preview = document.createElement('span');
    preview.className = 'day-attachment-preview';
    if (attachment.mime_type.startsWith('image/') && attachment.signedUrl) {
      const image = document.createElement('img');
      image.src = attachment.signedUrl;
      image.alt = '';
      image.onerror = () => { image.remove(); preview.textContent = 'FOTO'; };
      preview.append(image);
    } else {
      preview.textContent = attachment.mime_type === 'application/pdf' ? 'PDF' : 'DOC';
    }
    const name = document.createElement('span');
    name.className = 'day-attachment-name';
    name.textContent = attachment.file_name;
    const size = document.createElement('small');
    size.textContent = (attachment.size_bytes / 1024 / 1024).toFixed(1) + ' MB';
    name.append(size);
    open.append(preview, name);
    row.append(open);
    dom.dayAttachmentsList.append(row);
  }
  if (!items.length && document.body.dataset.dayAttachments === 'open') {
    setDayAttachmentStatus(navigator.onLine ? 'Nenhum arquivo neste dia ainda.' : 'Os arquivos precisam de conexão para carregar.');
  }
}

async function loadDayAttachments(dayId) {
  const key = String(dayId);
  if (state.dayAttachmentLoads.has(key)) return state.dayAttachmentLoads.get(key);
  const loading = (async () => {
    const client = await trySupabase(5000);
    if (!client) throw new Error('Conecte-se à internet para acessar os arquivos do dia.');
    const { data, error } = await client.from('day_attachments').select('*').eq('day_id', key).order('created_at');
    if (error) throw error;
    const signed = await Promise.all((data || []).map(async attachment => {
      const result = await client.storage.from(DAY_ATTACHMENT_BUCKET).createSignedUrl(attachment.storage_path, 3600);
      return { ...attachment, signedUrl: result.error ? '' : result.data?.signedUrl || '' };
    }));
    state.dayAttachments.set(key, signed);
    renderDayAttachments(key);
  })().finally(() => state.dayAttachmentLoads.delete(key));
  state.dayAttachmentLoads.set(key, loading);
  return loading;
}

function closeDayAttachments() {
  document.body.dataset.dayAttachments = 'closed';
  dom.dayAttachmentsSheet.setAttribute('aria-hidden', 'true');
}

function openDayAttachments() {
  if (!state.activeDayId) return;
  document.body.dataset.dayAttachments = 'open';
  dom.dayAttachmentsSheet.setAttribute('aria-hidden', 'false');
  renderDayAttachments(state.activeDayId);
  setDayAttachmentStatus('Carregando arquivos…');
  loadDayAttachments(state.activeDayId).then(() => {
    if ((state.dayAttachments.get(state.activeDayId) || []).length) setDayAttachmentStatus('');
  }).catch(error => setDayAttachmentStatus(error.message || 'Não foi possível carregar os arquivos.', 'error'));
}

async function uploadDayAttachments(files) {
  const day = state.tripDays.find(item => String(item.id) === state.activeDayId);
  if (!day || !files.length) return;
  const client = await trySupabase(5000);
  if (!client) { setDayAttachmentStatus('É preciso estar conectado para enviar arquivos.', 'error'); return; }
  const uploadControl = dom.dayAttachmentsInput.closest('.day-attachments-upload');
  uploadControl.dataset.busy = 'true';
  try {
    for (const [index, file] of files.entries()) {
      setDayAttachmentStatus(`Enviando ${index + 1} de ${files.length}: ${file.name}`);
      await storeTripAttachment(client, day.trip_id, day.id, file);
    }
    await loadDayAttachments(day.id);
    if (state.activeTripTab === 'arquivos') loadTripFiles(day.trip_id).catch(console.warn);
    setDayAttachmentStatus(files.length === 1 ? 'Arquivo salvo.' : `${files.length} arquivos salvos.`);
  } catch (error) {
    await loadDayAttachments(day.id).catch(() => {});
    setDayAttachmentStatus(error.message || 'Falha no envio. Tente novamente.', 'error');
  } finally {
    uploadControl.dataset.busy = 'false';
    dom.dayAttachmentsInput.value = '';
  }
}

async function removeDayAttachment(attachment) {
  if (!canEditActiveTrip()) return false;
  if (!window.confirm(attachment.day_id ? 'Excluir este arquivo do dia?' : 'Excluir este arquivo da viagem?')) return null;
  const client = await trySupabase(5000);
  const setStatus = document.body.dataset.dayAttachments === 'open'
    ? setDayAttachmentStatus
    : (message, kind) => setTripPanelStatus(dom.tripFilesStatus, message, kind);
  if (!client) { setStatus('É preciso estar conectado para excluir.', 'error'); return false; }
  const removed = await client.from('day_attachments').delete().eq('id', attachment.id);
  if (removed.error) { setStatus(removed.error.message, 'error'); return false; }
  const file = await client.storage.from(DAY_ATTACHMENT_BUCKET).remove([attachment.storage_path]);
  if (file.error) console.warn('Arquivo removido da lista; limpeza do armazenamento pendente', file.error);
  if (attachment.day_id) await loadDayAttachments(attachment.day_id).catch(error => setDayAttachmentStatus(error.message, 'error'));
  if (state.activeTripTab === 'arquivos') {
    await loadTripFiles(String(state.activeTripId)).catch(error => setTripPanelStatus(dom.tripFilesStatus, error.message, 'error'));
  }
  setStatus('Arquivo excluído.');
  return true;
}

function openDayPage(dayId, { pushHistory = true } = {}) {
  const day = state.tripDays.find(item => String(item.id) === String(dayId));
  if (!day) return;
  dom.tripTabs.inert = true;
  dom.tripTabs.setAttribute('aria-hidden', 'true');
  if (state.activeDayId && state.activeDayId !== String(day.id) && dom.dayMapSection.dataset.expanded === 'true') setDayMapExpanded(false);
  dom.dayPage.inert = false;
  if (pushHistory) window.history.pushState({ view: 'day', tripId: String(state.activeTripId), dayId: String(day.id) }, '', `#day-${day.id}`);
  state.activeDayId = String(day.id);
  const renderKey = `${state.activeTripId}:${day.id}:${state.activeTripDataVersion}`;
  if (dom.dayPage.dataset.renderKey === renderKey) {
    const activities = state.dayActivities.get(String(day.id)) || [];
    const locations = state.dayLocations.get(String(day.id)) || [];
    ensureDayTitleControl().textContent = dayTitle(day, activities, locations);
    ensureDayTitleControl().disabled = !canEditActiveTrip();
    dom.addDayPageActivity.disabled = !canEditActiveTrip();
    dom.dayPageSaveStatus.dataset.state = state.daySaveStates.get(String(day.id)) || 'idle';
    dom.dayPage.setAttribute('aria-hidden', 'false');
    document.body.dataset.dayPage = 'open';
    updateAgendaAddStickyState();
    renderDayAttachments(day.id);
    if (navigator.onLine) loadDayAttachments(day.id).catch(error => console.warn('Arquivos do dia indisponíveis', error));
    return;
  }
  const activities = state.dayActivities.get(String(day.id)) || [];
  const locations = state.dayLocations.get(String(day.id)) || [];
  const photo = dayPhoto(day, activities, locations);
  dom.dayPageHero.style.backgroundImage = photo ? `url("${String(photo).replaceAll('"', '%22')}")` : '';
  dom.dayPageBadge.textContent = `dia ${dayNumber(day)}`;
  ensureDayTitleControl().textContent = dayTitle(day, activities, locations);
  ensureDayTitleControl().disabled = !canEditActiveTrip();
  dom.addDayPageActivity.disabled = !canEditActiveTrip();
  dom.dayPagePhotoInput.disabled = !canEditActiveTrip();
  dom.dayPageSaveStatus.dataset.state = state.daySaveStates.get(String(day.id)) || 'idle';
  const derivedDate = derivedDayDate(day);
  dom.dayPageDate.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${derivedDate}T12:00:00`));
  renderDayPageAgenda(day, activities, locations);
  renderDayPageMap(day, locations, activities);
  if (canEditActiveTrip()) enrichDayPage(day, activities, locations).catch(error => console.warn('Não foi possível enriquecer o dia', error));
  dom.dayPage.dataset.renderKey = renderKey;
  dom.dayPage.setAttribute('aria-hidden', 'false');
  document.body.dataset.dayPage = 'open';
  updateAgendaAddStickyState();
  renderDayAttachments(day.id);
  if (navigator.onLine) loadDayAttachments(day.id).catch(error => console.warn('Arquivos do dia indisponíveis', error));
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

  const patch = { status: day.status || 'planned', ...dayPatch };

  return queueDaySave(dayId, async () => {
    try {
      setDaySaveState(dayId, 'saving');
      const currentDay = state.tripDays.find(item => String(item.id) === dayId) || day;
      const updatedDay = { ...currentDay, ...patch };
      const activities = state.dayActivities.get(dayId) || [];
      const locations = state.dayLocations.get(dayId) || [];
      await offlineStore.saveDayBundle(updatedDay, activities, locations);
      await offlineStore.enqueueMutation({
        type: 'save-day-patch',
        tripId: String(day.trip_id || state.activeTripId),
        dayId: day.id,
        dayPatch: patch
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
  if (!canEditActiveTrip()) return;
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
  const originalTitle = editor.value.trim();

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
      const finalTitle = editor.value.trim();
      if (finalTitle !== originalTitle) {
        await recordChange({
          tripId: day.trip_id || state.activeTripId,
          entityType: 'trip_day',
          entityId: day.id,
          action: 'update',
          summary: 'Dia ' + dayNumber(day) + ' renomeado de “' + originalTitle + '” para “' + finalTitle + '”',
          beforeState: { title: originalTitle },
          afterState: { title: finalTitle }
        });
      }
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
    await recordChange({
      tripId: day.trip_id || state.activeTripId,
      entityType: 'trip_day',
      entityId: day.id,
      action: 'update',
      summary: 'Imagem do dia ' + dayNumber(day) + ' alterada',
      beforeState: { photo: Boolean(day.photo_url) },
      afterState: { photo: true }
    });
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
  const { activityId = null, locationId = null, rerender = true } = options;
  const patch = { status: day.status || 'planned', ...dayPatch };
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
      const dayId = String(day.id);
      const currentDay = state.tripDays.find(item => String(item.id) === dayId) || day;
      const updatedDay = { ...currentDay, ...patch };
      const targetActivity = activityId ? activities.find(item => String(item.id) === String(activityId)) : null;
      const targetLocation = locationId ? locations.find(item => String(item.id) === String(locationId)) : null;
      const currentActivities = state.dayActivities.get(dayId) || activities;
      const currentLocations = state.dayLocations.get(dayId) || locations;
      const mergedActivities = targetActivity
        ? currentActivities.some(item => String(item.id) === String(activityId))
          ? currentActivities.map(item => String(item.id) === String(activityId) ? targetActivity : item)
          : [...currentActivities, targetActivity]
        : currentActivities;
      const mergedLocations = targetLocation
        ? currentLocations.some(item => String(item.id) === String(locationId))
          ? currentLocations.map(item => String(item.id) === String(locationId) ? targetLocation : item)
          : [...currentLocations, targetLocation]
        : currentLocations;

      await offlineStore.saveDayBundle(updatedDay, mergedActivities, mergedLocations);
      await offlineStore.enqueueMutation({
        type: activityId ? 'save-inline-activity' : 'save-day-patch',
        tripId: String(day.trip_id || state.activeTripId),
        dayId: day.id,
        dayPatch: patch,
        ...(activityId ? {
          activity: targetActivity || null,
          location: targetLocation || null
        } : {})
      });

      updateInlineDayState(updatedDay, mergedActivities, mergedLocations);
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

  const serializedSave = () => queueDaySave(day.id, save);
  return activityId ? queueAgendaSave(activityId, serializedSave) : serializedSave();
}

function cloneDayRecords(day) {
  const dayId = String(day.id);
  return {
    activities: (state.dayActivities.get(dayId) || []).map(activity => ({ ...activity })),
    locations: (state.dayLocations.get(dayId) || []).map(location => ({ ...location }))
  };
}

function recordsDiffer(after, before) {
  if (!before) return true;
  return [...new Set([...Object.keys(after), ...Object.keys(before)])].some(key => {
    if (after[key] === before[key]) return false;
    if (after[key] && before[key] && typeof after[key] === 'object' && typeof before[key] === 'object') {
      return JSON.stringify(after[key]) !== JSON.stringify(before[key]);
    }
    return true;
  });
}

function beginInlineTimeEdit(button, day, activity) {
  if (!canEditActiveTrip()) return;
  const input = document.createElement('input');
  input.type = 'time';
  input.className = 'day-inline-time-input';
  input.value = activityTime(activity) || '09:00';

  let committed = false;
  const commit = async () => {
    if (committed) return;
    committed = true;

    const previousTime = activityTime(activity) || '—';
    const value = input.value;
    if (!value || value === previousTime) {
      input.replaceWith(button);
      return;
    }

    setAgendaSaveState(activity.id, 'saving');
    const records = cloneDayRecords(day);
    const target = records.activities.find(item => String(item.id) === String(activity.id));
    if (!target) return;

    target.start_time = value + ':00';
    target.period = periodFromTime(value);
    await persistInlineDayChange(day, records.activities, records.locations, {}, { activityId: activity.id });
    if (previousTime !== value) {
      await recordChange({
        tripId: day.trip_id || state.activeTripId,
        entityType: 'activity',
        entityId: activity.id,
        action: 'update',
        summary: 'Horário de “' + (activity.title || 'atividade') + '” alterado de ' + previousTime + ' para ' + value,
        beforeState: { start_time: previousTime },
        afterState: { start_time: value }
      });
    }
  };

  button.replaceWith(input);
  // iOS fires change as the time wheels move; Done dismisses the picker and blurs the input.
  input.addEventListener('blur', commit, { once: true });
  input.focus({ preventScroll: true });
  if (input.showPicker) input.showPicker();
}

function beginInlineTextEdit(button, day, activity, field, multiline = false) {
  if (!canEditActiveTrip()) return;
  const editor = document.createElement(multiline ? 'textarea' : 'input');
  editor.className = multiline ? 'day-inline-textarea' : 'day-inline-text-input';
  if (!multiline) editor.type = 'text';
  editor.value = activity[field] || '';
  if (multiline) editor.rows = 3;
  const originalValue = editor.value.trim();

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

    target[field] = value.trim() || (field === 'title' ? NEW_AGENDA_TITLE : null);
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
      const finalValue = value.trim() || (field === 'title' ? NEW_AGENDA_TITLE : '');
      if (finalValue !== originalValue) {
        await recordChange({
          tripId: day.trip_id || state.activeTripId,
          entityType: 'activity',
          entityId: activity.id,
          action: 'update',
          summary: field === 'title'
            ? 'Atividade renomeada de “' + (originalValue || 'sem título') + '” para “' + (finalValue || 'sem título') + '”'
            : 'Observação de “' + (activity.title || 'atividade') + '” alterada',
          beforeState: { [field]: originalValue || null },
          afterState: { [field]: finalValue || null }
        });
      }
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
  if ((field === 'title' && originalValue === NEW_AGENDA_TITLE)
    || (field === 'description' && originalValue === NEW_AGENDA_DESCRIPTION)) {
    editor.select();
  } else if (editor.setSelectionRange) {
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }
}

function locationDraft(location, activity) {
  return {
    id: location?.id || crypto.randomUUID(),
    name: location?.name || activity.place_name || (activity.title === NEW_AGENDA_TITLE ? '' : primaryActivityPlace(activity)),
    selectedName: location?.name || activity.place_name || '',
    photoUrl: location?.photo_url || '',
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
  const previousPlace = location?.name || activity.place_name || 'Sem local';

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
    photo_url: draft.photoUrl || location?.photo_url || null
  };

  if (location) Object.assign(location, record);
  else records.locations.push(record);

  activity.place_id = record.id;
  activity.place_name = record.name;
  activity.address = record.formatted_address;
  activity.latitude = record.latitude;
  activity.longitude = record.longitude;
  setAgendaSaveState(activity.id, 'saving');
  await persistInlineDayChange(day, records.activities, records.locations, {}, {
    activityId: activity.id,
    locationId: record.id
  });
  if (previousPlace !== record.name) {
    await recordChange({
      tripId: day.trip_id || state.activeTripId,
      entityType: 'activity',
      entityId: activity.id,
      action: 'update',
      summary: 'Local de “' + (activity.title || 'atividade') + '” alterado de “' + previousPlace + '” para “' + record.name + '”',
      beforeState: { place_name: previousPlace === 'Sem local' ? null : previousPlace },
      afterState: { place_name: record.name }
    });
  }
}

async function saveInlinePhoto(day, activity, location, file) {
  setAgendaSaveState(activity.id, 'saving');
  const photoUrl = await compressImage(file);
  const records = cloneDayRecords(day);
  const targetActivity = records.activities.find(item => String(item.id) === String(activity.id));
  if (!targetActivity) return;

  // Photos belong to agenda items. A shared place may provide a fallback image,
  // but changing one agenda item's photo must never mutate the place or siblings.
  targetActivity.photo_url = photoUrl;

  await persistInlineDayChange(day, records.activities, records.locations, {}, { activityId: activity.id });
  await recordChange({
    tripId: day.trip_id || state.activeTripId,
    entityType: 'activity',
    entityId: activity.id,
    action: 'update',
    summary: 'Foto de “' + (activity.title || location?.name || 'atividade') + '” alterada',
    beforeState: { photo: Boolean(activity.photo_url || location?.photo_url) },
    afterState: { photo: true }
  });
}

function orderedDayActivities(activities = []) {
  return [...activities].sort((a, b) => String(activityTime(a) || '00:00').localeCompare(String(activityTime(b) || '00:00')) || (a.position || 0) - (b.position || 0));
}

function newAgendaActivity(day, activities = []) {
  const first = orderedDayActivities(activities)[0];
  const firstTime = first ? activityTime(first) : '09:01';
  const firstMinutes = firstTime ? Number(firstTime.slice(0, 2)) * 60 + Number(firstTime.slice(3, 5)) : 0;
  const minutes = Math.max(0, firstMinutes - 1);
  const time = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  const position = activities.length ? Math.min(...activities.map(item => Number(item.position) || 0)) - 1 : 0;
  return {
    id: crypto.randomUUID(),
    day_id: day.id,
    position,
    period: periodFromTime(time),
    start_time: time + ':00',
    title: NEW_AGENDA_TITLE,
    description: NEW_AGENDA_DESCRIPTION,
    place_id: null,
    place_name: null
  };
}

async function addInlineDayActivity() {
  if (!canEditActiveTrip()) return;
  const day = state.tripDays.find(item => String(item.id) === String(state.activeDayId));
  if (!day) return;

  const records = cloneDayRecords(day);
  const activity = newAgendaActivity(day, records.activities);
  records.activities.push(activity);
  updateInlineDayState(day, records.activities, records.locations);
  openDayPage(day.id, { pushHistory: false });
  dom.dayPageAgenda.firstElementChild?.scrollIntoView({ block: 'center' });

  try {
    await persistInlineDayChange(day, records.activities, records.locations, {}, { activityId: activity.id });
    await recordChange({
      tripId: day.trip_id || state.activeTripId,
      entityType: 'activity',
      entityId: activity.id,
      action: 'create',
      summary: 'Item adicionado à agenda do dia ' + dayNumber(day),
      afterState: { title: activity.title, start_time: activity.start_time }
    });
  } catch (error) {
    setAgendaSaveState(activity.id, 'error');
    console.warn('Não foi possível salvar o novo item da agenda', error);
  }
}

function renderDayPageAgenda(day, activities, locations) {
  dom.dayPageAgenda.replaceChildren();
  const ordered = orderedDayActivities(activities);

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

    const googleMapsUrl = googleMapsAddressUrl(activity, location);
    item.dataset.hasGoogleMaps = String(Boolean(googleMapsUrl));
    let googleMapsLink = null;
    if (googleMapsUrl) {
      googleMapsLink = document.createElement('a');
      googleMapsLink.className = 'day-inline-google-maps';
      googleMapsLink.href = googleMapsUrl;
      googleMapsLink.target = '_blank';
      googleMapsLink.rel = 'noopener noreferrer';
      googleMapsLink.setAttribute('aria-label', 'Abrir no Google Maps: ' + (location?.name || activity.place_name || activity.title || 'endereço'));
      googleMapsLink.title = 'Abrir no Google Maps';
      const mapsIcon = document.createElement('img');
      mapsIcon.src = 'https://www.gstatic.com/images/branding/product/1x/maps_48dp.png';
      mapsIcon.alt = '';
      mapsIcon.width = 28;
      mapsIcon.height = 28;
      googleMapsLink.append(mapsIcon);
    }

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
    place.textContent = location?.name || activity.place_name || (activity.title === NEW_AGENDA_TITLE ? 'Definir local' : 'Sem local definido');
    place.addEventListener('click', () => openInlinePlaceSearch(day, activity, location));

    copy.append(title, place);

    const description = document.createElement('button');
    description.type = 'button';
    description.className = 'day-inline-description';
    description.textContent = activity.description || 'Adicionar observação';
    description.dataset.empty = String(!activity.description || activity.description === NEW_AGENDA_DESCRIPTION);
    description.setAttribute('aria-label', activity.description && activity.description !== NEW_AGENDA_DESCRIPTION ? 'Editar observação' : 'Adicionar observação');
    description.addEventListener('click', () => beginInlineTextEdit(description, day, activity, 'description', true));
    copy.append(description);

    const photoUrl = activity.photo_url || location?.photo_url || '';
    item.dataset.hasPhoto = String(Boolean(photoUrl));
    item.append(time, pin);
    if (googleMapsLink) item.append(googleMapsLink);
    item.append(saveStatus, copy);

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.className = 'day-inline-photo-input';
    file.setAttribute('aria-label', 'Escolher foto de ' + (location?.name || activity.title || 'atividade'));

    const camera = document.createElement('label');
    camera.className = 'day-inline-camera';
    camera.setAttribute('aria-label', 'Alterar foto');

    const cameraIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cameraIcon.classList.add('day-photo-icon');
    cameraIcon.setAttribute('viewBox', '0 0 24 24');
    cameraIcon.setAttribute('aria-hidden', 'true');

    const cameraBody = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cameraBody.setAttribute('d', 'M4 8.5A2.5 2.5 0 0 1 6.5 6H9l1.4-2h3.2L15 6h2.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z');

    const cameraLens = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cameraLens.setAttribute('cx', '12');
    cameraLens.setAttribute('cy', '12.5');
    cameraLens.setAttribute('r', '3.2');

    cameraIcon.append(cameraBody, cameraLens);
    camera.append(cameraIcon, file);

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

  dom.dayPageEmpty.textContent = ordered.length ? '' : 'Nenhum horário planejado para o dia ' + dayNumber(day) + '.';
}

function dayMapPoints(locations, activities = []) {
  const points = [];
  const scheduledLocationIds = new Set();

  // Every agenda entry stays visible, even when it shares a position or lacks coordinates.
  orderedDayActivities(activities).forEach(activity => {
    const location = activityLocation(activity, locations);
    if (location?.id != null) scheduledLocationIds.add(String(location.id));
    const hasLocationCoordinates = Number.isFinite(numericCoordinate(location?.latitude))
      && Number.isFinite(numericCoordinate(location?.longitude));
    const source = hasLocationCoordinates ? location : activity;
    points.push({
      name: location?.name || activity.place_name || activity.title || 'Local',
      latitude: numericCoordinate(source.latitude),
      longitude: numericCoordinate(source.longitude),
      activityId: activity.id,
      time: activityTime(activity)
    });
  });
  // Show independently saved places only if they do not already belong to an agenda item.
  locations.filter(location => !scheduledLocationIds.has(String(location.id))).forEach(location => {
    const latitude = numericCoordinate(location.latitude);
    const longitude = numericCoordinate(location.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      points.push({ name: location.name || 'Local', latitude, longitude });
    }
  });

  return points;
}

function dayMapGroups(points) {
  const groups = new Map();
  points.forEach((point, index) => {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
    const key = point.latitude.toFixed(6) + ':' + point.longitude.toFixed(6);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...point, number: index + 1 });
  });
  return [...groups.values()];
}

function setDayMapExpanded(expanded) {
  const wasExpanded = dom.dayMapSection.dataset.expanded === 'true';
  if (expanded && !wasExpanded) {
    state.dayMapScrollTop = dom.dayPage.scrollTop;
    dom.dayPage.scrollTop = 0;
  }
  dom.dayMapSection.dataset.expanded = String(expanded);
  dom.dayPage.dataset.mapExpanded = String(expanded);
  for (const node of dom.dayPage.querySelectorAll('.day-page-nav, .day-page-hero, .day-page-content > :not(.day-map-section)')) node.inert = expanded;
  dom.dayMapToggle.setAttribute('aria-expanded', String(expanded));
  dom.dayMapToggle.setAttribute('aria-label', expanded ? 'Reduzir mapa' : 'Ampliar mapa');
  dom.dayMapToggle.querySelector('span').textContent = expanded ? 'Reduzir' : 'Ampliar';
  if (!expanded && wasExpanded) {
    dom.dayPage.scrollTop = state.dayMapScrollTop ?? 0;
    state.dayMapScrollTop = null;
  }
  if (state.dayMap) requestAnimationFrame(() => {
    if (!state.dayMap || document.body.dataset.dayPage !== 'open') return;
    state.dayMap.invalidateSize({ pan: false });
    const bounds = state.dayMapBounds;
    if (bounds?.length === 1) state.dayMap.setView(bounds[0], 16);
    else if (bounds?.length > 1) state.dayMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  });
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

function renderDayPageMap(day, locations, activities = []) {
  const points = dayMapPoints(locations, activities);
  const mapped = points.filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  const route = mapped.filter((point, index) => index === 0
    || point.latitude !== mapped[index - 1].latitude || point.longitude !== mapped[index - 1].longitude);
  const token = ++state.dayMapRenderToken;

  if (state.dayMap) {
    state.dayMap.remove();
    state.dayMap = null;
  }
  state.dayMapBounds = null;

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
    item.dataset.mapped = String(mapped.includes(point));
    const marker = document.createElement('span');
    marker.textContent = String(index + 1);
    const name = document.createElement('strong');
    name.textContent = point.name || ('Local ' + String(index + 1));
    const details = document.createElement('small');
    details.textContent = (point.time ? point.time + ' · ' : '')
      + (item.dataset.mapped === 'true' ? 'No mapa' : 'Sem posição no mapa');
    const copy = document.createElement('div');
    copy.append(name, details);
    item.append(marker, copy);
    if (item.dataset.mapped === 'false' && point.activityId != null) {
      const activity = activities.find(entry => String(entry.id) === String(point.activityId));
      if (activity) {
        const choosePlace = document.createElement('button');
        choosePlace.type = 'button';
        choosePlace.textContent = 'Definir local';
        choosePlace.addEventListener('click', () => openInlinePlaceSearch(day, activity, activityLocation(activity, locations)));
        item.append(choosePlace);
      }
    }
    pinList.append(item);
  });
  dom.dayPageDirections.append(pinList);

  if (!mapped.length) {
    dom.dayPageMap.textContent = 'Os locais da agenda ainda não têm posição no mapa.';
    return;
  }

  const routeLink = document.createElement('a');
  routeLink.className = 'day-view-route-link';
  routeLink.target = '_blank';
  routeLink.rel = 'noopener';
  if (route.length > 1) {
    routeLink.href = 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route='
      + route.map(point => point.latitude + '%2C' + point.longitude).join('%3B');
    routeLink.textContent = 'Abrir direções do dia';
  } else {
    routeLink.href = 'https://www.openstreetmap.org/?mlat=' + mapped[0].latitude
      + '&mlon=' + mapped[0].longitude
      + '#map=16/' + mapped[0].latitude + '/' + mapped[0].longitude;
    routeLink.textContent = 'Abrir local no mapa';
  }
  dom.dayPageDirections.append(routeLink);

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
    dayMapGroups(points).forEach(group => {
      const first = group[0];
      const latLng = [first.latitude, first.longitude];
      bounds.push(latLng);
      const icon = L.divIcon({
        className: 'day-map-numbered-marker',
        html: '<span><b>' + String(first.number) + '</b>'
          + (group.length > 1 ? '<i>+' + String(group.length - 1) + '</i>' : '') + '</span>',
        iconSize: [34, 40],
        iconAnchor: [17, 40],
        popupAnchor: [0, -38]
      });
      const popup = document.createElement('div');
      group.forEach(point => {
        const label = document.createElement('div');
        label.textContent = point.number + '. ' + point.name + (point.time ? ' · ' + point.time : '');
        popup.append(label);
      });
      L.marker(latLng, { icon }).addTo(map).bindPopup(popup);
    });
    state.dayMapBounds = bounds;

    if (route.length > 1) {
      L.polyline(route.map(point => [point.latitude, point.longitude]), {
        color: '#0a84ff',
        weight: 4,
        opacity: .72,
        dashArray: '8 9',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    requestAnimationFrame(() => map.invalidateSize());
  }).catch(() => renderOsmMapFallback(mapped, token));
}

function closeDayPage() {
  closeDayAttachments();
  setDayMapExpanded(false);
  dom.dayPage.inert = true;
  state.activeDayId = null;
  state.dayMapRenderToken += 1;
  if (state.dayMap) {
    state.dayMap.remove();
    state.dayMap = null;
  }
  document.body.dataset.dayPage = 'closed';
  dom.dayPage.setAttribute('aria-hidden', 'true');
  if (state.activeTripId && document.body.dataset.tripPage === 'open') {
    dom.tripTabs.inert = false;
    dom.tripTabs.setAttribute('aria-hidden', 'false');
  }
}

function navigateBackFromDay() {
  if (window.history.state?.view === 'day') window.history.back();
  else closeDayPage();
}

function openDayEditor(day) {
  if (!canEditActiveTrip()) return;
  const locations = state.dayLocations.get(String(day.id)) || [];
  const activities = state.dayActivities.get(String(day.id)) || [];
  state.dayEditor = {
    day,
    title: day.title || '',
    notes: day.summary || '',
    locations: locations.length ? locations.map(location => ({ id: location.id || crypto.randomUUID(), name: location.name || '', photoUrl: location.photo_url || '', provider: location.provider || '', providerPlaceId: location.provider_place_id || '', formattedAddress: location.formatted_address || '', latitude: numericCoordinate(location.latitude), longitude: numericCoordinate(location.longitude), category: location.category || '', placeType: location.place_type || '', photoProvider: location.photo_provider || '', photoAuthor: location.photo_author || '', photoAuthorUrl: location.photo_author_url || '', photoSourceUrl: location.photo_source_url || '' })) : [{ id: crypto.randomUUID(), name: '', photoUrl: '', provider: '', providerPlaceId: '', formattedAddress: '', latitude: null, longitude: null, category: '', placeType: '' }],
    activities: activities.length ? activities.map(activity => ({ id: activity.id || crypto.randomUUID(), time: activityTime(activity) || '09:00', text: activity.title || '', locationId: activity.place_id || '' })) : [{ id: crypto.randomUUID(), time: '09:00', text: '', locationId: '' }]
  };
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  const destination = trip?.destination?.trim() || trip?.name?.trim() || 'seu destino';
  dom.dayEditTitle.textContent = `Dia ${dayNumber(day)}`;
  dom.dayEditDate.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${derivedDayDate(day)}T12:00:00`));
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

function dayPatchForRemote(dayPatch, orderedSchema) {
  if (orderedSchema) return { ...dayPatch };

  const patch = { ...dayPatch };
  if ('is_hidden' in patch) {
    patch.status = patch.is_hidden ? 'hidden' : (patch.status === 'hidden' ? 'planned' : patch.status);
    delete patch.is_hidden;
  }
  if ('deleted_at' in patch) {
    patch.status = patch.deleted_at ? 'deleted:' + patch.deleted_at : (patch.status?.startsWith?.('deleted:') ? 'planned' : patch.status);
    delete patch.deleted_at;
  }
  delete patch.position;
  return patch;
}

function activityForRemote(activity, orderedSchema, day = null) {
  const record = { ...activity };
  if (orderedSchema) {
    delete record.starts_at;
    if (!record.start_time && activityTime(activity)) record.start_time = activityTime(activity) + ':00';
    return record;
  }

  delete record.start_time;
  const time = activityTime(activity) || '09:00';
  const date = day ? derivedDayDate(day) : '';
  if (date) record.starts_at = date + 'T' + time + ':00';
  return record;
}

function locationForRemote(location) {
  return {
    ...location,
    created_at: location?.created_at || new Date().toISOString()
  };
}

async function syncMutation(mutation, previousDay = null) {
  const client = await trySupabase();
  if (!client) throw new Error('Backend indisponível.');

  if (mutation.type === 'record-change') {
    if (mutation.snapshotId && mutation.tripId) {
      const existing = await client.from('state_snapshots').select('id')
        .eq('id', mutation.snapshotId).eq('trip_id', mutation.tripId).maybeSingle();
      if (existing.error || !existing.data) {
        const snapshot = await client.rpc('capture_trip_snapshot', {
          p_snapshot_id: mutation.snapshotId,
          p_trip_id: mutation.tripId,
          p_label: mutation.entry?.summary || null
        });
        if (snapshot.error) throw snapshot.error;
      }
    }
    // History rows are immutable. Retrying an existing entry must not require
    // UPDATE permission, which the change_log RLS policy deliberately omits.
    const saved = await client.from('change_log').upsert(mutation.entry, { onConflict: 'id', ignoreDuplicates: true });
    if (saved.error) throw saved.error;
    return;
  }

  if (mutation.type === 'change-log') {
    const saved = await client.from('change_log').upsert(mutation.entry, { onConflict: 'id', ignoreDuplicates: true });
    if (saved.error) throw saved.error;
    return;
  }

  const orderedSchema = await supportsOrderedDaySchema(client);

  if (mutation.type === 'reorder-days') {
    const field = orderedSchema ? 'position' : 'day_number';
    const order = mutation.order || [];
    const temporaryBase = 100000;

    for (const [index, item] of order.entries()) {
      const temporaryValue = temporaryBase + index;
      const moved = await client.from('trip_days').update({ [field]: temporaryValue }).eq('id', item.id).eq('trip_id', mutation.tripId);
      if (moved.error) throw moved.error;
    }

    for (const item of order) {
      const finalValue = orderedSchema ? item.position : item.position + 1;
      const moved = await client.from('trip_days').update({ [field]: finalValue }).eq('id', item.id).eq('trip_id', mutation.tripId);
      if (moved.error) throw moved.error;
    }
    return;
  }

  if (mutation.type === 'save-inline-activity') {
    const savedDay = await client
      .from('trip_days')
      .update(dayPatchForRemote(mutation.dayPatch || {}, orderedSchema))
      .eq('id', mutation.dayId);
    if (savedDay.error) throw savedDay.error;

    if (mutation.location) {
      const savedLocation = await client.from('day_locations').upsert(locationForRemote(mutation.location));
      if (savedLocation.error) throw savedLocation.error;
    }

    if (mutation.activity) {
      const day = state.tripDays.find(item => String(item.id) === String(mutation.dayId)) || null;
      const savedActivity = await client
        .from('activities')
        .upsert(activityForRemote(mutation.activity, orderedSchema, day));
      if (savedActivity.error) throw savedActivity.error;
    }
    return;
  }

  if (mutation.type !== 'save-day' && mutation.type !== 'save-day-patch' && mutation.type !== 'save-day-items') return;
  if (mutation.type !== 'save-day-items') {
    const savedDay = await client
      .from('trip_days')
      .update(dayPatchForRemote(mutation.dayPatch || {}, orderedSchema))
      .eq('id', mutation.dayId);
    if (savedDay.error) throw savedDay.error;
  }
  if (mutation.type === 'save-day-patch') return;

  // Older queued edits include the whole day and repeat large photos. Preserve
  // every edit and snapshot, but upload only rows changed since the last edit.
  const locations = (mutation.locations || []).filter(location =>
    recordsDiffer(location, previousDay?.locations.get(String(location.id))));
  const activities = (mutation.activities || []).filter(activity =>
    recordsDiffer(activity, previousDay?.activities.get(String(activity.id))));

  if (locations.length) {
    const savedLocations = await client.from('day_locations').upsert(locations.map(locationForRemote));
    if (savedLocations.error) throw savedLocations.error;
  }

  if (activities.length) {
    const day = state.tripDays.find(item => String(item.id) === String(mutation.dayId)) || null;
    const remoteActivities = activities.map(activity => activityForRemote(activity, orderedSchema, day));
    const savedActivities = await client.from('activities').upsert(remoteActivities);
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

function rememberSyncedDayMutation(map, mutation) {
  const dayId = String(mutation.dayId || '');
  if (!dayId || !['save-day', 'save-day-items', 'save-inline-activity'].includes(mutation.type)) return;

  let previous = map.get(dayId);
  if (!previous && mutation.type === 'save-day' && !mutation.partialDay) {
    previous = { activities: new Map(), locations: new Map() };
    map.set(dayId, previous);
  }
  if (!previous) return;

  if (mutation.type === 'save-day' && !mutation.partialDay) {
    previous.activities = new Map((mutation.activities || []).map(item => [String(item.id), item]));
    previous.locations = new Map((mutation.locations || []).map(item => [String(item.id), item]));
  } else if (mutation.type === 'save-inline-activity') {
    if (mutation.activity) previous.activities.set(String(mutation.activity.id), mutation.activity);
    if (mutation.location) previous.locations.set(String(mutation.location.id), mutation.location);
  } else {
    for (const item of mutation.activities || []) previous.activities.set(String(item.id), item);
    for (const item of mutation.locations || []) previous.locations.set(String(item.id), item);
  }
  for (const id of mutation.removedActivityIds || []) previous.activities.delete(String(id));
  for (const id of mutation.removedLocationIds || []) previous.locations.delete(String(id));
}

async function flushOutbox() {
  if (outboxFlushPromise) return outboxFlushPromise;

  outboxFlushPromise = (async () => {
    if (!navigator.onLine || !state.user) {
      await refreshSyncStatus();
      return false;
    }
    if (!await trySupabase()) {
      lastOutboxError = new Error('Não foi possível conectar ao Supabase.');
      await refreshSyncStatus();
      return false;
    }

    const droppedColorLogs = await offlineStore.compactPendingColorHistory();
    if (droppedColorLogs.length) {
      const droppedIds = new Set(droppedColorLogs);
      state.changeLog = state.changeLog.filter(entry => !droppedIds.has(entry.id));
      if (document.body.dataset.activeSheet === 'change-log') renderChangeLog(state.changeLog);
    }
    const syncedDays = new Map();
    outboxSyncing = true;
    await refreshSyncStatus();
    try {
      while (true) {
        const [mutation] = await offlineStore.listOutbox();
        if (!mutation) return true;
        try {
          await syncMutation(mutation, syncedDays.get(String(mutation.dayId)));
          rememberSyncedDayMutation(syncedDays, mutation);
          await offlineStore.removeMutation(mutation.id);
          lastOutboxError = null;
          await refreshSyncStatus();
        } catch (error) {
          lastOutboxError = error;
          console.warn('Sincronização pendente', error);
          return false;
        }
      }
    } finally {
      outboxSyncing = false;
      await refreshSyncStatus();
    }
  })();

  try {
    return await outboxFlushPromise;
  } finally {
    outboxFlushPromise = null;
  }
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
  if (!canEditActiveTrip()) return;
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
      const previous = previousActivityById.get(String(activity.id));
      const previousPlacePhoto = previous && activityLocation(previous, previousLocations)?.photo_url;
      const ownPhoto = previous?.photo_url && previous.photo_url !== previousPlacePhoto
        ? previous.photo_url : null;
      return {
        ...(previous || {}),
        id: activity.id,
        day_id: editor.day.id,
        period: periodFromTime(activity.time),
        position,
        title: activity.text.trim(),
        start_time: `${activity.time || '09:00'}:00`,
        place_id: activity.locationId || null,
        place_name: location?.name.trim() || null,
        address: location?.formattedAddress || null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        photo_url: ownPhoto
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
      partialDay: true,
      tripId: String(editor.day.trip_id || state.activeTripId),
      dayId: editor.day.id,
      dayPatch,
      locations: locations.filter(location => recordsDiffer(location, previousLocationById.get(String(location.id)))),
      activities: activities.filter(activity => recordsDiffer(activity, previousActivityById.get(String(activity.id)))),
      removedLocationIds,
      removedActivityIds
    });
    await refreshSyncStatus();

    applyLocalDaySave(localDay, activities, locations);
    await recordChange({
      tripId: editor.day.trip_id || state.activeTripId,
      entityType: 'trip_day',
      entityId: editor.day.id,
      action: 'update',
      summary: 'Dia ' + dayNumber(editor.day) + ' alterado no editor completo',
      beforeState: {
        title: editor.day.title || null,
        activities: previousActivities.length,
        locations: previousLocations.length
      },
      afterState: {
        title: localDay.title || null,
        activities: activities.length,
        locations: locations.length
      }
    });

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

// Large inline photos can time out one trip-wide API response. Only replace
// the offline copy once every smaller batch has completed successfully.
async function loadDayRecords(client, dayIds) {
  const activities = [], locations = [];
  for (let index = 0; index < dayIds.length; index += 1) {
    const ids = dayIds.slice(index, index + 1);
    const [activityResult, locationResult] = await Promise.all([
      client.from('activities').select('*').in('day_id', ids).order('position'),
      client.from('day_locations').select('*').in('day_id', ids).order('position')
    ]);
    if (activityResult.error || locationResult.error) throw activityResult.error || locationResult.error;
    activities.push(...(activityResult.data || []).map(normalizeActivityRecord));
    locations.push(...(locationResult.data || []));
  }
  return { activities, locations };
}

function applyTripData(data) {
  const days = (data.days || []).map(normalizeDayRecord).sort((a, b) => dayPosition(a) - dayPosition(b));
  const activitiesByDay = new Map();
  for (const [dayId, activities] of (data.activitiesByDay || new Map())) {
    activitiesByDay.set(String(dayId), (activities || []).map(normalizeActivityRecord));
  }
  const locationsByDay = data.locationsByDay || new Map();

  state.tripDays = days;
  state.dayActivities = activitiesByDay;
  state.dayLocations = locationsByDay;
  state.activeTripDataVersion = data.version;
  renderTripDays(days, activitiesByDay, locationsByDay);
}

async function fetchTripData(tripId, { preferLocal = false } = {}) {
  const key = String(tripId);
  if (preferLocal) {
    const local = await offlineStore.loadTripData(key);
    if (local.days.length) {
      return {
        days: local.days,
        activitiesByDay: groupByDay(local.activities),
        locationsByDay: groupByDay(local.locations),
        loadedAt: 0,
        version: Date.now(),
        offline: true,
        stale: true
      };
    }
    return null;
  }
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
      const orderedSchema = await supportsOrderedDaySchema(client);
      const result = await client.from('trip_days').select('*').eq('trip_id', tripId).order(orderedSchema ? 'position' : 'day_number');
      if (result.error) throw result.error;
      const days = (result.data || []).map(normalizeDayRecord);
      let activities = [], locations = [];
      if (days.length) {
        ({ activities, locations } = await loadDayRecords(client, days.map(day => day.id)));
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

async function ensureTripBaselineSnapshot(tripId) {
  const key = String(tripId);
  if (!key || state.baselineSnapshotsEnsured.has(key) || !navigator.onLine) return null;

  const synced = await flushOutbox();
  if (!synced) return null;

  const client = await trySupabase();
  if (!client) return null;

  const result = await client.rpc('ensure_trip_baseline_snapshot', {
    p_trip_id: tripId
  });
  if (result.error) throw result.error;

  state.baselineSnapshotsEnsured.add(key);
  return result.data || null;
}

function syncTripHero(trip) {
  const editable = canEditTrip(trip);
  dom.tripPageTitle.disabled = !editable;
  dom.tripPageDuration.disabled = !editable;
  dom.tripPageDates.disabled = !editable;
  dom.tripPageColor.disabled = !editable;
  dom.tripPageCoverInput.disabled = !editable;
  const accent = tripColorDraft?.tripId === String(trip.id)
    ? tripColorDraft.color
    : /^#[0-9a-f]{6}$/i.test(trip.secondary_color || '') ? trip.secondary_color : '#4775d1';
  dom.tripPage.style.setProperty('--trip-page-color', accent);
  dom.tripPageHero.style.backgroundImage = trip.cover_url ? `url("${trip.cover_url.replaceAll('"', '%22')}")` : '';
  dom.tripPageTitle.textContent = trip.name;
  dom.tripPageDuration.textContent = `${tripDayCount(trip)} ${tripDayCount(trip) === 1 ? 'dia' : 'dias'}`;
  dom.tripPageDates.textContent = `${displayDate(trip.start_date)} — ${displayDate(tripEndDate(trip))}`;
  dom.tripPageColor.value = accent;
  dom.tripPageColor.parentElement.style.setProperty('--trip-control-color', accent);
  dom.tripPagePassengers._count = dom.tripPagePassengerCount;
  syncPassengerList(dom.tripPagePassengers, state.passengers.get(trip.id) || []);
}

function selectTripTab(name, { reset = false } = {}) {
  if (!dom.tripPanels[name] || !state.activeTripId) return;
  const key = String(state.activeTripId);
  if (!reset && name === state.activeTripTab) return;
  const order = ['roteiro', 'orcamento', 'arquivos'];
  const previous = order.indexOf(state.activeTripTab);
  const next = order.indexOf(name);
  if (!reset) state.tripTabScroll.set(`${key}:${state.activeTripTab}`, dom.tripPage.scrollTop);
  state.activeTripTab = name;
  dom.tripTabs.style.setProperty('--active-index', String(next));
  for (const [tab, panel] of Object.entries(dom.tripPanels)) {
    panel.hidden = tab !== name;
    panel.dataset.enter = reset || tab !== name ? '' : next > previous ? 'next' : 'previous';
    const button = document.querySelector(`#trip_tab_${tab}`);
    button.setAttribute('aria-selected', String(tab === name));
    button.tabIndex = tab === name ? 0 : -1;
  }
  requestAnimationFrame(() => {
    if (state.activeTripId !== key || state.activeTripTab !== name) return;
    dom.tripPage.scrollTop = reset ? 0 : state.tripTabScroll.get(`${key}:${name}`) ?? dom.tripPageHero.offsetHeight;
  });
  if (name === 'orcamento') loadTripBudget(key).catch(error => setTripPanelStatus(dom.budgetStatus, error.message, 'error'));
  if (name === 'arquivos') loadTripFiles(key).catch(error => setTripPanelStatus(dom.tripFilesStatus, error.message, 'error'));
}

function setTripPanelStatus(node, message = '', kind = 'info') {
  node.dataset.kind = kind;
  node.textContent = message;
}

function tripMoney(value, currency) {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value) || 0); }
  catch { return `${currency} ${(Number(value) || 0).toFixed(2)}`; }
}

function amountFromInput(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Informe um valor válido, com até duas casas decimais.');
  return Number(normalized);
}

const budgetToggleJobs = new Map();
const budgetToggleErrors = new Map();
const budgetToggleRevisions = new Map();
let budgetToggleRevision = 0;

function summarizeTripBudget(items) {
  const totals = new Map();
  for (const item of items) {
    const currency = item.currency || 'BRL';
    const current = totals.get(currency) || { planned: 0, paid: 0, toBuy: 0, paidEstimate: false };
    current.planned += Number(item.planned_amount) || 0;
    if (item.purchase_status === 'purchased') {
      current.paid += Number(item.actual_amount ?? item.planned_amount) || 0;
      if (item.actual_amount == null && item.planned_amount != null) current.paidEstimate = true;
    }
    else current.toBuy += Number(item.planned_amount) || 0;
    totals.set(currency, current);
  }
  return totals;
}

function renderTripBudget(tripId) {
  if (String(state.activeTripId) !== String(tripId)) return;
  const items = state.budgetByTrip.get(String(tripId)) || [];
  const totals = summarizeTripBudget(items);
  dom.budgetSummary.replaceChildren();
  for (const [currency, amounts] of totals) {
    for (const [label, value] of [['Previsto', amounts.planned], [amounts.paidEstimate ? 'Pago · inclui estimativas' : 'Pago', amounts.paid], ['Ainda previsto', amounts.toBuy]]) {
      const card = document.createElement('div'); card.className = 'budget-summary-card';
      const caption = document.createElement('small'); caption.textContent = `${label} · ${currency}`;
      const money = document.createElement('strong'); money.textContent = tripMoney(value, currency);
      card.append(caption, money); dom.budgetSummary.append(card);
    }
  }
  dom.budgetList.replaceChildren();
  const categories = new Map();
  for (const item of items) {
    const name = item.category?.trim() || 'Outros gastos';
    if (!categories.has(name)) categories.set(name, []);
    categories.get(name).push(item);
  }
  for (const [name, entries] of categories) {
    const group = document.createElement('section'); group.className = 'budget-group';
    const heading = document.createElement('h3'); heading.textContent = name;
    const list = document.createElement('div'); list.className = 'budget-group-list';
    for (const item of entries) {
      const editable = canEditActiveTrip();
      const row = document.createElement('div');
      row.className = 'budget-item';
      const purchased = item.purchase_status === 'purchased';
      const toggleKey = `${tripId}:${item.id}`;
      const check = document.createElement(editable ? 'button' : 'span');
      check.className = 'budget-item-check';
      check.dataset.checked = String(purchased);
      const circle = document.createElement('span'); circle.className = 'budget-item-check-circle';
      circle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>';
      check.append(circle);
      if (editable) {
        check.type = 'button';
        check.setAttribute('role', 'checkbox');
        check.setAttribute('aria-checked', String(purchased));
        check.setAttribute('aria-label', `${item.label}: ${purchased ? 'pago' : 'pendente'}. Alternar pagamento`);
        check.dataset.saving = String(budgetToggleJobs.has(toggleKey));
        check.addEventListener('click', () => toggleBudgetItem(tripId, item.id));
      } else check.setAttribute('aria-hidden', 'true');
      const detail = document.createElement(editable ? 'button' : 'div');
      detail.className = 'budget-item-detail';
      if (editable) { detail.type = 'button'; detail.addEventListener('click', () => openBudgetEditor(item)); }
      const main = document.createElement('span'); main.className = 'budget-item-main';
      const title = document.createElement('strong'); title.textContent = item.label;
      const meta = document.createElement('span'); meta.className = 'budget-item-meta';
      meta.dataset.purchased = String(purchased);
      meta.dataset.error = String(budgetToggleErrors.has(toggleKey));
      meta.textContent = budgetToggleErrors.has(toggleKey) ? 'Não foi possível salvar · tente de novo' : purchased
        ? item.actual_amount != null ? 'Pago' : item.planned_amount != null ? 'Pago · valor previsto' : 'Pago · sem valor informado'
        : item.planned_amount != null ? 'A comprar · previsto' : 'A comprar · sem valor previsto';
      main.append(title, meta);
      const right = document.createElement('span'); right.className = 'budget-item-right';
      const amount = purchased && item.actual_amount != null ? item.actual_amount : item.planned_amount;
      const value = document.createElement('span'); value.className = 'budget-item-value';
      value.textContent = amount == null ? '—' : tripMoney(amount, item.currency || 'BRL');
      right.append(value);
      if (editable) {
        const chevron = document.createElement('span'); chevron.className = 'budget-item-chevron';
        chevron.setAttribute('aria-hidden', 'true'); right.append(chevron);
      }
      detail.append(main, right); row.append(check, detail); list.append(row);
    }
    group.append(heading, list);
    dom.budgetList.append(group);
  }
  if (!items.length) {
    const empty = document.createElement('p'); empty.className = 'trip-files-empty';
    empty.textContent = 'Nenhum gasto planejado ainda.'; dom.budgetList.append(empty);
  }
}

async function loadTripBudget(tripId) {
  const key = String(tripId);
  if (state.activeTripId !== key) return;
  const revisionAtStart = budgetToggleRevision;
  if (state.budgetByTrip.has(key)) renderTripBudget(key);
  setTripPanelStatus(dom.budgetStatus, 'Atualizando orçamento…');
  const client = await trySupabase(5000);
  if (!client) {
    setTripPanelStatus(dom.budgetStatus, state.budgetByTrip.has(key) ? 'Mostrando a última consulta deste acesso.' : 'Conecte-se para consultar o orçamento.');
    return;
  }
  const { data, error } = await client.from('budget_items').select('*').eq('trip_id', key).order('category');
  if (error) throw error;
  const local = new Map((state.budgetByTrip.get(key) || []).map(item => [String(item.id), item]));
  state.budgetByTrip.set(key, (data || []).map(item => budgetToggleJobs.has(`${key}:${item.id}`) || (budgetToggleRevisions.get(`${key}:${item.id}`) || 0) > revisionAtStart
    ? { ...item, purchase_status: local.get(String(item.id))?.purchase_status ?? item.purchase_status }
    : item));
  for (const item of data || []) {
    const itemKey = `${key}:${item.id}`;
    if (!budgetToggleJobs.has(itemKey)) budgetToggleErrors.delete(itemKey);
  }
  if (state.activeTripId === key) {
    renderTripBudget(key);
    setTripPanelStatus(dom.budgetStatus);
  }
}

function replaceBudgetItem(tripId, itemId, patch) {
  const items = state.budgetByTrip.get(tripId) || [];
  state.budgetByTrip.set(tripId, items.map(item => String(item.id) === String(itemId) ? { ...item, ...patch } : item));
  if (state.activeTripId === tripId) renderTripBudget(tripId);
}

function scheduleBudgetToggle(job, delay = 300) {
  clearTimeout(job.timer);
  job.timer = setTimeout(() => {
    job.timer = null;
    persistBudgetToggle(job).catch(console.warn);
  }, delay);
}

function toggleBudgetItem(tripId, itemId) {
  if (String(state.activeTripId) !== String(tripId) || !canEditActiveTrip()) return;
  const current = (state.budgetByTrip.get(tripId) || []).find(item => String(item.id) === String(itemId));
  if (!current) return;
  const key = `${tripId}:${itemId}`;
  const job = budgetToggleJobs.get(key) || { key, tripId, itemId, saved: current, desired: current.purchase_status, timer: null, inFlight: null };
  budgetToggleJobs.set(key, job);
  budgetToggleErrors.delete(key);
  budgetToggleRevisions.set(key, ++budgetToggleRevision);
  job.desired = current.purchase_status === 'purchased' ? 'pending' : 'purchased';
  replaceBudgetItem(tripId, itemId, { purchase_status: job.desired });
  setTripPanelStatus(dom.budgetStatus);
  scheduleBudgetToggle(job);
}

async function persistBudgetToggle(job) {
  if (job.inFlight) return job.inFlight;
  if (job.timer) { clearTimeout(job.timer); job.timer = null; }
  if (job.desired === job.saved.purchase_status) {
    budgetToggleJobs.delete(job.key);
    if (state.activeTripId === job.tripId) renderTripBudget(job.tripId);
    return;
  }
  const before = job.saved;
  const status = job.desired;
  job.inFlight = (async () => {
    try {
      const client = await trySupabase(5000);
      if (!client) throw new Error('Conecte-se para salvar o orçamento.');
      const { data, error } = await client.from('budget_items').update({ purchase_status: status })
        .eq('id', job.itemId).eq('trip_id', job.tripId).select('*').single();
      if (error) throw error;
      job.saved = data;
      recordChange({ tripId: job.tripId, entityType: 'budget_item', entityId: job.itemId,
        action: 'update', summary: `Orçamento: ${data.label} ${status === 'purchased' ? 'marcado como pago' : 'marcado como pendente'}`,
        beforeState: before, afterState: data }).catch(console.warn);
    } catch (error) {
      job.desired = job.saved.purchase_status;
      budgetToggleErrors.set(job.key, error.message || 'Não foi possível salvar.');
      replaceBudgetItem(job.tripId, job.itemId, { purchase_status: job.saved.purchase_status });
      if (state.activeTripId === job.tripId) setTripPanelStatus(dom.budgetStatus, error.message || 'Não foi possível salvar.', 'error');
    } finally {
      job.inFlight = null;
      if (!job.timer) {
        if (job.desired !== job.saved.purchase_status) scheduleBudgetToggle(job, 0);
        else {
          budgetToggleJobs.delete(job.key);
          if (state.activeTripId === job.tripId) renderTripBudget(job.tripId);
        }
      }
    }
  })();
  return job.inFlight;
}

async function flushBudgetToggle(tripId, itemId) {
  const key = `${tripId}:${itemId}`;
  while (budgetToggleJobs.has(key)) {
    const job = budgetToggleJobs.get(key);
    if (job.timer) { clearTimeout(job.timer); job.timer = null; }
    await persistBudgetToggle(job);
  }
}

let budgetPageBackPending = false;

function closeBudgetPage() {
  budgetPageBackPending = false;
  dom.budgetPage.inert = true;
  dom.budgetPage.setAttribute('aria-hidden', 'true');
  document.body.dataset.budgetPage = 'closed';
  dom.tripPage.inert = false;
  if (state.activeTripId && document.body.dataset.dayPage === 'closed') {
    dom.tripTabs.inert = false;
    dom.tripTabs.setAttribute('aria-hidden', 'false');
  }
}

function navigateBackFromBudget() {
  if (budgetPageBackPending) return;
  if (window.history.state?.view === 'budget-item') {
    budgetPageBackPending = true;
    window.history.back();
  }
  else closeBudgetPage();
}

function openBudgetEditor(item = null, { pushHistory = true } = {}) {
  if (!canEditActiveTrip()) return;
  budgetPageBackPending = false;
  const box = dom.budgetEditor;
  box.replaceChildren();
  dom.budgetPageTitle.textContent = item ? 'Editar gasto' : 'Novo gasto';
  dom.budgetPageMessage.textContent = '';
  const form = document.createElement('form');
  form.innerHTML = `<label>Descrição<input name="label" maxlength="180" required autocomplete="off"></label>
    <label>Categoria<input name="category" maxlength="100" autocomplete="off" placeholder="Ex.: Transporte"></label>
    <div class="budget-editor-fields"><label>Moeda<input name="currency" maxlength="3" required autocapitalize="characters"></label>
    <label>Situação<select name="purchase_status"><option value="pending">A comprar</option><option value="purchased">Pago</option></select></label>
    <label>Previsto<input name="planned_amount" inputmode="decimal" placeholder="0,00"></label>
    <label>Pago<input name="actual_amount" inputmode="decimal" placeholder="0,00"></label></div>
    <div class="budget-editor-actions"><button type="submit">Salvar</button><button type="button" data-action="cancel">Cancelar</button>${item ? '<button type="button" data-action="delete">Excluir</button>' : ''}</div>`;
  const input = field => form.elements.namedItem(field);
  input('label').value = item?.label || '';
  input('category').value = item?.category || '';
  input('currency').value = item?.currency || 'BRL';
  input('purchase_status').value = item?.purchase_status === 'purchased' ? 'purchased' : 'pending';
  input('planned_amount').value = item?.planned_amount ?? '';
  input('actual_amount').value = item?.actual_amount ?? '';
  form.addEventListener('submit', event => saveBudgetEditor(event, item));
  form.querySelector('[data-action="cancel"]').addEventListener('click', navigateBackFromBudget);
  form.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteBudgetItem(item));
  box.append(form);
  if (pushHistory) window.history.pushState({ view: 'budget-item', tripId: String(state.activeTripId), itemId: item?.id || null }, '', `#budget-${item?.id || 'new'}`);
  dom.tripTabs.inert = true;
  dom.tripTabs.setAttribute('aria-hidden', 'true');
  dom.tripPage.inert = true;
  dom.budgetPage.inert = false;
  dom.budgetPage.setAttribute('aria-hidden', 'false');
  dom.budgetPage.scrollTop = 0;
  document.body.dataset.budgetPage = 'open';
  dom.closeBudgetPage.focus({ preventScroll: true });
}

async function saveBudgetEditor(event, existing) {
  event.preventDefault();
  if (!canEditActiveTrip()) return;
  const tripId = String(state.activeTripId);
  const form = event.currentTarget;
  const value = field => form.elements.namedItem(field).value.trim();
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const currency = value('currency').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Use uma moeda de três letras, como BRL ou EUR.');
    const payload = { trip_id: tripId, label: value('label'), category: value('category') || null,
      currency, purchase_status: value('purchase_status'),
      planned_amount: amountFromInput(value('planned_amount')),
      actual_amount: amountFromInput(value('actual_amount')) };
    if (!payload.label) throw new Error('Informe a descrição do gasto.');
    if (existing) await flushBudgetToggle(tripId, existing.id);
    const client = await trySupabase(5000);
    if (!client) throw new Error('É necessária uma conexão para salvar o orçamento.');
    const result = existing
      ? await client.from('budget_items').update(payload).eq('id', existing.id).eq('trip_id', tripId).select('*').single()
      : await client.from('budget_items').insert(payload).select('*').single();
    if (result.error) throw result.error;
    if (state.activeTripId !== tripId) return;
    navigateBackFromBudget();
    setTripPanelStatus(dom.budgetStatus, 'Gasto salvo.');
    const items = state.budgetByTrip.get(tripId) || [];
    state.budgetByTrip.set(tripId, existing ? items.map(row => row.id === existing.id ? result.data : row) : [...items, result.data]);
    budgetToggleErrors.delete(`${tripId}:${result.data.id}`);
    renderTripBudget(tripId);
    recordChange({ tripId, entityType: 'budget_item', entityId: result.data.id,
      action: existing ? 'update' : 'create', summary: `Orçamento: ${payload.label}`,
      beforeState: existing || null, afterState: result.data }).catch(console.warn);
  } catch (error) {
    setTripPanelStatus(dom.budgetStatus, error.message || 'Não foi possível salvar.', 'error');
    dom.budgetPageMessage.textContent = error.message || 'Não foi possível salvar.';
    submit.disabled = false;
  }
}

async function deleteBudgetItem(item) {
  if (!canEditActiveTrip() || !window.confirm(`Excluir “${item.label}” do orçamento?`)) return;
  const tripId = String(state.activeTripId);
  await flushBudgetToggle(tripId, item.id);
  const client = await trySupabase(5000);
  if (!client) { setTripPanelStatus(dom.budgetStatus, 'Conecte-se para excluir.', 'error'); dom.budgetPageMessage.textContent = 'Conecte-se para excluir.'; return; }
  const { error } = await client.from('budget_items').delete().eq('id', item.id).eq('trip_id', tripId);
  if (error) { setTripPanelStatus(dom.budgetStatus, error.message, 'error'); dom.budgetPageMessage.textContent = error.message; return; }
  state.budgetByTrip.set(tripId, (state.budgetByTrip.get(tripId) || []).filter(row => row.id !== item.id));
  budgetToggleErrors.delete(`${tripId}:${item.id}`);
  if (state.activeTripId === tripId) {
    navigateBackFromBudget();
    renderTripBudget(tripId); setTripPanelStatus(dom.budgetStatus, 'Gasto excluído.');
  }
  recordChange({ tripId, entityType: 'budget_item', entityId: item.id, action: 'delete', summary: `Orçamento: ${item.label} excluído`, beforeState: item }).catch(console.warn);
}

function tripFileSize(file) {
  const kilobytes = (file.size_bytes || 0) / 1024;
  return kilobytes < 1024 ? Math.max(1, Math.round(kilobytes)) + ' KB'
    : (kilobytes / 1024).toFixed(1) + ' MB';
}

let tripFileViewerState = null;
let tripFileViewerBlobUrl = null;
let tripFileViewerLoad = 0;
let tripFileViewerCloseTimer = null;
let tripFileViewerLeavingView = null;

function clearTripFileViewerMedia() {
  tripFileViewerLoad += 1;
  dom.tripFileViewerMedia.replaceChildren();
  if (tripFileViewerBlobUrl) URL.revokeObjectURL(tripFileViewerBlobUrl);
  tripFileViewerBlobUrl = null;
}

async function fetchTripFileBlob(file) {
  if (!file.signedUrl) throw new Error('Conecte-se para visualizar este arquivo.');
  const response = await fetch(file.signedUrl);
  if (!response.ok) throw new Error('Não foi possível carregar o arquivo. Tente novamente.');
  return response.blob();
}

function showTripFileViewerFallback(file) {
  const fallback = document.createElement('div');
  fallback.className = 'trip-file-viewer-fallback';
  const symbol = document.createElement('strong');
  symbol.textContent = 'DOC';
  const message = document.createElement('p');
  message.textContent = 'Documentos Word não têm prévia no navegador. Você pode salvá-los para abrir em outro aplicativo.';
  fallback.append(symbol, message);
  if (file.signedUrl) {
    const download = document.createElement('button');
    download.type = 'button';
    download.textContent = 'Salvar documento';
    download.addEventListener('click', async () => {
      download.disabled = true;
      try {
        const blob = await fetchTripFileBlob(file);
        if (!dom.tripFileViewer.open || tripFileViewerState?.entries[tripFileViewerState.index]?.id !== file.id) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = file.file_name;
        dom.tripFileViewerMedia.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) { dom.tripFileViewerStatus.textContent = error.message; }
      finally { download.disabled = false; }
    });
    fallback.append(download);
  }
  dom.tripFileViewerMedia.append(fallback);
}

function showTripFileViewerIndex(index, { syncHistory = true } = {}) {
  if (!tripFileViewerState) return;
  const { entries } = tripFileViewerState;
  tripFileViewerState.index = Math.max(0, Math.min(index, entries.length - 1));
  const file = entries[tripFileViewerState.index];
  clearTripFileViewerMedia();
  dom.tripFileViewerTitle.textContent = file.mime_type?.startsWith('image/') ? 'Foto' : file.file_name;
  dom.tripFileViewerStatus.textContent = tripFileSize(file);
  dom.tripFileViewerDelete.hidden = !canEditActiveTrip();
  dom.tripFileViewerDelete.disabled = false;
  dom.tripFileViewerPosition.textContent = `${tripFileViewerState.index + 1} de ${entries.length}`;
  dom.tripFileViewerPrevious.parentElement.hidden = entries.length < 2;
  dom.tripFileViewerPrevious.disabled = tripFileViewerState.index === 0;
  dom.tripFileViewerNext.disabled = tripFileViewerState.index === entries.length - 1;
  if (syncHistory && window.history.state?.view === 'trip-file') {
    window.history.replaceState({ ...window.history.state, fileId: file.id }, '', `#file-${file.id}`);
  }
  if (!file.signedUrl) {
    dom.tripFileViewerStatus.textContent = 'Conecte-se para visualizar este arquivo.';
    return;
  }
  if (file.mime_type?.startsWith('image/')) {
    const image = document.createElement('img');
    image.alt = 'Foto';
    image.onerror = () => { dom.tripFileViewerStatus.textContent = 'Não foi possível carregar a imagem.'; };
    image.src = file.signedUrl;
    dom.tripFileViewerMedia.append(image);
  } else if (file.mime_type === 'application/pdf') {
    dom.tripFileViewerStatus.textContent = 'Carregando PDF…';
    const loading = document.createElement('div');
    loading.className = 'trip-file-viewer-fallback';
    loading.textContent = 'Abrindo PDF…';
    dom.tripFileViewerMedia.append(loading);
    const load = tripFileViewerLoad;
    fetchTripFileBlob(file).then(blob => {
      if (load !== tripFileViewerLoad || !dom.tripFileViewer.open) return;
      tripFileViewerBlobUrl = URL.createObjectURL(blob);
      const frame = document.createElement('iframe');
      frame.title = file.file_name;
      frame.src = tripFileViewerBlobUrl;
      dom.tripFileViewerMedia.replaceChildren(frame);
      dom.tripFileViewerStatus.textContent = tripFileSize(file);
    }).catch(error => {
      if (load === tripFileViewerLoad) dom.tripFileViewerStatus.textContent = error.message;
    });
  } else showTripFileViewerFallback(file);
}

function openTripFileViewer(file, entries = [file], { pushHistory = true } = {}) {
  if (!file || !entries.length) return;
  if (!dom.tripFileViewer) {
    setTripPanelStatus(dom.tripFilesStatus, 'Atualize o aplicativo para visualizar este arquivo.', 'error');
    return;
  }
  window.clearTimeout(tripFileViewerCloseTimer);
  const focus = dom.tripFileViewer.open ? tripFileViewerState?.focus : document.activeElement;
  const originView = state.activeDayId && document.body.dataset.dayPage === 'open' ? 'day' : 'trip';
  tripFileViewerLeavingView = null;
  tripFileViewerState = {
    entries: [...entries], index: Math.max(0, entries.findIndex(item => String(item.id) === String(file.id))), focus, originView
  };
  if (pushHistory) {
    window.history.pushState({ view: 'trip-file', tripId: String(state.activeTripId), dayId: file.day_id || null, fileId: file.id, originView }, '', `#file-${file.id}`);
  }
  if (!dom.tripFileViewer.open) dom.tripFileViewer.showModal();
  showTripFileViewerIndex(tripFileViewerState.index, { syncHistory: false });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (dom.tripFileViewer.open && tripFileViewerState) dom.tripFileViewer.dataset.visible = 'true';
  }));
  dom.closeTripFileViewer.focus({ preventScroll: true });
}

function closeTripFileViewer({ immediate = false } = {}) {
  if (!dom.tripFileViewer?.open) return;
  if (!tripFileViewerState && !immediate) return;
  window.clearTimeout(tripFileViewerCloseTimer);
  const focus = tripFileViewerState?.focus;
  tripFileViewerLeavingView = tripFileViewerState?.originView || tripFileViewerLeavingView;
  tripFileViewerState = null;
  tripFileViewerLoad += 1;
  dom.tripFileViewer.dataset.visible = 'false';
  const finish = () => {
    if (tripFileViewerState) return;
    dom.tripFileViewer.close();
    clearTripFileViewerMedia();
    tripFileViewerLeavingView = null;
    if (focus?.isConnected) focus.focus({ preventScroll: true });
  };
  if (immediate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish();
  else tripFileViewerCloseTimer = window.setTimeout(finish, 260);
}

function navigateBackFromTripFileViewer() {
  const hasHistory = window.history.state?.view === 'trip-file';
  closeTripFileViewer();
  if (hasHistory) window.history.back();
}

async function restoreTripFileViewer(entry) {
  const tripId = String(entry.tripId);
  if (state.activeTripId !== tripId) {
    closeTripFileViewer({ immediate: true });
    await openTrip(tripId, { pushHistory: false });
  }
  if (state.activeTripId !== tripId) return;
  if (entry.originView === 'day' && entry.dayId) {
    if (state.activeDayId !== String(entry.dayId)) openDayPage(entry.dayId, { pushHistory: false });
    if (!state.dayAttachments.has(String(entry.dayId))) await loadDayAttachments(entry.dayId);
  } else {
    if (state.activeDayId) closeDayPage();
    if (state.activeTripTab !== 'arquivos') selectTripTab('arquivos');
    if (!state.tripFilesByTrip.has(tripId)) await loadTripFiles(tripId);
  }
  if (window.history.state?.view !== 'trip-file' || String(window.history.state.fileId) !== String(entry.fileId)) return;
  const rows = entry.originView === 'day' && entry.dayId
    ? state.dayAttachments.get(String(entry.dayId)) || [] : state.tripFilesByTrip.get(tripId) || [];
  const entries = rows.filter(item => entry.dayId
    ? String(item.day_id) === String(entry.dayId) : !item.day_id);
  const file = entries.find(item => String(item.id) === String(entry.fileId));
  if (file) openTripFileViewer(file, entries, { pushHistory: false });
  else window.history.back();
}

async function deleteTripFileViewer() {
  const file = tripFileViewerState?.entries[tripFileViewerState.index];
  if (!file || !canEditActiveTrip()) return;
  dom.tripFileViewerDelete.disabled = true;
  try {
    const result = await removeDayAttachment(file);
    if (result === true) navigateBackFromTripFileViewer();
    else if (result === false) dom.tripFileViewerStatus.textContent = 'Não foi possível excluir este arquivo.';
  } catch (error) { dom.tripFileViewerStatus.textContent = error.message || 'Não foi possível excluir este arquivo.'; }
  finally { dom.tripFileViewerDelete.disabled = false; }
}

function renderTripFileDeck(tripId, day, entries) {
  const label = day ? `Dia ${dayNumber(day)} · ${day.title || displayDate(derivedDayDate(day))}`
    : 'Arquivos da viagem';
  const group = document.createElement('section');
  group.className = day ? 'trip-files-group' : 'trip-files-group trip-files-general';
  const heading = document.createElement('div');
  heading.className = 'trip-files-group-heading';
  const title = document.createElement(day ? 'button' : 'h3');
  title.className = 'trip-files-day'; title.textContent = label;
  if (day) {
    title.type = 'button';
    title.addEventListener('click', () => openDayPage(day.id));
  }
  const count = document.createElement('span');
  count.className = 'trip-files-group-count';
  count.textContent = `${entries.length} ${entries.length === 1 ? 'arquivo' : 'arquivos'}`;
  heading.append(title, count);

  const deck = document.createElement('div');
  deck.className = 'trip-files-deck';
  deck.tabIndex = 0;
  deck.setAttribute('aria-label', entries.length > 1 ? `${label}. Deslize para ver os arquivos.` : label);
  const previews = [];
  const cards = entries.map((file, index) => {
    const card = document.createElement('article');
    card.className = 'trip-file-card';
    card.dataset.kind = file.mime_type?.startsWith('image/') ? 'image' : 'document';
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'trip-file-card-link';
    link.setAttribute('aria-label', card.dataset.kind === 'image'
      ? `Visualizar foto ${index + 1} de ${entries.length}` : `Visualizar ${file.file_name}`);
    link.addEventListener('click', () => openTripFileViewer(file, entries));
    const visual = document.createElement('span');
    visual.className = 'trip-file-card-visual';
    let image = null;
    if (card.dataset.kind === 'image' && file.signedUrl) {
      image = document.createElement('img');
      image.alt = '';
      image.decoding = 'async';
      image.onerror = () => { image.remove(); visual.textContent = 'FOTO'; };
      visual.append(image);
    } else {
      visual.textContent = card.dataset.kind === 'image' ? 'FOTO'
        : file.mime_type === 'application/pdf' ? 'PDF' : 'DOC';
    }
    previews.push({ image, url: file.signedUrl });
    link.append(visual);
    if (card.dataset.kind === 'document') {
      const caption = document.createElement('span');
      caption.className = 'trip-file-card-caption';
      const name = document.createElement('strong'); name.textContent = file.file_name;
      const size = document.createElement('small'); size.textContent = tripFileSize(file);
      caption.append(name, size);
      link.append(caption);
    }
    card.append(link);
    deck.append(card);
    return card;
  });

  const controls = document.createElement('div'); controls.className = 'trip-files-deck-controls';
  const previous = document.createElement('button');
  previous.type = 'button'; previous.textContent = '‹';
  previous.setAttribute('aria-label', `Arquivo anterior de ${label}`);
  const position = document.createElement('span');
  position.className = 'trip-files-deck-position';
  position.setAttribute('aria-live', 'polite');
  const next = document.createElement('button');
  next.type = 'button'; next.textContent = '›';
  next.setAttribute('aria-label', `Próximo arquivo de ${label}`);
  controls.append(previous, position, next);
  controls.hidden = entries.length < 2;
  const deckKey = `${tripId}:${day?.id || 'general'}`;
  let active = Math.min(state.tripFileDeckIndexes.get(deckKey) || 0, entries.length - 1);
  const show = index => {
    active = Math.max(0, Math.min(index, entries.length - 1));
    state.tripFileDeckIndexes.set(deckKey, active);
    cards.forEach((card, cardIndex) => {
      const distance = cardIndex - active;
      card.dataset.position = distance === 0 ? 'current'
        : distance < 0 ? 'previous' : distance <= 2 ? 'queued' : 'hidden';
      const depth = Math.min(Math.max(distance, 0), 2);
      card.style.setProperty('--stack-x', `${depth * 13}px`);
      card.style.setProperty('--stack-y', `${depth * 6}px`);
      card.style.setProperty('--stack-scale', String(1 - depth * .04));
      card.style.zIndex = String(entries.length - cardIndex);
      card.inert = distance !== 0;
      card.setAttribute('aria-hidden', String(distance !== 0));
      const preview = previews[cardIndex];
      if (distance >= 0 && distance <= 2 && preview.image && !preview.image.getAttribute('src')) {
        preview.image.src = preview.url;
      }
    });
    previous.disabled = active === 0;
    next.disabled = active === entries.length - 1;
    position.textContent = `${active + 1} de ${entries.length}`;
  };
  previous.addEventListener('click', () => show(active - 1));
  next.addEventListener('click', () => show(active + 1));
  let gesture = null;
  let lastSwipeAt = 0;
  deck.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  deck.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const distanceX = event.clientX - gesture.x;
    const distanceY = event.clientY - gesture.y;
    gesture = null;
    if (Math.abs(distanceX) < 45 || Math.abs(distanceX) < Math.abs(distanceY) * 1.3) return;
    event.preventDefault();
    lastSwipeAt = Date.now();
    show(active + (distanceX < 0 ? 1 : -1));
  });
  deck.addEventListener('pointercancel', () => { gesture = null; });
  deck.addEventListener('click', event => {
    if (Date.now() - lastSwipeAt >= 450) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  deck.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(active + (event.key === 'ArrowRight' ? 1 : -1));
  });
  show(active);
  group.append(heading, deck, controls);
  return group;
}

function renderTripFiles(tripId, days) {
  if (String(state.activeTripId) !== String(tripId)) return;
  const selected = dom.tripFilesDay.value;
  dom.tripFilesDay.replaceChildren();
  const noDay = document.createElement('option');
  noDay.value = ''; noDay.textContent = 'Sem dia';
  dom.tripFilesDay.append(noDay);
  for (const day of days) {
    const option = document.createElement('option'); option.value = String(day.id);
    option.textContent = `Dia ${dayNumber(day)} · ${day.title || displayDate(derivedDayDate(day))}`;
    dom.tripFilesDay.append(option);
  }
  dom.tripFilesDay.value = days.some(day => String(day.id) === selected) ? selected : '';
  dom.tripFilesList.replaceChildren();
  const rows = state.tripFilesByTrip.get(String(tripId)) || [];
  const general = rows.filter(row => !row.day_id);
  if (general.length) dom.tripFilesList.append(renderTripFileDeck(tripId, null, general));
  for (const day of days) {
    const entries = rows.filter(row => String(row.day_id) === String(day.id));
    if (entries.length) dom.tripFilesList.append(renderTripFileDeck(tripId, day, entries));
  }
  if (!rows.length) {
    const empty = document.createElement('p'); empty.className = 'trip-files-empty';
    empty.textContent = state.tripFilesByTrip.has(String(tripId))
      ? 'Nenhum arquivo nesta viagem ainda.'
      : 'Conecte-se para consultar os arquivos desta viagem.';
    dom.tripFilesList.append(empty);
  }
  dom.tripFilesInput.closest('.trip-files-pick').hidden = !canEditActiveTrip();
  dom.tripFilesDay.disabled = !canEditActiveTrip();
}

async function loadTripFiles(tripId) {
  const key = String(tripId);
  if (state.activeTripId !== key) return;
  setTripPanelStatus(dom.tripFilesStatus, 'Carregando arquivos…');
  let days = state.tripDays.filter(day => String(day.trip_id) === key);
  if (!days.length) {
    const data = await fetchTripData(key, { preferLocal: true }) || await fetchTripData(key);
    if (state.activeTripId !== key) return;
    applyTripData(data);
    days = data.days;
  }
  if (state.activeTripId !== key) return;
  if (state.tripFilesByTrip.has(key)) renderTripFiles(key, days);
  const client = await trySupabase(5000);
  if (!client) {
    renderTripFiles(key, days);
    setTripPanelStatus(dom.tripFilesStatus, 'Conecte-se para consultar e enviar arquivos.');
    return;
  }
  const { data, error } = await client.from('day_attachments').select('*').eq('trip_id', key).order('created_at');
  if (error) throw error;
  const signed = await Promise.all((data || []).map(async file => {
    const result = await client.storage.from(DAY_ATTACHMENT_BUCKET).createSignedUrl(file.storage_path, 3600);
    return { ...file, signedUrl: result.error ? '' : result.data?.signedUrl || '' };
  }));
  state.tripFilesByTrip.set(key, signed);
  if (state.activeTripId === key) { renderTripFiles(key, days); setTripPanelStatus(dom.tripFilesStatus); }
}

async function uploadTripFiles(files) {
  const tripId = String(state.activeTripId || '');
  const dayId = dom.tripFilesDay.value;
  const day = dayId ? state.tripDays.find(item => String(item.id) === dayId && String(item.trip_id) === tripId) : null;
  if (!tripId || !canEditActiveTrip() || !files.length) return;
  if (dayId && !day) { setTripPanelStatus(dom.tripFilesStatus, 'Escolha um dia válido ou deixe sem dia.', 'error'); return; }
  const client = await trySupabase(5000);
  if (!client) { setTripPanelStatus(dom.tripFilesStatus, 'Conecte-se para enviar arquivos.', 'error'); return; }
  const button = dom.tripFilesInput.closest('.trip-files-pick'); button.dataset.busy = 'true';
  try {
    for (const [index, file] of files.entries()) {
      setTripPanelStatus(dom.tripFilesStatus, `Enviando ${index + 1} de ${files.length}: ${file.name}`);
      await storeTripAttachment(client, tripId, day?.id || null, file);
    }
    await loadTripFiles(tripId);
    setTripPanelStatus(dom.tripFilesStatus, files.length === 1 ? 'Arquivo salvo.' : `${files.length} arquivos salvos.`);
  } catch (error) {
    await loadTripFiles(tripId).catch(() => {});
    setTripPanelStatus(dom.tripFilesStatus, error.message || 'Não foi possível enviar.', 'error');
  } finally { button.dataset.busy = 'false'; dom.tripFilesInput.value = ''; }
}

async function openTrip(tripId, { pushHistory = true, forceRefresh = false } = {}) {
  const trip = state.trips.find(item => String(item.id) === String(tripId));
  if (!trip) return;
  const enteringTrip = state.activeTripId !== String(trip.id) || document.body.dataset.tripPage !== 'open';
  if (tripColorDraft && tripColorDraft.tripId !== String(tripId)) savePendingTripColor();
  document.body.dataset.tripPermission = tripRole(trip);
  dom.tripPageShare.hidden = tripRole(trip) !== 'owner';
  dom.tripPagePassengers.setAttribute('aria-label', canEditTrip(trip) ? 'Editar passageiros da viagem' : 'Ver passageiros da viagem');
  if (state.activeTripId !== String(trip.id)) {
    dom.tripDateEditor.hidden = true;
    dom.tripPageDuration.setAttribute('aria-expanded', 'false');
    dom.tripPageDates.setAttribute('aria-expanded', 'false');
    dom.tripPageTitleInput.hidden = true;
    dom.tripPageTitle.hidden = false;
    dom.tripPageSaveStatus.textContent = '';
  }
  if (pushHistory && (document.body.dataset.tripPage !== 'open' || state.activeTripId !== String(trip.id))) {
    window.history.pushState({ view: 'trip', tripId: String(trip.id) }, '', `#trip-${trip.id}`);
  }
  state.activeTripId = String(trip.id);
  if (enteringTrip) {
    dom.budgetList.replaceChildren(); dom.budgetSummary.replaceChildren();
    dom.tripFilesList.replaceChildren(); dom.tripFilesDay.replaceChildren();
    dom.tripFilesDay.disabled = true; dom.tripFilesInput.closest('.trip-files-pick').hidden = true;
    selectTripTab('roteiro', { reset: true });
  }
  dom.tripTabs.inert = false;
  dom.tripTabs.setAttribute('aria-hidden', 'false');
  if (canEditTrip(trip)) ensureTripBaselineSnapshot(trip.id).catch(error => console.warn('Ponto de segurança inicial indisponível', error));
  syncTripHero(trip);
  dom.tripPage.setAttribute('aria-hidden', 'false');
  document.body.dataset.tripPage = 'open';
  const key = String(trip.id);
  const cached = forceRefresh ? null : state.tripDataCache.get(key);
  if (cached) {
    applyTripData(cached);
    dom.tripDayMessage.textContent = '';
    if (state.activeDayId && cached.days.some(day => String(day.id) === String(state.activeDayId))) openDayPage(state.activeDayId, { pushHistory: false });
    if (Date.now() - cached.loadedAt < TRIP_CACHE_FRESH_MS) return;
  } else if (!forceRefresh) {
    try {
      const local = await fetchTripData(trip.id, { preferLocal: true });
      if (state.activeTripId !== key) return;
      if (local?.days.length) {
        state.tripDataCache.set(key, local);
        applyTripData(local);
        dom.tripDayMessage.textContent = '';
        if (state.activeDayId && local.days.some(day => String(day.id) === String(state.activeDayId))) openDayPage(state.activeDayId, { pushHistory: false });
      } else {
        dom.tripDayList.replaceChildren();
        dom.tripDayMessage.textContent = 'Carregando dias…';
      }
    } catch (error) {
      dom.tripDayList.replaceChildren();
      dom.tripDayMessage.textContent = 'Carregando dias…';
    }
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
    if (state.activeTripId === key && !state.tripDataCache.get(key)?.days?.length) dom.tripDayMessage.textContent = error.message;
  }
}

function closeTripPage() {
  closeTripFileViewer({ immediate: true });
  if (tripColorSaveTimer) savePendingTripColor();
  closeBudgetPage();
  dom.tripTabs.inert = true;
  dom.tripTabs.setAttribute('aria-hidden', 'true');
  document.body.dataset.tripPermission = '';
  state.activeTripId = null;
  dom.budgetEditor.replaceChildren();
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
    if (state.editing && tripRole(state.trips.find(trip => String(trip.id) === String(button.dataset.tripId))) === 'owner') toggleTripSelection(button.dataset.tripId);
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
  refs.owner.replaceChildren();
  if (owned) refs.owner.textContent = 'criada por você';
  else {
    const sharedOwner = state.tripOwners.get(String(trip.id));
    if (sharedOwner) {
      const avatar = document.createElement('span'); avatar.className = 'trip-owner-avatar';
      avatar.setAttribute('aria-label', `Foto de ${sharedOwner.name}`);
      if (sharedOwner.avatarUrl) {
        const image = document.createElement('img'); image.src = sharedOwner.avatarUrl; image.alt = '';
        image.addEventListener('error', () => { avatar.textContent = sharedOwner.name?.trim()[0]?.toUpperCase() || '?'; });
        avatar.append(image);
      } else avatar.textContent = sharedOwner.name?.trim()[0]?.toUpperCase() || '?';
      refs.owner.append(avatar);
    }
    refs.owner.append(document.createTextNode(sharedOwner?.name ? `Compartilhada por ${sharedOwner.name}` : 'Viagem compartilhada'));
  }
  refs.timing.textContent = tripTiming(trip);
  refs.title.textContent = trip.name;
  refs.dates.textContent = `${displayDate(trip.start_date)} — ${displayDate(tripEndDate(trip))}`;
  refs.selection.dataset.selected = String(state.selectedTripIds.has(String(trip.id)));
  refs.selection.style.display = owned ? '' : 'none';
  syncPassengerList(refs.stack, state.passengers.get(trip.id) || []);
}

function syncTripSelectionUI() {
  for (const item of dom.tripList.querySelectorAll('li[data-trip-id]')) {
    const selected = state.selectedTripIds.has(String(item.dataset.tripId));
    if (item._refs?.selection) item._refs.selection.dataset.selected = String(selected);
    item._refs?.button?.setAttribute('aria-pressed', String(selected));
  }
  dom.deleteSelectedTrips.disabled = state.selectedTripIds.size === 0;
}

function toggleTripSelection(tripId) {
  const id = String(tripId);
  if (tripRole(state.trips.find(trip => String(trip.id) === id)) !== 'owner') return;
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
  const deletedTrips = state.trips.filter(trip => ids.includes(String(trip.id)) || ids.includes(trip.id));
  const deletedAt = new Date().toISOString();
  dom.deleteSelectedTrips.disabled = true;
  const result = await client.from('trips').update({ deleted_at: deletedAt }).in('id', ids).eq('user_id', state.user.id);
  if (result.error) {
    dom.deleteSelectedTrips.textContent = result.error.message;
    dom.deleteSelectedTrips.disabled = false;
    return;
  }
  for (const trip of deletedTrips) {
    await recordChange({
      tripId: trip.id,
      entityType: 'trip',
      entityId: trip.id,
      action: 'delete',
      summary: 'Viagem “' + trip.name + '” movida para excluídas',
      beforeState: { deleted_at: null },
      afterState: { deleted_at: deletedAt }
    });
  }
  setEditingMode(false);
  await loadTrips();
  dom.deleteSelectedTrips.textContent = 'Excluir selecionadas';
}


function tripDateRange(trip) {
  const start = trip?.start_date ? new Date(String(trip.start_date) + 'T00:00:00') : null;
  const endValue = tripEndDate(trip);
  const end = endValue ? new Date(String(endValue) + 'T23:59:59') : null;
  return { start, end };
}

function tripListGroup(trip, now = new Date()) {
  const { start, end } = tripDateRange(trip);
  if (end && end < now) return 'past';
  if (start && start > now) return 'upcoming';
  return 'current';
}

function compareTripsForHome(a, b, now = new Date()) {
  const groupRank = { current: 0, upcoming: 1, past: 2 };
  const groupA = tripListGroup(a, now);
  const groupB = tripListGroup(b, now);

  if (groupRank[groupA] !== groupRank[groupB]) {
    return groupRank[groupA] - groupRank[groupB];
  }

  if (groupA === 'past') {
    return String(tripEndDate(b)).localeCompare(String(tripEndDate(a)));
  }

  return String(a.start_date || '').localeCompare(String(b.start_date || ''));
}

function setTripSectionCollapsed(item, collapsed) {
  item.dataset.collapsed = String(collapsed);
  item._refs.button.setAttribute('aria-expanded', String(!collapsed));
  item._refs.content.setAttribute('aria-hidden', String(collapsed));
  item._refs.content.inert = collapsed;
}

function createTripSection(group, text) {
  const item = document.createElement('li');
  item.className = 'trip-section';
  item.dataset.tripSection = group;

  const heading = document.createElement('h2');
  heading.className = 'trip-section-title';
  const button = document.createElement('button');
  button.className = 'trip-section-toggle';
  button.type = 'button';
  button.setAttribute('aria-controls', `trip-section-${group}`);
  const label = document.createElement('span');
  label.textContent = text;
  const count = document.createElement('span');
  count.className = 'trip-section-count';
  const divider = document.createElement('span');
  divider.className = 'trip-section-divider';
  divider.setAttribute('aria-hidden', 'true');
  const chevron = document.createElement('span');
  chevron.className = 'trip-section-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  button.append(label, count, divider, chevron);
  heading.append(button);

  const content = document.createElement('div');
  content.className = 'trip-section-content';
  content.id = `trip-section-${group}`;
  const clip = document.createElement('div');
  clip.className = 'trip-section-clip';
  const cards = document.createElement('ol');
  cards.className = 'trip-section-cards';
  clip.append(cards);
  content.append(clip);
  item.append(heading, content);
  item._refs = { button, count, content, cards };

  button.addEventListener('click', () => {
    const key = `${state.selectedYear}:${group}`;
    const collapsed = !state.collapsedTripSections.has(key);
    if (collapsed) state.collapsedTripSections.add(key);
    else state.collapsedTripSections.delete(key);
    setTripSectionCollapsed(item, collapsed);
  });

  return item;
}

function syncTripList() {
  const now = new Date();
  const visibleTrips = state.trips
    .filter(trip => Number(String(trip.start_date).slice(0, 4)) === state.selectedYear)
    .sort((a, b) => compareTripsForHome(a, b, now));

  const existingCards = new Map(
    [...dom.tripList.querySelectorAll('li[data-trip-id]')]
      .map(item => [String(item.dataset.tripId), item])
  );
  const existingSections = new Map(
    [...dom.tripList.children]
      .filter(item => item.dataset.tripSection)
      .map(item => [item.dataset.tripSection, item])
  );

  const sectionLabels = {
    current: 'Viagens em andamento',
    upcoming: 'Próximas viagens',
    past: 'Viagens realizadas'
  };
  const sections = new Map();
  for (const trip of visibleTrips) {
    const group = tripListGroup(trip, now);
    let section = sections.get(group);
    if (!section) {
      section = existingSections.get(group) || createTripSection(group, sectionLabels[group]);
      section._refs.cards.replaceChildren();
      setTripSectionCollapsed(section, state.collapsedTripSections.has(`${state.selectedYear}:${group}`));
      sections.set(group, section);
    }

    let item = existingCards.get(String(trip.id));
    if (!item) item = createTripNode(trip);
    else updateTripNode(item, trip);

    section._refs.cards.append(item);
    section._refs.count.textContent = String(section._refs.cards.childElementCount);
  }

  dom.tripList.replaceChildren(...sections.values());

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

function savedPassengerKey(passenger) {
  return `${String(passenger.name || '').trim().toLocaleLowerCase('pt-BR')}|${passenger.birth_date || passenger.birthDate || ''}`;
}

function availableSavedPassengers() {
  const entries = new Map(state.savedPassengers.map(person => [savedPassengerKey(person), person]));
  // Reuse a better historical photo only for people that are explicitly saved.
  for (const group of state.passengers.values()) for (const passenger of group) {
    const key = savedPassengerKey(passenger);
    const existing = entries.get(key);
    if (existing && !existing.photo_url && passenger.photo_url) {
      entries.set(key, { ...existing, photo_url: passenger.photo_url });
    }
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

async function cacheCompleteWorkspace() {
  if (!state.user?.id || !state.trips.length || !navigator.onLine) return;
  if ((await offlineStore.listOutbox()).length) return;
  const client = await trySupabase();
  if (!client) return;
  const lastSnapshot = await offlineStore.getMeta(`complete_snapshot:${state.user.id}`);
  if (lastSnapshot && Date.now() - new Date(lastSnapshot).getTime() < 30 * 60 * 1000) return;

  const tripIds = state.trips.map(trip => trip.id);
  const orderedSchema = await supportsOrderedDaySchema(client);
  const daysResult = await client.from('trip_days').select('*').in('trip_id', tripIds).order(orderedSchema ? 'position' : 'day_number');
  if (daysResult.error) throw daysResult.error;
  const allDays = (daysResult.data || []).map(normalizeDayRecord);

  let allActivities = [];
  let allLocations = [];
  if (allDays.length) {
    ({ activities: allActivities, locations: allLocations } = await loadDayRecords(client, allDays.map(day => day.id)));
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

async function refreshSharedTripOwners(client) {
  if (!state.trips.some(trip => tripRole(trip) !== 'owner')) {
    state.tripOwners.clear();
    await offlineStore.setMeta(`shared_trip_owners:${state.user.id}`, []).catch(console.warn);
    return;
  }
  const owners = await client.rpc('shared_trip_owners');
  if (owners.error) throw owners.error;
  const entries = await Promise.all((owners.data || []).map(async owner => {
    let avatarUrl = '';
    if (owner.avatar_path) {
      const signed = await client.storage.from('profile-photos').createSignedUrl(owner.avatar_path, 3600);
      if (signed.error) console.warn('Foto do proprietário indisponível:', signed.error);
      else avatarUrl = signed.data.signedUrl;
    }
    return [String(owner.trip_id), { name: owner.owner_name, avatarUrl }];
  }));
  state.tripOwners = new Map(entries);
  await offlineStore.setMeta(`shared_trip_owners:${state.user.id}`,
    entries.map(([tripId, owner]) => ({ tripId, ...owner }))).catch(console.warn);
}

async function loadTrips({ allowLocalFallback = true } = {}) {
  try {
    const client = await trySupabase();
    if (!client) throw new Error('Backend indisponível.');
    const claimed = await client.rpc('claim_trip_invitations');
    if (claimed.error) console.warn('Convites aguardando atualização:', claimed.error);
    const result = await client.from('trips').select('*').is('deleted_at', null).order('start_date', { ascending: true });
    if (result.error) throw result.error;
    state.trips = (result.data || []).map(normalizeTripRecord);
    const memberships = await client.from('trip_members').select('trip_id,role').eq('user_id', state.user.id);
    if (memberships.error) throw memberships.error;
    state.tripRoles = new Map((memberships.data || []).map(member => [String(member.trip_id), member.role]));
    for (const trip of state.trips) trip.access_role = tripRole(trip);
    await refreshSharedTripOwners(client).catch(error => console.warn('Proprietários compartilhados indisponíveis:', error));
    let passengerRecords = [];
    if (state.trips.length) {
      const passengers = await client.from('passengers').select('*').in('trip_id', state.trips.map(trip => trip.id)).order('created_at');
      if (passengers.error) throw passengers.error;
      passengerRecords = passengers.data || [];
    }
    applyPassengers(passengerRecords);
    const saved = await client.from('saved_passengers').select('*').eq('owner_id', state.user.id).order('name');
    if (saved.error) console.warn('Passageiros salvos indisponíveis:', saved.error);
    else state.savedPassengers = saved.data || [];
    if (state.user?.id) await offlineStore.replaceWorkspace(state.user.id, state.trips, passengerRecords);
  } catch (remoteError) {
    if (!allowLocalFallback || !state.user?.id) throw remoteError;
    const local = await offlineStore.loadWorkspace(state.user.id);
    if (!local.trips.length) throw remoteError;
    state.trips = local.trips.map(normalizeTripRecord);
    applyPassengers(local.passengers);
  }
  syncYearList();
  syncTripList();
  if (state.activeTripId) {
    const active = state.trips.find(trip => String(trip.id) === String(state.activeTripId));
    if (!active) closeTripPage();
    else {
      document.body.dataset.tripPermission = tripRole(active);
      dom.tripPageShare.hidden = tripRole(active) !== 'owner';
      if (document.body.dataset.tripPage === 'open') syncTripHero(active);
    }
  }
}

async function loadProfile({ allowLocalFallback = true } = {}) {
  try {
    const client = await trySupabase();
    if (!client) throw new Error('Backend indisponível.');
    const result = await client.from('passenger_profiles').select('*').eq('user_id', state.user.id).maybeSingle();
    if (result.error) throw result.error;
    state.profile = result.data || { user_id: state.user.id, name: defaultProfileName(state.user), birth_date: null, avatar_path: null };
    if (state.profile.is_deleted) { await client.auth.signOut(); throw new Error('Esta conta está desativada. Seus dados continuam preservados.'); }
    if (state.profile.avatar_path) {
      const signed = await client.storage.from('profile-photos').createSignedUrl(state.profile.avatar_path, 3600);
      if (!signed.error) state.profile.avatar_url = signed.data.signedUrl;
    }
    await offlineStore.saveProfile(state.profile);
  } catch (remoteError) {
    if (!allowLocalFallback) throw remoteError;
    state.profile = await offlineStore.getProfile(state.user.id);
    if (!state.profile) state.profile = { user_id: state.user.id, name: defaultProfileName(state.user), birth_date: null, avatar_path: null };
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
      passenger.photoEdited = true;
      image.src = passenger.photoUrl;
      image.hidden = false;
      initial.hidden = true;
      schedulePassengerSave();
    } catch {
      const message = document.body.dataset.activeSheet === 'trip-passengers' ? dom.tripPassengerMessage : dom.newTripMessage;
      message.textContent = 'Não foi possível preparar a foto do passageiro.';
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
  nameInput.addEventListener('change', schedulePassengerSave);
  nameField.append(nameInput);

  const birthField = document.createElement('label');
  birthField.className = 'new-trip-passenger-field';
  birthField.innerHTML = '<span>Nascimento</span>';
  const birthInput = document.createElement('input');
  birthInput.type = 'date';
  birthInput.value = passenger.birthDate || '';
  birthInput.addEventListener('input', () => { passenger.birthDate = birthInput.value; });
  birthInput.addEventListener('change', schedulePassengerSave);
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
      schedulePassengerSave();
    });
  }

  row.append(avatar, fields, control);
  dom.newTripPassengerList.append(row);
}

function renderTripPassengers(focusLast = false) {
  dom.newTripPassengerList.replaceChildren();
  const saved = availableSavedPassengers();
  for (const passenger of state.newTripPassengers) {
    const isSaved = !passenger.session && saved.some(person => matchesSavedPassenger(passenger, person));
    if (!passenger.session && !isSaved) createTripPassengerRow(passenger);
  }
  renderSavedTripPassengers();
  if (focusLast) dom.newTripPassengerList.lastElementChild?.querySelector('input[type="text"]')?.focus({ preventScroll: true });
}

function matchesSavedPassenger(passenger, saved) {
  if (passenger.savedPassengerId && saved.owner_id && passenger.savedPassengerId === saved.id) return true;
  if (passenger.sourcePassengerId && !saved.owner_id && passenger.sourcePassengerId === saved.id) return true;
  return savedPassengerKey(passenger) === savedPassengerKey(saved);
}

function renderSavedTripPassengers() {
  const saved = availableSavedPassengers().filter(person =>
    String(person.user_id || '') !== String(state.user?.id) &&
    savedPassengerKey(person) !== savedPassengerKey({ name: profileName(), birthDate: state.profile?.birth_date })
  );
  dom.savedTripPassengers.hidden = saved.length === 0;
  dom.savedTripPassengerList.replaceChildren();
  for (const person of saved) {
    const selected = state.newTripPassengers.some(item => !item.session && matchesSavedPassenger(item, person));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'saved-trip-passenger';
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${selected ? 'Remover' : 'Adicionar'} ${person.name} ${selected ? 'da' : 'à'} viagem`);
    const avatar = document.createElement('span');
    avatar.className = 'saved-trip-passenger-avatar';
    if (person.photo_url) {
      const image = document.createElement('img');
      image.src = person.photo_url;
      image.alt = '';
      avatar.append(image);
    } else avatar.textContent = person.name.trim()[0]?.toUpperCase() || '?';
    const name = document.createElement('span');
    name.textContent = person.name;
    button.append(avatar, name);
    button.addEventListener('click', () => {
      if (selected) {
        state.newTripPassengers = state.newTripPassengers.filter(item =>
          item.session || !matchesSavedPassenger(item, person));
      } else {
        state.newTripPassengers.push({
          id: crypto.randomUUID(), session: false, userId: null,
          savedPassengerId: person.owner_id ? person.id : null,
          sourcePassengerId: person.owner_id ? null : person.id,
          name: person.name, birthDate: person.birth_date || '', photoUrl: person.photo_url || '',
          saveForLater: true
        });
      }
      renderTripPassengers();
      schedulePassengerSave();
    });
    dom.savedTripPassengerList.append(button);
  }
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
  return savedPassengerKey(passenger);
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

async function createTripInstantly() {
  if (state.saving || !state.user?.id) return;
  state.saving = true;
  setLoading(dom.newTripButton, true);
  setLoading(dom.emptyNewTripButton, true);
  dom.tripCreateMessage.textContent = '';

  try {
    const client = await trySupabase();
    if (!client) throw new Error('É necessária uma conexão para criar a viagem.');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const orderedSchema = await supportsOrderedDaySchema(client);
    const payload = {
      user_id: state.user.id,
      name: 'Nova viagem',
      destination: '',
      start_date: today,
      secondary_color: '#4775d1',
      ...(orderedSchema ? { day_count: 1 } : { end_date: today })
    };
    const created = await client.from('trips').insert(payload).select().single();
    if (created.error) throw created.error;
    const trip = created.data;

    let failure = (await client.from('trip_members').insert({
      trip_id: trip.id, user_id: state.user.id, role: 'owner'
    })).error;
    if (!failure) failure = (await client.from('passengers').insert({
      trip_id: trip.id, user_id: state.user.id,
      name: profileName(), birth_date: state.profile?.birth_date || null,
      photo_url: null, age: ageFromBirthDate(state.profile?.birth_date)
    })).error;
    if (!failure) failure = (await client.from('trip_days').insert(createDays(trip.id, 1, today, orderedSchema))).error;
    if (failure) {
      await client.from('trip_days').delete().eq('trip_id', trip.id);
      await client.from('passengers').delete().eq('trip_id', trip.id);
      await client.from('trip_members').delete().eq('trip_id', trip.id);
      await client.from('trips').delete().eq('id', trip.id);
      throw failure;
    }

    state.selectedYear = now.getFullYear();
    try {
      await loadTrips({ allowLocalFallback: false });
    } catch (error) {
      console.warn('Atualização das viagens pendente:', error);
      if (!state.trips.some(item => String(item.id) === String(trip.id))) state.trips.push(normalizeTripRecord(trip));
      if (!state.passengers.has(trip.id)) state.passengers.set(trip.id, [{
        trip_id: trip.id, user_id: state.user.id, name: profileName(),
        birth_date: state.profile?.birth_date || null, photo_url: null
      }]);
      syncYearList();
      syncTripList();
      offlineStore.replaceWorkspace(state.user.id, state.trips, [...state.passengers.values()].flat()).catch(console.warn);
    }
    setYearMenu(false);
    await openTrip(trip.id);
    recordChange({
      tripId: trip.id, entityType: 'trip', entityId: trip.id, action: 'create',
      summary: 'Viagem “' + trip.name + '” criada', beforeState: null,
      afterState: { name: trip.name, destination: '', start_date: today, day_count: 1 }
    }).catch(console.warn);
  } catch (error) {
    dom.tripCreateMessage.textContent = error.message || 'Não foi possível criar a viagem.';
  } finally {
    state.saving = false;
    setLoading(dom.newTripButton, false);
    setLoading(dom.emptyNewTripButton, false);
  }
}

const tripPassengerGroup = document.querySelector('.passenger-form-group');
const tripPassengerHome = tripPassengerGroup.parentElement;
let passengerEditorTripId = null;
let passengerSaveTimer = null;
let passengerSaveTask = Promise.resolve();
let passengerSaveRevision = 0;
let passengerSavedRevision = 0;

function openTripPassengers() {
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (!trip) return;
  passengerEditorTripId = String(trip.id);
  passengerSaveRevision = 0;
  passengerSavedRevision = 0;
  dom.tripPassengerMessage.textContent = canEditTrip(trip) ? '' : 'Somente leitura';
  dom.tripPassengerMessage.dataset.kind = 'info';
  state.newTripPassengers = uniqueTripPassengers((state.passengers.get(trip.id) || []).map(passenger => ({
    id: passenger.id || crypto.randomUUID(),
    session: String(passenger.user_id || '') === String(state.user.id),
    userId: passenger.user_id || null,
    name: passenger.name || '',
    birthDate: passenger.birth_date || '',
    photoUrl: passenger.photo_url || '',
    saveForLater: true,
    savedPassengerId: state.savedPassengers.find(person => savedPassengerKey(person) === savedPassengerKey(passenger))?.id || null,
    sourcePassengerId: passenger.id
  })));
  const self = state.newTripPassengers.find(person => person.session);
  dom.tripPassengerSelf.hidden = !self;
  if (self) {
    dom.tripPassengerSelfImage.src = passengerImage(self).src || profileImage();
    dom.tripPassengerSelfName.textContent = self.name;
  }
  renderTripPassengers();
  tripPassengerGroup.inert = !canEditTrip(trip);
  dom.tripPassengerSheetBody.append(tripPassengerGroup);
  setActiveSheet('trip-passengers');
}

async function loadTripMembers(tripId) {
  const client = await trySupabase();
  if (!client) return;
  const { data, error } = await client.rpc('list_trip_members', { p_trip_id: tripId });
  if (error) throw error;
  dom.tripMemberList.replaceChildren();
  for (const member of data || []) {
    const row = document.createElement('div'); row.className = 'trip-member-row';
    const copy = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('small');
    name.textContent = member.display_name || member.email;
    detail.textContent = member.role === 'owner' ? 'Proprietário' : member.email;
    copy.append(name, detail);
    const role = document.createElement('span'); role.className = 'trip-member-role';
    role.textContent = member.role === 'owner' ? 'dono' : member.role === 'editor' ? 'pode editar' : 'visualiza';
    row.append(copy, role); dom.tripMemberList.append(row);
  }
}

async function shareActiveTrip() {
  const tripId = state.editingTripId, email = dom.tripShareEmail.value.trim();
  if (!tripId || !email) return;
  dom.tripShareButton.disabled = true; dom.tripShareMessage.textContent = 'Compartilhando…';
  try {
    const client = await trySupabase(); if (!client) throw new Error('Compartilhar requer conexão.');
    const { error } = await client.rpc('share_trip_with_email', { p_trip_id: tripId, p_email: email, p_role: 'editor' });
    if (error) throw error;
    dom.tripShareEmail.value = '';
    dom.tripShareMessage.textContent = 'Viagem compartilhada. Cada pessoa pode conectar o próprio ChatGPT em sua conta.';
    await loadTripMembers(tripId);
  } catch (error) { dom.tripShareMessage.textContent = error.message || 'Não foi possível compartilhar.'; }
  finally { dom.tripShareButton.disabled = false; }
}

async function refreshTripShares() {
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (tripRole(trip) !== 'owner') return;
  const client = await trySupabase();
  if (!client) throw new Error('É necessária uma conexão para ver os convites.');
  const { data, error } = await client.rpc('list_trip_shares', { p_trip_id: trip.id });
  if (error) throw error;
  dom.tripShareList.replaceChildren();
  if (!data?.length) { dom.tripShareList.textContent = 'Ainda não há convidados.'; return; }
  for (const person of data) {
    const row = document.createElement('div'); row.className = 'trip-share-row';
    const copy = document.createElement('div'); copy.className = 'trip-share-row-copy';
    const name = document.createElement('strong'); name.textContent = person.display_name || person.email;
    const email = document.createElement('small'); email.textContent = person.pending ? `${person.email} · aguardando conta` : person.email;
    copy.append(name, email);
    const role = document.createElement('span'); role.className = 'trip-share-row-role';
    role.textContent = person.role === 'editor' ? 'Pode editar' : 'Só visualiza';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'trip-share-row-remove';
    remove.textContent = '×'; remove.setAttribute('aria-label', `Remover acesso de ${person.email}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        const removed = await client.rpc('remove_trip_share', { p_trip_id: trip.id, p_email: person.email });
        if (removed.error) throw removed.error;
        await refreshTripShares();
        dom.tripShareStatus.textContent = 'Acesso removido.';
      } catch (error) { dom.tripShareStatus.dataset.kind = 'error'; dom.tripShareStatus.textContent = error.message || 'Não foi possível remover o acesso.'; remove.disabled = false; }
    });
    row.append(copy, role, remove); dom.tripShareList.append(row);
  }
}

function openTripShare() {
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (tripRole(trip) !== 'owner') return;
  dom.tripShareForm.reset();
  dom.tripShareStatus.textContent = '';
  dom.tripShareStatus.dataset.kind = 'info';
  dom.tripShareList.textContent = 'Carregando…';
  setActiveSheet('trip-share');
  refreshTripShares().catch(error => {
    dom.tripShareStatus.dataset.kind = 'error';
    dom.tripShareStatus.textContent = error.message || 'Não foi possível carregar os convites.';
  });
}

async function submitTripShare(event) {
  event.preventDefault();
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (tripRole(trip) !== 'owner' || dom.sendTripShare.disabled) return;
  const email = dom.tripShareRecipient.value.trim();
  const role = new FormData(dom.tripShareForm).get('permission');
  if (!email || !['viewer', 'editor'].includes(role)) return;
  dom.sendTripShare.disabled = true;
  dom.tripShareStatus.dataset.kind = 'info';
  dom.tripShareStatus.textContent = 'Compartilhando…';
  try {
    const client = await trySupabase();
    if (!client) throw new Error('É necessária uma conexão para compartilhar.');
    const { data, error } = await client.rpc('invite_trip_by_email', { p_trip_id: trip.id, p_email: email, p_role: role });
    if (error) throw error;
    dom.tripShareRecipient.value = '';
    dom.tripShareStatus.textContent = data === 'pending' ? 'Convite salvo. A viagem aparecerá quando essa pessoa criar a conta com esse e-mail.' : 'Viagem compartilhada.';
    await refreshTripShares();
  } catch (error) { dom.tripShareStatus.dataset.kind = 'error'; dom.tripShareStatus.textContent = error.message || 'Não foi possível compartilhar.'; }
  finally { dom.sendTripShare.disabled = false; }
}

function openProfile() {
  setYearMenu(false);
  state.avatarFile = null; state.avatarPreview = '';
  dom.profilePhotoInput.value = '';
  dom.profileMessage.textContent = '';
  dom.profileMessage.dataset.kind = 'info';
  syncProfileUI();
  resetProfileSavedPassengers();
  renderProfileSavedPassengers();
  setActiveSheet('profile');
}

function closeSheets() {
  if (document.body.dataset.activeSheet === 'trip-passengers') {
    closeTripPassengers().catch(console.warn);
    return;
  }
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
    dom.profileMessage.textContent = 'Salvando passageiros…';
    await saveProfileSavedPassengers(client);
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

function createDays(tripId, dayCount, startValue, orderedSchema) {
  return Array.from({ length: dayCount }, (_, position) => (
    orderedSchema
      ? {
          trip_id: tripId,
          position,
          is_hidden: false,
          status: 'empty'
        }
      : {
          trip_id: tripId,
          day_number: position + 1,
          date: addDaysToDate(startValue, position),
          status: 'empty'
        }
  ));
}

function tripPayloadFromForm(values, orderedSchema, includeOwner = false) {
  const dayCount = Math.max(1, Math.min(365, Number(values.day_count) || 1));
  const payload = {
    name: values.name.trim(),
    destination: values.destination.trim(),
    start_date: values.start_date,
    arrival_method: values.arrival_method,
    location_label: values.location_label.trim() || null,
    cover_url: state.imageData,
    secondary_color: state.tripColor
  };

  if (includeOwner) payload.user_id = state.user.id;

  if (orderedSchema) {
    payload.day_count = dayCount;
  } else {
    payload.end_date = addDaysToDate(values.start_date, dayCount - 1);
  }

  return { payload, dayCount };
}

async function syncTripDaysForCount(client, tripId, startValue, dayCount, orderedSchema) {
  const result = await client
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .order(orderedSchema ? 'position' : 'day_number');
  if (result.error) return result.error;

  const existing = (result.data || []).map(normalizeDayRecord);
  const liveDays = existing.filter(day => !dayDeletedAt(day));

  for (const day of liveDays) {
    const position = dayPosition(day);
    const shouldHide = position >= dayCount;
    const patch = orderedSchema
      ? (shouldHide === dayIsHidden(day) ? null : {
          is_hidden: shouldHide,
          ...(!shouldHide && day.status === 'hidden' ? { status: 'empty' } : {})
        })
      : {
          ...(shouldHide !== dayIsHidden(day) ? { status: shouldHide ? 'hidden' : 'empty' } : {}),
          ...(!shouldHide && day.date !== addDaysToDate(startValue, position) ? { date: addDaysToDate(startValue, position) } : {})
        };
    if (patch && Object.keys(patch).length) {
      const updated = await client.from('trip_days').update(patch).eq('id', day.id);
      if (updated.error) return updated.error;
    }
  }

  const occupied = new Set(
    liveDays
      .filter(day => dayPosition(day) < dayCount)
      .map(day => dayPosition(day))
  );

  const missing = [];
  for (let position = 0; position < dayCount; position += 1) {
    if (!occupied.has(position)) missing.push(position);
  }

  if (missing.length) {
    const rows = missing.map(position => (
      orderedSchema
        ? { trip_id: tripId, position, is_hidden: false, status: 'empty' }
        : { trip_id: tripId, day_number: position + 1, date: addDaysToDate(startValue, position), status: 'empty' }
    ));
    const inserted = await client.from('trip_days').insert(rows);
    if (inserted.error) return inserted.error;
  }

  return null;
}

async function saveTripPassengers(client, tripId) {
  const existingPassengers = state.passengers.get(tripId) || [];
  const existingIds = new Set(existingPassengers.map(passenger => String(passenger.id)));
  const editedPassengers = uniqueTripPassengers(state.newTripPassengers);
  const retainedIds = new Set(
    editedPassengers
      .filter(passenger => existingIds.has(String(passenger.id)))
      .map(passenger => String(passenger.id))
  );
  const removedIds = existingPassengers
    .filter(passenger => !retainedIds.has(String(passenger.id)))
    .map(passenger => passenger.id);

  if (removedIds.length) {
    const removed = await client
      .from('passengers')
      .delete()
      .in('id', removedIds)
      .eq('trip_id', tripId)
      .select('id');
    if (removed.error) return removed.error;
    if ((removed.data || []).length !== removedIds.length) return new Error('Não foi possível remover todos os passageiros duplicados.');
  }

  for (const passenger of editedPassengers) {
    const passengerPayload = {
      user_id: passenger.session ? state.user.id : passenger.userId || null,
      name: passenger.name.trim(),
      birth_date: passenger.birthDate || null,
      photo_url: passenger.photoUrl || null,
      age: ageFromBirthDate(passenger.birthDate)
    };

    const alreadySaved = existingIds.has(String(passenger.id));
    const result = alreadySaved
      ? await client.from('passengers').update(passengerPayload).eq('id', passenger.id).eq('trip_id', tripId)
      : await client.from('passengers').insert({ ...passengerPayload, trip_id: tripId }).select('id').single();

    if (result.error) return result.error;
    if (!alreadySaved && result.data?.id) passenger.id = result.data.id;
  }

  const current = await client.from('passengers').select('*').eq('trip_id', tripId).order('created_at');
  if (current.error) return current.error;
  state.passengers.set(tripId, current.data || []);

  return null;
}

function schedulePassengerSave() {
  if (!canEditActiveTrip()) return;
  if (document.body.dataset.activeSheet !== 'trip-passengers') return;
  passengerSaveRevision += 1;
  dom.tripPassengerMessage.dataset.kind = 'info';
  dom.tripPassengerMessage.textContent = 'Salvando…';
  clearTimeout(passengerSaveTimer);
  passengerSaveTimer = setTimeout(() => persistPassengerEdits().catch(console.warn), 550);
}

async function persistPassengerEdits() {
  if (!canEditActiveTrip()) return true;
  clearTimeout(passengerSaveTimer);
  const tripId = passengerEditorTripId;
  const revision = passengerSaveRevision;
  if (!tripId || revision <= passengerSavedRevision) return true;
  if (state.newTripPassengers.some(passenger => !passenger.name.trim())) {
    dom.tripPassengerMessage.dataset.kind = 'error';
    dom.tripPassengerMessage.textContent = 'Dê um nome ao novo passageiro para salvar.';
    return false;
  }
  const task = passengerSaveTask.catch(() => {}).then(async () => {
    if (revision <= passengerSavedRevision) return true;
    const client = await trySupabase();
    if (!client) throw new Error('É necessária uma conexão para salvar os passageiros.');
    const before = (state.passengers.get(tripId) || []).map(person => ({ id: person.id, name: person.name }));
    const error = await saveTripPassengers(client, tripId);
    if (error) throw error;
    passengerSavedRevision = revision;
    if (state.activeTripId === tripId) syncTripHero(state.trips.find(trip => String(trip.id) === tripId));
    await loadTrips({ allowLocalFallback: false });
    recordChange({ tripId, entityType: 'trip', entityId: tripId, action: 'update', summary: 'Passageiros da viagem alterados', beforeState: before, afterState: (state.passengers.get(tripId) || []).map(person => ({ id: person.id, name: person.name })) }).catch(console.warn);
    dom.tripPassengerMessage.dataset.kind = 'info';
    dom.tripPassengerMessage.textContent = passengerSaveRevision > revision ? 'Salvando…' : 'Passageiros salvos';
    return true;
  }).catch(error => {
    dom.tripPassengerMessage.dataset.kind = 'error';
    dom.tripPassengerMessage.textContent = error.message || 'Não foi possível salvar os passageiros.';
    return false;
  });
  passengerSaveTask = task;
  return task;
}

async function closeTripPassengers() {
  if (document.body.dataset.activeSheet !== 'trip-passengers') return;
  const existingIds = new Set((state.passengers.get(passengerEditorTripId) || []).map(person => String(person.id)));
  const remaining = state.newTripPassengers.filter(person =>
    person.name.trim() || person.birthDate || person.photoUrl || existingIds.has(String(person.id)));
  if (remaining.length !== state.newTripPassengers.length) {
    state.newTripPassengers = remaining;
    renderTripPassengers();
  }
  if (!await persistPassengerEdits()) return;
  passengerEditorTripId = null;
  tripPassengerGroup.inert = false;
  tripPassengerHome.append(tripPassengerGroup);
  setActiveSheet('none');
}

let tripFieldSaveTask = Promise.resolve();
let tripColorSaveTimer = null;
let tripColorDraft = null;

function savePendingTripColor() {
  clearTimeout(tripColorSaveTimer);
  tripColorSaveTimer = null;
  const draft = tripColorDraft;
  if (!draft) return;
  const trip = state.trips.find(item => String(item.id) === draft.tripId);
  if (!trip || !canEditTrip(trip)) return;
  if (trip.secondary_color?.toLowerCase() === draft.color.toLowerCase()) {
    if (tripColorDraft === draft) tripColorDraft = null;
    return;
  }
  saveTripFields({ secondary_color: draft.color }, { summary: 'Cor da viagem alterada', tripId: draft.tripId })
    .catch(() => {})
    .finally(() => {
      if (tripColorDraft === draft) {
        tripColorDraft = null;
        if (state.activeTripId === draft.tripId) {
          const current = state.trips.find(item => String(item.id) === draft.tripId);
          if (current) syncTripHero(current);
        }
      }
    });
}

function scheduleTripColorSave() {
  const tripId = String(state.activeTripId || '');
  if (!tripId || !canEditActiveTrip()) return;
  const color = dom.tripPageColor.value;
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  if (tripColorDraft?.tripId !== tripId || tripColorDraft.color !== color) {
    tripColorDraft = { tripId, color };
  }
  dom.tripPage.style.setProperty('--trip-page-color', color);
  dom.tripPageColor.parentElement.style.setProperty('--trip-control-color', color);
  clearTimeout(tripColorSaveTimer);
  tripColorSaveTimer = setTimeout(savePendingTripColor, 850);
}

async function saveTripFields(changes, { syncDays = false, summary = 'Dados da viagem alterados', tripId: requestedTripId = state.activeTripId } = {}) {
  const tripId = String(requestedTripId || '');
  const task = tripFieldSaveTask.catch(() => {}).then(async () => {
    const trip = state.trips.find(item => String(item.id) === tripId);
    if (!trip) throw new Error('Viagem indisponível.');
    if (!canEditTrip(trip)) throw new Error('Você só pode visualizar esta viagem.');
    if (!syncDays && Object.entries(changes).every(([key, value]) => String(trip[key] ?? '') === String(value ?? ''))) return trip;
    const client = await trySupabase();
    if (!client) throw new Error('É necessária uma conexão para salvar a viagem.');
    const before = { name: trip.name, start_date: trip.start_date, day_count: tripDayCount(trip), secondary_color: trip.secondary_color };
    const orderedSchema = syncDays ? await supportsOrderedDaySchema(client) : true;
    const startDate = changes.start_date || trip.start_date;
    const dayCount = changes.day_count ?? tripDayCount(trip);
    const payload = { ...changes };
    if (syncDays && !orderedSchema) {
      delete payload.day_count;
      payload.end_date = addDaysToDate(startDate, dayCount - 1);
    }
    if (state.activeTripId === tripId) {
      dom.tripPageSaveStatus.dataset.kind = 'info';
      dom.tripPageSaveStatus.textContent = 'Salvando…';
    }
    const saved = await client.from('trips').update(payload).eq('id', tripId).select('id').single();
    if (saved.error) throw saved.error;
    if (syncDays) {
      const error = await syncTripDaysForCount(client, tripId, startDate, dayCount, orderedSchema);
      if (error) throw error;
    }
    Object.assign(trip, changes);
    if (syncDays) {
      trip.day_count = dayCount;
      trip.end_date = addDaysToDate(startDate, dayCount - 1);
      state.selectedYear = Number(String(startDate).slice(0, 4));
      state.tripDataCache.delete(tripId);
    }
    await offlineStore.replaceWorkspace(state.user.id, state.trips, [...state.passengers.values()].flat()).catch(console.warn);
    syncYearList();
    syncTripList();
    if (state.activeTripId === tripId) {
      syncTripHero(trip);
      if (syncDays) openTrip(tripId, { pushHistory: false, forceRefresh: true }).catch(console.warn);
    }
    const after = { name: trip.name, start_date: trip.start_date, day_count: tripDayCount(trip), secondary_color: trip.secondary_color };
    recordChange({ tripId, entityType: 'trip', entityId: tripId, action: 'update', summary, beforeState: before, afterState: after }).catch(console.warn);
    if (state.activeTripId === tripId) dom.tripPageSaveStatus.textContent = 'Salvo';
    return trip;
  });
  tripFieldSaveTask = task;
  return task.catch(error => {
    if (state.activeTripId === tripId) {
      dom.tripPageSaveStatus.dataset.kind = 'error';
      dom.tripPageSaveStatus.textContent = error.message || 'Não foi possível salvar.';
    }
    throw error;
  });
}

function showTripNameInput() {
  if (!canEditActiveTrip()) return;
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (!trip) return;
  dom.tripPageTitleInput.value = trip.name || '';
  dom.tripPageTitle.hidden = true;
  dom.tripPageTitleInput.hidden = false;
  dom.tripPageTitleInput.focus({ preventScroll: true });
  dom.tripPageTitleInput.select();
}

async function commitTripName() {
  if (dom.tripPageTitleInput.hidden) return;
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (!trip) return;
  const name = dom.tripPageTitleInput.value.trim();
  if (!name) {
    dom.tripPageSaveStatus.dataset.kind = 'error';
    dom.tripPageSaveStatus.textContent = 'O nome não pode ficar vazio.';
    return;
  }
  if (name !== trip.name) {
    try { await saveTripFields({ name }, { summary: `Viagem renomeada para “${name}”` }); }
    catch { return; }
  }
  dom.tripPageTitleInput.hidden = true;
  dom.tripPageTitle.hidden = false;
}

async function saveTripSchedule() {
  if (!canEditActiveTrip()) return false;
  const startDate = dom.tripStartDate.value;
  const dayCount = Number(dom.tripDayCount.value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(dayCount) || dayCount < 1 || dayCount > 365) {
    dom.tripPageSaveStatus.dataset.kind = 'error';
    dom.tripPageSaveStatus.textContent = 'Informe uma data e uma quantidade de 1 a 365 dias.';
    return false;
  }
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (!trip || (trip.start_date === startDate && tripDayCount(trip) === dayCount)) return true;
  try {
    await saveTripFields({ start_date: startDate, day_count: dayCount }, { syncDays: true, summary: 'Datas da viagem alteradas' });
    return true;
  } catch { return false; }
}

async function saveTrip() {
  const client = await trySupabase();
  if (!client) {
    dom.newTripMessage.textContent = 'Criar ou alterar a viagem requer conexão. O roteiro já salvo continua editável offline.';
    return;
  }

  const values = Object.fromEntries(new FormData(dom.newTripForm));
  const dayCount = Number(values.day_count);
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 365) {
    dom.newTripMessage.textContent = 'Informe uma quantidade de dias entre 1 e 365.';
    return;
  }
  if (!state.imageData) {
    dom.newTripMessage.textContent = 'Escolha a imagem da viagem.';
    return;
  }

  state.saving = true;
  setLoading(dom.saveNewTrip, true);

  try {
    const orderedSchema = await supportsOrderedDaySchema(client);
    const { payload } = tripPayloadFromForm(values, orderedSchema, !state.editingTripId);

    if (state.editingTripId) {
      const tripId = state.editingTripId;
      const previousTrip = state.trips.find(trip => String(trip.id) === String(tripId)) || null;
      const updated = await client.from('trips').update(payload).eq('id', tripId);
      if (updated.error) throw updated.error;

      const passengerError = await saveTripPassengers(client, tripId);
      if (passengerError) throw passengerError;

      const dayError = await syncTripDaysForCount(client, tripId, values.start_date, dayCount, orderedSchema);
      if (dayError) throw dayError;

      await recordChange({
        tripId,
        entityType: 'trip',
        entityId: tripId,
        action: 'update',
        summary: 'Configurações da viagem “' + (payload.name || previousTrip?.name || 'Viagem') + '” alteradas',
        beforeState: previousTrip ? {
          name: previousTrip.name,
          destination: previousTrip.destination,
          start_date: previousTrip.start_date,
          day_count: tripDayCount(previousTrip)
        } : null,
        afterState: {
          name: payload.name,
          destination: payload.destination,
          start_date: payload.start_date,
          day_count: dayCount
        }
      });

      state.selectedYear = Number(String(values.start_date).slice(0, 4));
      state.tripDataCache.delete(String(tripId));
      await loadTrips();

      state.saving = false;
      closeSheets();
      await openTrip(tripId, { pushHistory: false, forceRefresh: true });
      return;
    }

    const created = await client.from('trips').insert(payload).select().single();
    if (created.error) throw created.error;

    const trip = created.data;
    let failure = null;

    const member = await client.from('trip_members').insert({
      trip_id: trip.id,
      user_id: state.user.id,
      role: 'owner'
    });
    failure = member.error;

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
      const days = await client.from('trip_days').insert(createDays(trip.id, dayCount, values.start_date, orderedSchema));
      failure = days.error;
    }

    if (failure) {
      await client.from('trip_days').delete().eq('trip_id', trip.id);
      await client.from('passengers').delete().eq('trip_id', trip.id);
      await client.from('trip_members').delete().eq('trip_id', trip.id);
      await client.from('trips').delete().eq('id', trip.id);
      throw failure;
    }


    await recordChange({
      tripId: trip.id,
      entityType: 'trip',
      entityId: trip.id,
      action: 'create',
      summary: 'Viagem “' + trip.name + '” criada',
      beforeState: null,
      afterState: {
        name: trip.name,
        destination: trip.destination,
        start_date: trip.start_date,
        day_count: dayCount
      }
    });

    state.selectedYear = Number(String(values.start_date).slice(0, 4));
    await loadTrips();
    state.saving = false;
    closeSheets();
  } catch (error) {
    dom.newTripMessage.textContent = error.message || 'Não foi possível salvar a viagem.';
  } finally {
    state.saving = false;
    setLoading(dom.saveNewTrip, false);
  }
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
for (const tab of dom.tripTabs.querySelectorAll('[role="tab"]')) {
  tab.addEventListener('click', () => selectTripTab(tab.id.slice('trip_tab_'.length)));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...dom.tripTabs.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); tabs[next].click();
  });
}
dom.budgetAdd.addEventListener('click', () => openBudgetEditor());
dom.closeBudgetPage.addEventListener('click', navigateBackFromBudget);
dom.tripFilesInput.addEventListener('change', () => uploadTripFiles([...dom.tripFilesInput.files]).catch(error => setTripPanelStatus(dom.tripFilesStatus, error.message, 'error')));
if (dom.tripFileViewer) {
  dom.closeTripFileViewer.addEventListener('click', navigateBackFromTripFileViewer);
  dom.tripFileViewerDelete.addEventListener('click', deleteTripFileViewer);
  dom.tripFileViewerPrevious.addEventListener('click', () => { if (tripFileViewerState) showTripFileViewerIndex(tripFileViewerState.index - 1); });
  dom.tripFileViewerNext.addEventListener('click', () => { if (tripFileViewerState) showTripFileViewerIndex(tripFileViewerState.index + 1); });
  dom.tripFileViewer.addEventListener('cancel', event => { event.preventDefault(); navigateBackFromTripFileViewer(); });
  dom.tripFileViewer.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (!tripFileViewerState) return;
    event.preventDefault();
    showTripFileViewerIndex(tripFileViewerState.index + (event.key === 'ArrowRight' ? 1 : -1));
  });
  let tripFileViewerGesture = null;
  dom.tripFileViewerMedia.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    tripFileViewerGesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  dom.tripFileViewerMedia.addEventListener('pointerup', event => {
    if (!tripFileViewerGesture || tripFileViewerGesture.id !== event.pointerId) return;
    const dx = event.clientX - tripFileViewerGesture.x;
    const dy = event.clientY - tripFileViewerGesture.y;
    tripFileViewerGesture = null;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    if (!tripFileViewerState) return;
    event.preventDefault();
    showTripFileViewerIndex(tripFileViewerState.index + (dx < 0 ? 1 : -1));
  });
  dom.tripFileViewerMedia.addEventListener('pointercancel', () => { tripFileViewerGesture = null; });
}
dom.tripPageShare.addEventListener('click', openTripShare);
dom.closeTripShare.addEventListener('click', () => setActiveSheet('none'));
dom.tripShareScrim.addEventListener('click', () => setActiveSheet('none'));
dom.tripShareForm.addEventListener('submit', submitTripShare);
dom.tripPageTitle.addEventListener('click', showTripNameInput);
dom.tripPageTitleInput.addEventListener('blur', () => commitTripName().catch(console.warn));
dom.tripPageTitleInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); dom.tripPageTitleInput.blur(); }
  if (event.key === 'Escape') {
    dom.tripPageTitleInput.hidden = true;
    dom.tripPageTitle.hidden = false;
  }
});
function toggleTripDateEditor() {
  if (!canEditActiveTrip()) return;
  const trip = state.trips.find(item => String(item.id) === String(state.activeTripId));
  if (!trip) return;
  const open = dom.tripDateEditor.hidden;
  dom.tripDateEditor.hidden = !open;
  dom.tripPageDuration.setAttribute('aria-expanded', String(open));
  dom.tripPageDates.setAttribute('aria-expanded', String(open));
  if (open) {
    dom.tripStartDate.value = trip.start_date;
    dom.tripDayCount.value = String(tripDayCount(trip));
  }
}
dom.tripPageDuration.addEventListener('click', toggleTripDateEditor);
dom.tripPageDates.addEventListener('click', toggleTripDateEditor);
dom.tripStartDate.addEventListener('change', () => saveTripSchedule().catch(console.warn));
dom.tripDayCount.addEventListener('change', () => saveTripSchedule().catch(console.warn));
dom.tripDateDone.addEventListener('click', async () => {
  if (!await saveTripSchedule()) return;
  dom.tripDateEditor.hidden = true;
  dom.tripPageDuration.setAttribute('aria-expanded', 'false');
  dom.tripPageDates.setAttribute('aria-expanded', 'false');
});
dom.tripPageColor.addEventListener('input', scheduleTripColorSave);
dom.tripPageColor.addEventListener('change', scheduleTripColorSave);
dom.tripPageCoverInput.addEventListener('change', async () => {
  const file = dom.tripPageCoverInput.files?.[0];
  if (!file) return;
  try {
    const cover = await compressImage(file);
    await saveTripFields({ cover_url: cover }, { summary: 'Foto da viagem alterada' });
  } catch (error) { console.warn('Foto da viagem não salva', error); }
  finally { dom.tripPageCoverInput.value = ''; }
});
dom.tripPagePassengers.addEventListener('click', openTripPassengers);
dom.tripPassengerClose.addEventListener('click', () => closeTripPassengers().catch(console.warn));
dom.closeDayPage.addEventListener('click', navigateBackFromDay);
dom.dayMapToggle.addEventListener('click', () => setDayMapExpanded(dom.dayMapSection.dataset.expanded !== 'true'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && dom.dayMapSection.dataset.expanded === 'true') setDayMapExpanded(false);
});
dom.addDayPageActivity.addEventListener('click', addInlineDayActivity);
dom.dayAttachmentsButton.addEventListener('click', openDayAttachments);
dom.closeDayAttachments.addEventListener('click', closeDayAttachments);
dom.dayAttachmentsScrim.addEventListener('click', closeDayAttachments);
dom.dayAttachmentsInput.addEventListener('change', event => uploadDayAttachments([...event.target.files]));
dom.dayPage.addEventListener('scroll', updateAgendaAddStickyState, { passive: true });
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
window.addEventListener('popstate', event => {
  if (event.state?.view === 'trip-file') {
    restoreTripFileViewer(event.state).catch(error => console.warn('Não foi possível reabrir o arquivo', error));
    return;
  }
  if (dom.tripFileViewer?.open) {
    const originView = tripFileViewerState?.originView || tripFileViewerLeavingView;
    const sameTrip = String(state.activeTripId) === String(event.state?.tripId);
    const sameDay = String(state.activeDayId) === String(event.state?.dayId);
    if (sameTrip && ((event.state?.view === 'trip' && originView === 'trip')
      || (event.state?.view === 'day' && originView === 'day' && sameDay))) {
      closeTripFileViewer();
      return;
    }
    closeTripFileViewer({ immediate: true });
  }
  if (event.state?.view === 'budget-item' && event.state.tripId) {
    const reopen = () => {
      const item = event.state.itemId == null ? null : (state.budgetByTrip.get(String(event.state.tripId)) || []).find(row => String(row.id) === String(event.state.itemId));
      if (event.state.itemId == null || item) openBudgetEditor(item, { pushHistory: false });
      else closeBudgetPage();
    };
    if (String(state.activeTripId) !== String(event.state.tripId)) openTrip(event.state.tripId, { pushHistory: false }).then(reopen);
    else reopen();
  } else if (event.state?.view === 'day' && event.state.dayId) {
    closeBudgetPage();
    if (event.state.tripId && String(state.activeTripId) !== String(event.state.tripId)) openTrip(event.state.tripId, { pushHistory: false }).then(() => openDayPage(event.state.dayId, { pushHistory: false }));
    else openDayPage(event.state.dayId, { pushHistory: false });
  } else if (event.state?.view === 'trip' && event.state.tripId) {
    closeBudgetPage();
    closeDayPage();
    if (String(state.activeTripId) !== String(event.state.tripId) || !state.tripDays.length) openTrip(event.state.tripId, { pushHistory: false });
  } else closeTripPage();
});
dom.profileButton.addEventListener('click', openProfile);
dom.newTripButton.addEventListener('click', createTripInstantly);
dom.emptyNewTripButton.addEventListener('click', createTripInstantly);
dom.closeNewTrip.addEventListener('click', closeSheets);
dom.closeProfile.addEventListener('click', closeSheets);
dom.homeChatgptButton.addEventListener('click', openChatgptIntegration);
dom.chatgptButton.addEventListener('click', openChatgptIntegration);
dom.closeChatgpt.addEventListener('click', () => setActiveSheet('profile'));
dom.connectChatgpt.addEventListener('click', connectChatgpt);
dom.copyMcpUrl.addEventListener('click', copyMcpUrl);
dom.changeLogButton.addEventListener('click', openChangeLog);
dom.closeChangeLog.addEventListener('click', () => setActiveSheet('profile'));
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
  state.tripRoles.clear(); state.tripOwners.clear();
  state.savedPassengers = [];
  state.profileSavedPassengers = [];
  state.tripDataCache.clear();
  state.tripDataLoads.clear();
  state.budgetByTrip.clear(); state.tripFilesByTrip.clear(); state.tripFileDeckIndexes.clear(); state.tripTabScroll.clear();
  syncTripList();
  closeSheets();
  setSessionView('anonymous');
});
dom.deleteAccountButton.addEventListener('click', deleteAccount);

for (const option of dom.tripColorPalette.querySelectorAll('.trip-color-option')) option.addEventListener('click', () => selectTripColor(option.dataset.color));
dom.tripColorCustom.addEventListener('input', () => selectTripColor(dom.tripColorCustom.value, true));
dom.addTripPassenger.addEventListener('click', addTripPassenger);
dom.tripShareButton?.addEventListener('click', shareActiveTrip);
dom.addProfileSavedPassenger.addEventListener('click', addProfileSavedPassenger);

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

let signupAvatar = null;
let signupAvatarPreview = '';
let signupAvatarPreparing = null;
let signupAvatarSelection = 0;

function clearSignupAvatar() {
  if (signupAvatarPreview) URL.revokeObjectURL(signupAvatarPreview);
  signupAvatar = null;
  signupAvatarPreview = '';
  dom.signupPhotoPreview.hidden = true;
  dom.signupPhotoPreview.removeAttribute('src');
  dom.signupPhotoPlaceholder.hidden = false;
}

dom.signupPhotoInput.addEventListener('change', async () => {
  const file = dom.signupPhotoInput.files?.[0];
  if (!file) return;
  const button = dom.signupForm.querySelector('.auth-submit');
  button.disabled = true;
  dom.signupMessage.textContent = '';
  const selection = ++signupAvatarSelection;
  const preparation = prepareAvatar(file);
  signupAvatarPreparing = preparation;
  try {
    const prepared = await preparation;
    if (selection !== signupAvatarSelection) { URL.revokeObjectURL(prepared.preview); return; }
    clearSignupAvatar();
    signupAvatar = prepared.blob;
    signupAvatarPreview = prepared.preview;
    dom.signupPhotoPreview.src = prepared.preview;
    dom.signupPhotoPreview.hidden = false;
    dom.signupPhotoPlaceholder.hidden = true;
  } catch {
    if (selection === signupAvatarSelection) {
      dom.signupPhotoInput.value = '';
      dom.signupMessage.textContent = 'Não foi possível preparar essa foto. Escolha outra imagem.';
    }
  } finally {
    if (signupAvatarPreparing === preparation) {
      signupAvatarPreparing = null;
      button.disabled = false;
    }
  }
});

let pendingSignupAvatarTask = null;
async function applyPendingSignupAvatar() {
  if (!state.user?.email) return;
  if (pendingSignupAvatarTask) return pendingSignupAvatarTask;
  pendingSignupAvatarTask = (async () => {
    const user = state.user;
    const key = `signup_avatar:${user.email.trim().toLowerCase()}`;
    const avatar = await offlineStore.getMeta(key);
    if (!avatar) return;
    if (state.profile?.avatar_path) { await offlineStore.deleteMeta(key); return; }
    const client = await trySupabase();
    if (!client) return;
    const { data, error: authError } = await client.auth.getUser();
    if (authError || data.user?.id !== user.id) return;
    const avatarPath = `${user.id}/avatar-${Date.now()}.jpg`;
    const upload = await client.storage.from('profile-photos').upload(avatarPath, avatar, { contentType: 'image/jpeg', upsert: false });
    if (upload.error) throw upload.error;
    const saved = await client.from('passenger_profiles').upsert({
      user_id: user.id,
      name: state.profile?.name || user.user_metadata?.name || user.email.split('@')[0],
      birth_date: state.profile?.birth_date || null,
      avatar_path: avatarPath,
      updated_at: new Date().toISOString()
    }).select().single();
    if (saved.error) throw saved.error;
    if (state.user?.id !== user.id) return;
    state.profile = saved.data;
    const signed = await client.storage.from('profile-photos').createSignedUrl(avatarPath, 3600);
    if (!signed.error) state.profile.avatar_url = signed.data.signedUrl;
    await offlineStore.saveProfile(state.profile);
    await offlineStore.deleteMeta(key);
    syncProfileUI();
  })().finally(() => { pendingSignupAvatarTask = null; });
  return pendingSignupAvatarTask;
}

function setAuthMode(mode) {
  const signup = mode === 'signup';
  dom.authCard.dataset.mode = signup ? 'signup' : 'login';
  dom.authIntro.textContent = signup ? 'Comece a planejar suas próximas viagens.' : 'Suas viagens começam muito antes do embarque.';
  dom.authForm.setAttribute('aria-hidden', String(signup));
  dom.signupForm.setAttribute('aria-hidden', String(!signup));
  dom.authForm.inert = signup;
  dom.signupForm.inert = !signup;
  dom.authMessage.textContent = '';
  dom.signupMessage.textContent = '';
}

async function enterWithUser(user) {
  state.user = user;
  await offlineStore.cacheSession(user);
  await loadProfile();
  await loadTrips();
  setSessionView('authenticated');
  applyPendingSignupAvatar().catch(error => console.warn('Foto de cadastro aguardando envio', error));
  refreshSyncStatus().catch(console.warn);
  cacheCompleteWorkspace().catch(error => console.warn('Snapshot offline incompleto', error));
}

dom.showSignup.addEventListener('click', () => setAuthMode('signup'));
dom.showLogin.addEventListener('click', () => setAuthMode('login'));
dom.authForm.addEventListener('submit', async event => {
  event.preventDefault(); dom.authMessage.textContent = ''; dom.authMessage.dataset.kind = 'error';
  const button = dom.authForm.querySelector('.auth-submit');
  button.disabled = true;
  try {
    const client = await trySupabase();
    if (!client) { dom.authMessage.textContent = 'Sem conexão. Abra o app normalmente se este aparelho já tiver uma cópia da viagem.'; return; }
    const result = await client.auth.signInWithPassword(Object.fromEntries(new FormData(dom.authForm)));
    if (result.error) { dom.authMessage.textContent = result.error.message; return; }
    await enterWithUser(result.data.user);
  } catch (error) {
    dom.authMessage.textContent = error.message || 'Não foi possível entrar.';
    setSessionView('anonymous');
  } finally { button.disabled = false; }
});

dom.signupForm.addEventListener('submit', async event => {
  event.preventDefault();
  dom.signupMessage.textContent = '';
  const fields = new FormData(dom.signupForm);
  const name = String(fields.get('name') || '').trim();
  const email = String(fields.get('email') || '').trim();
  const password = String(fields.get('password') || '');
  if (!name) { dom.signupMessage.textContent = 'Informe seu nome.'; return; }
  if (password !== fields.get('confirm_password')) { dom.signupMessage.textContent = 'As senhas não coincidem.'; return; }

  const button = dom.signupForm.querySelector('.auth-submit');
  button.disabled = true;
  let accountCreated = false;
  try {
    if (signupAvatarPreparing) await signupAvatarPreparing;
    const client = await trySupabase();
    if (!client) throw new Error('A criação de conta precisa de conexão com a internet.');
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: new URL('./', window.location.href).href
      }
    });
    if (error) throw error;
    accountCreated = true;
    let avatarSaved = false;
    if (signupAvatar) {
      try {
        await offlineStore.setMeta(`signup_avatar:${email.toLowerCase()}`, signupAvatar);
        avatarSaved = true;
      } catch (storageError) { console.warn('Não foi possível guardar a foto de cadastro', storageError); }
    }
    if (data.session && data.user) {
      dom.signupForm.reset();
      clearSignupAvatar();
      await enterWithUser(data.user);
      return;
    }
    const photoUnavailable = !!signupAvatar && !avatarSaved;
    dom.authForm.querySelector('[name="email"]').value = email;
    dom.signupForm.reset();
    clearSignupAvatar();
    setAuthMode('login');
    dom.authMessage.dataset.kind = 'success';
    dom.authMessage.textContent = `Conta criada. Confirme seu e-mail pelo link que enviamos e depois entre aqui.${avatarSaved ? ' Sua foto será adicionada quando você entrar neste aparelho.' : photoUnavailable ? ' Não foi possível guardar sua foto; adicione-a no perfil depois de entrar.' : ''}`;
  } catch (error) {
    dom.signupMessage.textContent = accountCreated ? 'Conta criada, mas não foi possível abrir o perfil. Tente entrar novamente.' : error.message || 'Não foi possível criar a conta.';
  } finally { button.disabled = false; }
});

async function boot() {
  let bootSettled = false;
  const bootWatchdog = setTimeout(() => {
    if (bootSettled) return;
    const cached = state.user;
    if (cached) {
      setSessionView('authenticated');
      setSplashStatus('Abrindo com os dados disponíveis…');
    } else {
      setSessionView('anonymous');
      setSplashStatus('A inicialização demorou demais. Tente entrar novamente.');
    }
  }, 5000);

  try {
    setSplashStatus('Preparando armazenamento local…');
    await offlineStore.open();
    await offlineStore.discardHistoryBefore(HISTORY_RESET_AT);
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
    bootSettled = true;
    clearTimeout(bootWatchdog);
    document.body.dataset.appReady = 'true';
  }
}

window.addEventListener('offline', () => { refreshSyncStatus().catch(console.warn); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && tripColorSaveTimer) savePendingTripColor();
  if (document.visibilityState === 'visible' && state.user) {
    if (navigator.onLine) loadTrips().catch(error => console.warn('Viagens compartilhadas aguardando atualização', error));
    if (navigator.onLine && document.body.dataset.activeSheet !== 'profile') loadProfile().catch(error => console.warn('Foto do perfil aguardando atualização', error));
    flushOutbox().catch(error => console.warn('Fila local aguardando sincronização', error));
    refreshChatgptConnection().catch(console.warn);
  }
});
dom.syncStatus.addEventListener('click', () => {
  flushOutbox().catch(error => console.warn('Fila local aguardando sincronização', error));
});
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
    state.user = null; state.profile = null; state.trips = []; state.passengers.clear(); state.tripRoles.clear(); state.tripOwners.clear(); state.savedPassengers = []; state.profileSavedPassengers = []; state.tripDataCache.clear(); state.tripDataLoads.clear(); state.budgetByTrip.clear(); state.tripFilesByTrip.clear(); state.tripFileDeckIndexes.clear(); state.tripTabScroll.clear();
    syncTripList(); closeSheets(); setSessionView('anonymous');
  }))
  .catch(() => {});

boot();
