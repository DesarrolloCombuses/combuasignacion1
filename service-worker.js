/*
 * Service Worker - CombuAsigna
 *
 * La version se inyecta al registrar el SW desde el cliente:
 *   navigator.serviceWorker.register('./service-worker.js?v=1.2.3')
 *
 * El SW lee ?v=... de su propia URL y arma un cache name versionado.
 * Cuando subes una nueva version solo necesitas editar version.json:
 * el cliente leera la nueva version y registrara el SW con un query
 * distinto, el navegador lo detecta como nuevo, se instala en paralelo,
 * y avisa al cliente para que muestre el banner de "Recargar".
 */

const SW_URL = new URL(self.location.href);
const APP_VERSION = SW_URL.searchParams.get('v') || 'dev';
const SHELL_CACHE = `combuasigna-shell-v${APP_VERSION}`;
const RUNTIME_CACHE = `combuasigna-runtime-v${APP_VERSION}`;

// Recursos propios que conforman el app-shell (mismo origen).
// Si agregas archivos nuevos a la app, sumalos aqui.
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.json',
  './css/styles.css',
  './js/main.js',
  './js/functions.js',
  './js/pwa.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

// Origenes externos que NUNCA deben cachearse (datos en vivo).
const NETWORK_ONLY_HOSTS = [
  'supabase.co',
  'supabase.in'
];

// CDNs cuyos assets son seguros de cachear (versiones fijas en la URL).
const CACHEABLE_CDN_HOSTS = [
  'cdn.jsdelivr.net'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // addAll falla atomico: si un asset no carga, no se instala el SW.
      // Usamos requests con cache:'reload' para evitar HTTP cache stale.
      const requests = SHELL_ASSETS.map((url) => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests);
    })
  );
  // NO hacemos skipWaiting aqui: queremos que el cliente decida cuando activar.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) =>
            name.startsWith('combuasigna-') &&
            name !== SHELL_CACHE &&
            name !== RUNTIME_CACHE
          )
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: APP_VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  // 1) Supabase y APIs en vivo: siempre red, nunca cache.
  if (NETWORK_ONLY_HOSTS.some((host) => url.hostname.endsWith(host))) {
    return;
  }

  // 2) version.json: siempre red primero (asi detectamos updates).
  //    Si falla la red, caemos al cache (modo offline).
  if (url.origin === self.location.origin && url.pathname.endsWith('/version.json')) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // 3) Navegacion (recarga de pestana): network-first sobre index.html.
  //    Asi siempre intentamos traer el HTML mas reciente.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, SHELL_CACHE, './index.html'));
    return;
  }

  // 4) Mismo origen (assets propios): stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }

  // 5) CDNs autorizados (xlsx, exceljs, supabase-js client): cache-first.
  if (CACHEABLE_CDN_HOSTS.some((host) => url.hostname.endsWith(host))) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // 6) Otros origenes (iframe, etc.): dejar pasar tal cual.
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Sin conexion y sin copia en cache.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response('', { status: 504 });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (_) {
    return new Response('Recurso externo no disponible offline.', {
      status: 504,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
