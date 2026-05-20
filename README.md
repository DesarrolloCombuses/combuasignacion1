# CombuAsigna - Portal Afiliados (PWA)

Aplicacion web instalable para asignacion de conductores, gestion de novedades
y monitoreo de despachos. Funciona como **PWA**: se puede instalar en escritorio
o movil, carga instantanea desde cache local y notifica cuando hay version nueva.

> Backend: Supabase (Auth + Postgres).
> Frontend: HTML/CSS/JS vanilla servido como sitio estatico (GitHub Pages).

---

## Estructura

```
prueddd/
├── index.html                Vista unica de la SPA
├── manifest.webmanifest      Metadatos PWA (nombre, iconos, colores)
├── service-worker.js         Cache de app-shell + estrategia de fetch
├── version.json              Version vigente (UNICO archivo a editar al publicar)
├── CHANGELOG.md              Historico de cambios por version
├── README.md                 Este archivo
├── icons/
│   ├── icon.svg              Icono principal (any)
│   └── icon-maskable.svg     Icono maskable para Android
├── css/
│   └── styles.css
└── js/
    ├── functions.js          Logica de negocio
    ├── main.js               Bootstrap
    └── pwa.js                Registro de SW + banner de actualizacion
```

---

## Como funciona el versionado

El cliente sigue este flujo cada vez que abre la app:

1. `pwa.js` lee `version.json` con `cache: 'no-store'` (siempre fresco).
2. Pinta `vX.Y.Z` en la pildora del topbar.
3. Registra `service-worker.js?v=X.Y.Z`.
4. El navegador detecta cualquier cambio en esa URL como un **SW nuevo**.
5. El SW nuevo se instala en paralelo al actual y queda en estado `waiting`.
6. El cliente muestra el banner **"Nueva version disponible - Recargar ahora"**.
7. Al hacer click, el cliente envia `SKIP_WAITING` al SW y la pagina se recarga
   con la nueva version activa.

Es decir: **el unico archivo que necesitas editar al publicar es `version.json`**
(y opcionalmente `CHANGELOG.md`).

---

## Como publicar una nueva version

Cada vez que hagas cambios y quieras que los usuarios los reciban:

### 1. Decide el tipo de cambio (semver)

| Cambio                                                       | Bump      |
|--------------------------------------------------------------|-----------|
| Correccion de bug, ajuste cosmetico, mejora interna          | **PATCH** |
| Nueva funcionalidad sin romper flujos existentes             | **MINOR** |
| Cambios que rompen flujos o requieren migracion de datos     | **MAJOR** |

### 2. Edita `version.json`

```json
{
  "version": "1.1.0",
  "buildDate": "2026-06-03",
  "channel": "stable",
  "notes": "Resumen muy corto de la version."
}
```

### 3. Anade una entrada al `CHANGELOG.md`

Bajo el encabezado `## [1.1.0] - 2026-06-03`, usando las categorias:
`Anadido`, `Cambiado`, `Corregido`, `Eliminado`, `Seguridad`, `Notas`.

### 4. Si agregaste archivos nuevos al app-shell

Edita `service-worker.js` y agregalos al array `SHELL_ASSETS`. Ejemplo:

```js
const SHELL_ASSETS = [
  './',
  './index.html',
  // ...
  './js/nuevo-modulo.js'  // <-- agregar aqui
];
```

> Solo es necesario si quieres que ese archivo funcione **offline**. Para
> archivos opcionales (descargas, recursos secundarios) puedes omitirlos.

### 5. Sube los cambios a GitHub

```bash
git add .
git commit -m "v1.1.0 - resumen breve"
git tag v1.1.0
git push && git push --tags
```

GitHub Pages publicara automaticamente. Los usuarios que ya tienen la app
abierta veran el banner en su proxima carga; quienes esten activos pueden
esperar a la verificacion horaria automatica o recargar manualmente.

---

## Comportamiento del cache

| Tipo de recurso                          | Estrategia               | Cache           |
|------------------------------------------|--------------------------|-----------------|
| HTML / CSS / JS / iconos / manifest      | stale-while-revalidate   | `combuasigna-shell-v<ver>` |
| `version.json`                           | network-first            | `combuasigna-shell-v<ver>` |
| Navegacion (recarga pestana)             | network-first → fallback | `combuasigna-shell-v<ver>` |
| CDN xlsx / exceljs / supabase-js         | cache-first              | `combuasigna-runtime-v<ver>` |
| API Supabase (`*.supabase.co`)           | **siempre red, sin cache** | -             |
| Otros origenes (iframe converter, etc.)  | sin intercepcion         | -               |

Cuando sube la version, los caches viejos se eliminan en el evento `activate`.

---

## Probar localmente

Service Workers requieren HTTPS o localhost. Para probar:

```powershell
# Opcion A: python (si lo tienes)
python -m http.server 8080

# Opcion B: npx (Node)
npx serve -l 8080 .
```

Luego abre `http://localhost:8080/` en Chrome/Edge. Para simular una nueva
version sin tocar el codigo:

1. Abre DevTools → Application → Service Workers.
2. Edita `version.json` (cambia "1.0.0" por "1.0.1").
3. Recarga la pagina. Aparecera el banner.

---

## Notas operativas

- La app sigue requiriendo internet para todo lo que toca Supabase: login,
  programaciones, novedades, llegadas, planilla, auditoria.
- La PWA garantiza que el **shell** (HTML/CSS/JS) carga sin red.
- Si un usuario reporta que "no le aparecen los ultimos cambios": que recargue
  con `Ctrl+Shift+R` o que en DevTools haga "Unregister" del Service Worker
  y vuelva a cargar.

---

## Seguridad - tareas pendientes

Para una proxima version se recomienda:

- Revisar y endurecer **RLS** (Row Level Security) en Supabase.
- Sanitizar usos de `innerHTML` con datos dinamicos en `js/functions.js`.
- Mover credenciales fuera del cliente o confirmar que la `anon key` esta
  restringida solo a operaciones permitidas para usuarios autenticados.
- Modularizar `js/functions.js` (actualmente ~8.250 lineas en un solo archivo).
