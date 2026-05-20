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

  function showUpdateBanner() {
    const banner = document.getElementById('pwaUpdateBanner');
    if (!banner) return;
    banner.classList.remove('hidden');
    banner.setAttribute('aria-hidden', 'false');
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

      // Revisar updates periodicamente mientras la pestana esta abierta.
      setInterval(() => {
        registration && registration.update().catch(() => {});
      }, 60 * 60 * 1000); // cada hora
    } catch (err) {
      console.warn('[pwa] Fallo el registro del Service Worker:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindBannerButtons();
    const info = await loadVersion();
    paintVersion(info);
    register(info.version || 'dev');
  });
})();
