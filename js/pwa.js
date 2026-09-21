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
  const MAX_DEFER_MS = 60 * 1000; // tope de espera cuando el usuario esta escribiendo
  const RELOAD_GUARD_KEY = 'combuasigna-hard-reload';
  let deferStartedAt = 0;         // desde cuando se esta aplazando la recarga
  let minVersionRequired = '';    // por debajo de esto no se puede seguir trabajando

  // Compara por numero, no por texto: "2.10.0" es mayor que "2.9.1".
  function compareVersions(a, b) {
    const pa = String(a || '').split('.');
    const pb = String(b || '').split('.');
    const total = Math.max(pa.length, pb.length);
    for (let i = 0; i < total; i++) {
      const da = parseInt(pa[i], 10) || 0;
      const db = parseInt(pb[i], 10) || 0;
      if (da !== db) return da < db ? -1 : 1;
    }
    return 0;
  }

  // Version demasiado vieja para seguir trabajando: la actualizacion se vuelve
  // obligatoria y ya no se puede aplazar.
  function isBelowMinVersion(current, minVersion) {
    if (!minVersion || !current || current === 'dev') return false;
    return compareVersions(current, minVersion) < 0;
  }

  // Antes de recargar, darle la oportunidad a la app de confirmar lo que tenga
  // sin guardar. Si no existe la funcion (version vieja), simplemente sigue.
  async function flushPendingWork() {
    try {
      if (typeof window.flushPendingTargetSave === 'function') {
        await window.flushPendingTargetSave();
      }
    } catch (err) {
      console.warn('[pwa] No se pudo confirmar el guardado pendiente antes de recargar:', err);
    }
  }

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

  // Detecta el caso peor: version.json ya anuncia la version nueva, pero el
  // navegador sigue ejecutando los scripts viejos que tenia en cache. Ahi la
  // pildora miente y la deteccion normal no ve nada raro, porque ambos numeros
  // salen del mismo version.json. APP_CODE_VERSION viaja dentro del codigo, asi
  // que comparandola se descubre el desfase y se limpia cache + Service Worker.
  // La guarda en sessionStorage corta cualquier bucle si el despliegue quedara
  // a medias (por ejemplo, index.html publicado y js/ todavia no).
  async function hardReloadIfStaleCode(publishedVersion) {
    const running = window.APP_CODE_VERSION;
    if (!running || !publishedVersion || running === publishedVersion) {
      try { sessionStorage.removeItem(RELOAD_GUARD_KEY); } catch (_) {}
      return false;
    }
    let intentos = 0;
    try { intentos = parseInt(sessionStorage.getItem(RELOAD_GUARD_KEY), 10) || 0; } catch (_) {}
    if (intentos >= 2) {
      console.warn('[pwa] Codigo v' + running + ' frente a version publicada v' + publishedVersion +
                   ': no se pudo refrescar solo. Se avisa al usuario.');
      showUpdateBanner(publishedVersion);
      return false;
    }
    try { sessionStorage.setItem(RELOAD_GUARD_KEY, String(intentos + 1)); } catch (_) {}
    console.warn('[pwa] Ejecutando codigo v' + running + ' con version publicada v' + publishedVersion +
                 '. Recarga limpia.');
    showUpdatingOverlay(publishedVersion);
    await flushPendingWork();
    try {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('combuasigna-')).map((n) => caches.delete(n)));
    } catch (_) { /* sin Cache API: la recarga siguiente lo resuelve */ }
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch (_) { /* idem */ }
    refreshing = true;
    window.location.reload();
    return true;
  }

  // Compara version.json (siempre fresco) contra la version cargada.
  // Si difiere, muestra el banner aunque el usuario no haya recargado.
  // Tambien pide al SW que revise para tener lista la nueva copia.
  async function checkForNewVersion() {
    if (document.hidden) return;
    try {
      const info = await loadVersion();
      const remote = info && info.version;
      if (info && info.minVersion) minVersionRequired = info.minVersion;
      if (remote && currentVersion && remote !== currentVersion) {
        newVersionDetected = remote;
        // Si la version con la que se abrio la pestana quedo por debajo del
        // minimo exigido, la actualizacion ya no es opcional.
        applyUpdateAndReload(remote, isBelowMinVersion(currentVersion, minVersionRequired));
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

  function showUpdatingOverlay(toVersion, obligatoria) {
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
      (toVersion ? ' v' + toVersion : '') + '</div>' +
      (obligatoria
        ? '<div style="font-size:12px;color:#b45309;margin-top:8px;max-width:260px">' +
          'Esta actualizacion es obligatoria: la version anterior no puede seguir ' +
          'trabajando.</div>'
        : '') +
      '</div>';
    document.body.appendChild(ov);
  }

  // Activa el Service Worker nuevo (si lo hay) y recarga la pagina sola.
  async function applyUpdateAndReload(toVersion, obligatoria) {
    const forzar = !!obligatoria;
    if (!AUTO_RELOAD && !forzar) { showUpdateBanner(toVersion); return; }
    if (updating) return;
    // Estar escribiendo aplaza la recarga para no perder lo tecleado, pero solo
    // hasta cierto punto: antes se reintentaba cada 15 s indefinidamente, asi
    // que un cursor olvidado en un campo dejaba al usuario en la version vieja
    // para siempre. Una actualizacion obligatoria no se aplaza nunca.
    if (!forzar && isUserBusyTyping()) {
      if (!deferStartedAt) deferStartedAt = Date.now();
      if (Date.now() - deferStartedAt < MAX_DEFER_MS) {
        showUpdateBanner(toVersion);
        if (updateDeferredTimer) clearTimeout(updateDeferredTimer);
        updateDeferredTimer = setTimeout(() => applyUpdateAndReload(toVersion, forzar), 15000);
        return;
      }
      // Se agoto el plazo: se suelta el campo y se actualiza igual.
      try { if (document.activeElement) document.activeElement.blur(); } catch (_) {}
    }
    updating = true;
    hideUpdateBanner();
    showUpdatingOverlay(toVersion, forzar);
    // Confirmar lo que quede sin guardar antes de que la pagina se vaya.
    await flushPendingWork();
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
    const obligatoria = () => isBelowMinVersion(currentVersion, minVersionRequired);
    if (reg.waiting && navigator.serviceWorker.controller) {
      applyUpdateAndReload(newVersionDetected, obligatoria());
    }
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          applyUpdateAndReload(newVersionDetected, obligatoria());
        }
      });
    });
  }

  async function activateWaitingAndReload() {
    await flushPendingWork();
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
    minVersionRequired = info.minVersion || '';
    paintVersion(info);
    // Si los scripts que se acaban de ejecutar son de otra version, no sirve de
    // nada seguir: se recarga limpio y esta pasada termina aqui.
    const recargando = await hardReloadIfStaleCode(info.version);
    if (recargando) return;
    register(currentVersion);
    // Al volver el foco a la pestana, revisar enseguida si hay version nueva.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForNewVersion();
    });
  });
})();
