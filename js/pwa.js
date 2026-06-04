/*
 * pwa.js - Registro de Service Worker y manejo de updates.
 *
 * Flujo:
 *   1. Lee version.json (siempre fresco, sin cache HTTP).
 *   2. Pinta la version en el pill #lblAppVersion.
 *   3. Registra service-worker.js?v=<version>.
 *   4. Si el navegador detecta un SW nuevo en estado "installed" mientras
 *      ya hay uno controlando la pagina, muestra el banner #pwaUpdateBanner.
 *   5. Al hacer click en "Recargar", manda SKIP_WAITING al SW y recarga.
 */

(function () {
  const VERSION_URL = './version.json';
  const SW_URL = './service-worker.js';

  let refreshing = false;
  let registration = null;
  let currentVersion = null;      // version con la que se cargo la pagina
  let newVersionDetected = null;  // version remota detectada como mas nueva
  const VERSION_POLL_MS = 2 * 60 * 1000; // revisar version.json cada 2 min

  async function loadVersion() {
    try {
      const res = await fetch(VERSION_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      console.warn('[pwa] No se pudo leer version.json:', err);
      return { version: 'dev', buildDate: '' };
    }
  }

  function paintVersion(info) {
    const pill = document.getElementById('lblAppVersion');
    if (pill && info && info.version) {
      pill.textContent = 'v' + info.version;
      pill.title = info.buildDate
        ? 'Compilado: ' + info.buildDate
        : 'Version actual';
    }
  }

  function showUpdateBanner(newVersion) {
    const banner = document.getElementById('pwaUpdateBanner');
    if (!banner) return;
    // Si conocemos la version nueva, la mostramos en el mensaje.
    const msg = document.getElementById('pwaUpdateMsg');
    if (msg && newVersion) {
      const from = currentVersion ? 'v' + currentVersion + ' → ' : '';
      msg.textContent = 'Actualiza ' + from + 'v' + newVersion + ' para trabajar con la ultima version.';
    }
    banner.classList.remove('hidden');
    banner.setAttribute('aria-hidden', 'false');
  }

  // Compara version.json (siempre fresco) contra la version cargada.
  // Si difiere, muestra el banner aunque el usuario no haya recargado.
  // Tambien pide al SW que revise para tener lista la nueva copia.
  async function checkForNewVersion() {
    if (document.hidden) return;
    try {
      const info = await loadVersion();
      const remote = info && info.version;
      if (remote && currentVersion && remote !== currentVersion) {
        newVersionDetected = remote;
        showUpdateBanner(remote);
      }
    } catch (_) { /* sin red: se reintenta en el proximo ciclo */ }
    if (registration) registration.update().catch(() => {});
  }

  function hideUpdateBanner() {
    const banner = document.getElementById('pwaUpdateBanner');
    if (!banner) return;
    banner.classList.add('hidden');
    banner.setAttribute('aria-hidden', 'true');
  }

  function watchWaitingWorker(reg) {
    if (!reg) return;
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner();
    }
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner();
        }
      });
    });
  }

  function activateWaitingAndReload() {
    if (!registration || !registration.waiting) {
      window.location.reload();
      return;
    }
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  function bindBannerButtons() {
    const reload = document.getElementById('pwaUpdateReload');
    const later = document.getElementById('pwaUpdateLater');
    if (reload) reload.addEventListener('click', activateWaitingAndReload);
    if (later) later.addEventListener('click', hideUpdateBanner);
  }

  async function register(version) {
    if (!('serviceWorker' in navigator)) {
      console.info('[pwa] Service Worker no soportado en este navegador.');
      return;
    }
    try {
      registration = await navigator.serviceWorker.register(
        SW_URL + '?v=' + encodeURIComponent(version),
        { scope: './' }
      );
      watchWaitingWorker(registration);

      // Si el controller cambia (porque hicimos SKIP_WAITING), recargamos.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // Revisar la version periodicamente mientras la pestana esta abierta,
      // para avisar de una nueva version sin que el usuario tenga que recargar.
      setInterval(checkForNewVersion, VERSION_POLL_MS);
    } catch (err) {
      console.warn('[pwa] Fallo el registro del Service Worker:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindBannerButtons();
    const info = await loadVersion();
    currentVersion = info.version || 'dev';
    paintVersion(info);
    register(currentVersion);
    // Al volver el foco a la pestana, revisar enseguida si hay version nueva.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForNewVersion();
    });
  });
})();
