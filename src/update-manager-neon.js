import { offlineStore } from '../experiments/neon-pilot/app/offline-store-neon.js?v=20261023-neon-1';
import { offlineStore as legacyStore } from './offline-store.js?v=20261007-59';

// A troca da versão é adiada durante edições e sincronizações locais.
const SW_URL = './sw.js?v=20261023-111-rings';
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const RESUME_WINDOW_MS = 25 * 1000;
let registration;
let activationRequested = false;
let reloadPending = false;
let lastHiddenAt = 0;
let autoUpdateUntil = 0;
let checkInProgress = false;
let banner;
const hadControllerOnLoad = Boolean(navigator.serviceWorker?.controller);

function hasWaitingUpdate() {
  return Boolean(registration?.waiting && navigator.serviceWorker.controller);
}

async function canSwitchVersions() {
  const body = document.body;
  if (!navigator.onLine || document.visibilityState !== 'visible' || body?.dataset.appReady !== 'true') return false;
  if (body.dataset.session !== 'authenticated' || body.dataset.activeSheet !== 'none' || body.dataset.editing !== 'false') return false;
  for (const key of ['tripPage', 'dayPage', 'budgetPage', 'dayAttachments']) {
    if (body.dataset[key] !== 'closed') return false;
  }
  if (document.querySelector('dialog[open], #trip_file_viewer[aria-hidden="false"], #trip_share_sheet[aria-hidden="false"], #day_edit_sheet[aria-hidden="false"], #place_search_sheet[aria-hidden="false"]')) return false;
  if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return false;
  try {
    // Uma falha de leitura nunca autoriza descartar trabalho em andamento.
    return (await offlineStore.countOutbox()) === 0 && (await legacyStore.countOutbox()) === 0;
  } catch {
    return false;
  }
}

function ensureBanner() {
  if (banner) return banner;
  banner = document.createElement('div');
  banner.className = 'viaggio-update-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'status');
  const label = document.createElement('span');
  label.textContent = 'Nova versão do Viaggio disponível';
  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = 'Atualizar';
  action.addEventListener('click', () => { applyUpdate().catch(console.warn); });
  banner.append(label, action);
  document.body.append(banner);
  return banner;
}

async function refreshBanner() {
  if (!hasWaitingUpdate() && !reloadPending) {
    if (banner) banner.hidden = true;
    return;
  }
  const safe = await canSwitchVersions();
  ensureBanner().hidden = !safe;
}

async function applyUpdate() {
  if (activationRequested || !(await canSwitchVersions())) {
    await refreshBanner();
    return;
  }
  if (reloadPending) {
    location.reload();
    return;
  }
  if (!hasWaitingUpdate()) return;
  const waiting = registration.waiting;
  if (!waiting) return;
  activationRequested = true;
  if (banner) banner.hidden = true;
  waiting.postMessage({ type: 'VIAGGIO_ACTIVATE_UPDATE' });
}

async function updateAvailable() {
  if (Date.now() < autoUpdateUntil && await canSwitchVersions()) {
    await applyUpdate();
  } else {
    await refreshBanner();
  }
}

async function checkForUpdates() {
  if (!registration || !navigator.onLine || checkInProgress) return;
  checkInProgress = true;
  try {
    await registration.update();
    if (hasWaitingUpdate() || reloadPending) await updateAvailable();
  } catch (error) {
    // Offline: manter o aplicativo funcional, sem trocar a versão.
    console.warn('Verificação da versão do Viaggio indisponível', error);
  } finally {
    checkInProgress = false;
  }
}

function watchInstalling(worker) {
  if (!worker) return;
  const onStateChange = () => {
    if (worker.state === 'installed' && hasWaitingUpdate()) {
      updateAvailable().catch(console.warn);
    }
  };
  worker.addEventListener('statechange', onStateChange);
  onStateChange();
}

async function start() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerOnLoad) return; // Primeira instalação não exige reload.
    const wasRequested = activationRequested;
    reloadPending = true;
    activationRequested = false;
    if (wasRequested) {
      canSwitchVersions().then(safe => {
        if (safe) location.reload();
        else refreshBanner().catch(console.warn);
      }).catch(console.warn);
    } else {
      updateAvailable().catch(console.warn);
    }
  });
  try {
    registration = await navigator.serviceWorker.register(SW_URL, { updateViaCache: 'none' });
    registration.addEventListener('updatefound', () => watchInstalling(registration.installing));
    watchInstalling(registration.installing);
    if (hasWaitingUpdate()) await refreshBanner();
  } catch (error) {
    console.warn('Atualização automática do Viaggio indisponível', error);
    return;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      lastHiddenAt = Date.now();
      if (banner) banner.hidden = true;
    } else {
      if (lastHiddenAt && Date.now() - lastHiddenAt >= 15_000) autoUpdateUntil = Date.now() + RESUME_WINDOW_MS;
      checkForUpdates().catch(console.warn);
    }
  });
  window.addEventListener('online', () => checkForUpdates().catch(console.warn));
  window.addEventListener('pageshow', event => {
    if (event.persisted) checkForUpdates().catch(console.warn);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') checkForUpdates().catch(console.warn);
  }, CHECK_INTERVAL_MS);
  setInterval(() => {
    if (hasWaitingUpdate() || reloadPending) updateAvailable().catch(console.warn);
  }, 5_000);
  setTimeout(() => checkForUpdates().catch(console.warn), 4_000);
}

start();
