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
  let updating = false;           // ya se inicio el proceso de auto-actualizacion
  let updateDeferredTimer = null; // reintento cuando el usuario esta escribiendo
  const VERSION_POLL_MS = 2 * 60 * 1000; // revisar version.json cada 2 min
  const AUTO_RELOAD = true;       // recargar solo (sin clic) al detectar version nueva

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
        applyUpdateAndReload(remote);
      }
    } catch (_) { /* sin red: se reintenta en el proximo ciclo */ }
    if (registration) registration.update().catch(() => {});
  }

  // No interrumpir a un usuario que esta escribiendo/seleccionando (evita perder
  // lo que esta tecleando). En ese caso se difiere la recarga unos segundos.
  function isUserBusyTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function showUpdatingOverlay(toVersion) {
    if (document.getElementById('pwaUpdatingOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'pwaUpdatingOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55)';
    ov.innerHTML =
      '<div style="background:#fff;color:#0f172a;border-radius:14px;padding:22px 28px;text-align:center;' +
      'box-shadow:0 20px 50px rgba(0,0,0,.3);border-top:6px solid #2563eb;font-family:system-ui,Segoe UI,sans-serif">' +
      '<div style="font-size:32px;line-height:1">&#8635;</div>' +
      '<div style="font-weight:800;margin:8px 0 4px">Actualizando&hellip;</div>' +
      '<div style="font-size:13px;color:#334155">Cargando la ultima version' +
      (toVersion ? ' v' + toVersion : '') + '</div></div>';
    document.body.appendChild(ov);
  }

  // Activa el Service Worker nuevo (si lo hay) y recarga la pagina sola.
  function applyUpdateAndReload(toVersion) {
    if (!AUTO_RELOAD) { showUpdateBanner(toVersion); return; }
    if (updating) return;
    if (isUserBusyTyping()) {
      // Mostrar el banner por si quiere actualizar ya, y reintentar luego.
      showUpdateBanner(toVersion);
      if (updateDeferredTimer) clearTimeout(updateDeferredTimer);
      updateDeferredTimer = setTimeout(() => applyUpdateAndReload(toVersion), 15000);
      return;
    }
    updating = true;
    showUpdatingOverlay(toVersion);
    // Si hay un SW nuevo esperando, activarlo: dispara controllerchange -> reload.
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Respaldo: si en 3.5s no hubo controllerchange, recargar de todos modos.
    setTimeout(() => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    }, 3500);
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
      applyUpdateAndReload(newVersionDetected);
    }
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          applyUpdateAndReload(newVersionDetected);
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
