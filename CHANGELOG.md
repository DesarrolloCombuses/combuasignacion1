# Changelog

Todos los cambios relevantes de CombuAsigna se documentan aqui.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto usa [Versionado Semantico](https://semver.org/lang/es/).

Convencion de version:

- **MAJOR**: cambios que rompen flujos existentes o exigen migracion de datos.
- **MINOR**: nuevas funcionalidades retrocompatibles.
- **PATCH**: correcciones y mejoras menores sin impacto en el flujo.

## [No publicado]

### Pendiente
- (anota aqui los cambios que estes trabajando antes de liberar)

---

## [1.5.1] - 2026-05-20

### Cambiado
- El **mapa** que estaba dentro de la pestana de planilla ahora vive en su propia pestana **Mapa enturnamiento aeropuerto**, al lado de la planilla.
- Ambas pestanas comparten el mismo origen de datos (`loadLlegadas104()`), por lo que el conteo y el estado se reflejan en las dos.
- El mapa ocupa ahora `65vh` (min 420px) en su propia vista, sin competir por espacio con la tabla.
- Cada pestana tiene su propio boton **Actualizar** que dispara la misma consulta.

---

## [1.5.0] - 2026-05-20

### Cambiado
- La pestana **Llegadas 104** se renombra a **Planilla de enturnamiento aeropuerto**. Los IDs internos (`data-tab="llegadas-104"`, `#llegadas104*`) se mantienen para no romper la logica JavaScript.
- Nombre del Excel exportado: `planilla_enturnamiento_aeropuerto_YYYY-MM-DD.xlsx` (hoja `Enturnamiento aeropuerto`).

### Anadido
- **Mapa en vivo** dentro de la misma pestana usando **Leaflet 1.9.4** (CDN jsdelivr) y tiles de **OpenStreetMap**:
  - Cada fila con `lat` y `lon` validos se pinta como marcador.
  - Tooltip permanente con el **numero interno** del vehiculo (pildora azul).
  - Popup al hacer click con detalles: vehiculo, itinerario, posicion, base, conductor, hora de llegada, estado `listo`.
  - Centro inicial: aeropuerto JMC (Rionegro). Si hay markers, se hace `fitBounds` automatico.
- `invalidateSize()` automatico al activar la pestana para que el mapa se mida bien sobre el contenedor previamente oculto.

---

## [1.4.1] - 2026-05-20

### Cambiado
- **Llegadas 104**: la tabla y el export reflejan ahora **todas** las columnas reales:
  `vehicle_id`, `interno`, `itinerario`, `posicion`, `hora_llegada`, `base`, `driver_id`, `distancia_m`, `listo` (bool), `ubicacion`, `updated_at`, `lat`, `lon`.
- `listo` se muestra como chip "Listo" / "Pendiente".
- `lat` / `lon` se formatean con 6 decimales.
- `updated_at` se compacta a `YYYY-MM-DD HH:MM:SS`.
- El SELECT pasa a `*` para no romperse si cambia el esquema en el futuro.

---

## [1.4.0] - 2026-05-20

### Anadido
- Nueva pestana **Llegadas 104**: lee la tabla `llegadas_104` de Supabase (columnas `vehicle_id`, `interno`, `itinerario`, `posicion`, `hora_llegada`).
- Filtros server-side por rango de fechas sobre `hora_llegada` (`gte`/`lte` con limites de dia).
- Boton **Descargar Excel** que exporta la vista actual con `Fecha`, `Hora`, `Vehiculo`, `Interno`, `Itinerario`, `Posicion` y el ISO original (`HoraLlegadaISO`).

### Notas
- Solo lectura. Limite 500 filas por consulta, orden `hora_llegada` descendente.
- Modulo aislado al final de `js/functions.js`, sin tocar codigo existente.
- Estado en memoria se limpia al cerrar sesion para evitar fuga de datos entre usuarios.

---

## [1.3.1] - 2026-05-20

### Cambiado
- Pestanas visibles renombradas: **Turnos del dia 2** -> **Turnos del dia** y **Estados del personal 2** -> **Estados del personal**. Los `data-tab` internos (`programacion2`, `novedades2`) no cambian para no romper la logica JavaScript.

---

## [1.3.0] - 2026-05-20

### Anadido
- **Asistencias**: filtrado automatico por **base activa**:
  - **Operador de base** (login con email `base{N}@combuses.com.co`): fijado a su base, no puede ver otras.
  - **Administrador**: cuando abre una base desde la barra superior (`Abrir base`), Asistencias se restringe a esa base. Al salir (`Salir de base`), vuelve a mostrar todas.
- Indicador `Filtrando: BASE N` (o `Sin base seleccionada`) junto al buscador.
- El nombre del Excel exportado incluye la base activa: `asistencias_base2_YYYY-MM-DD.xlsx`.

### Cambiado
- Re-render automatico al entrar/salir de base y al volver a la pestana Asistencias.

### Eliminado
- Columnas **Obra** y **Vehiculo** en la tabla y en el export (incluye campos `Obra`, `ObraId`, `Vehiculo`). Se elimina tambien el embed `obra:obras(*)` del SELECT a Supabase.

---

## [1.2.2] - 2026-05-20

### Eliminado
- **Asistencias**: columna **Buk** retirada de la tabla, del filtro de la barra superior y del export a Excel (incluye `Buk`, `BukStatus`, `BukError`, `BukEnviadoAt`).

---

## [1.2.1] - 2026-05-19

### Cambiado
- **Asistencias**: la columna **Base** ahora se calcula cruzando el nombre del colaborador con el CSV de Google Sheets (`driversByBase`). Si el colaborador esta en el CSV, se muestra `BASE N`; si no, se conserva `base_operativa` como fallback.
- El chip de **Sentido** (entrada/salida) y el chip de **Buk** ya no se rompen en dos lineas (`white-space: nowrap`).

### Eliminado
- Columna **Observacion** retirada de la tabla y del export a Excel (se quitan tambien las observaciones del filtro de busqueda).

### Notas
- La normalizacion de nombres ignora mayusculas, acentos y espacios duplicados para maximizar coincidencias.
- El indice base-por-nombre se reconstruye en cada **Actualizar** por si el CSV cambia entre cargas.

---

## [1.2.0] - 2026-05-19

### Anadido
- Nueva pestana **Asistencias**: lee la tabla `asistencias` de Supabase y muestra entradas/salidas operativas con foto, geolocalizacion e integracion a Buk/Ctrlit.
- Filtros: rango de fechas (desde/hasta), busqueda por colaborador/vehiculo/base/observacion, sentido (entrada/salida) y estado Buk (enviado/error/pendiente).
- Joins automaticos a las tablas `colaboradores` y `obras` para mostrar nombres legibles en lugar de UUIDs. Si las FKs no estan definidas, hace fallback a select plano y muestra IDs cortos.
- Boton **Descargar Excel** con todas las columnas relevantes (fecha, hora, sentido, colaborador, obra, base, vehiculo, estado Buk, lat/long, observacion, etc.).
- Lazy load: la pestana solo consulta Supabase la primera vez que el usuario hace click en ella o pulsa **Actualizar**.

### Notas
- Solo lectura. No se modifica ninguna fila de `asistencias`.
- Limite por consulta: 500 filas (ordenadas por fecha y hora descendente).
- Implementado como modulo aislado al final de `js/functions.js` sin tocar codigo existente.

---

## [1.1.0] - 2026-05-19

### Cambiado
- Rediseno visual completo manteniendo todos los IDs y clases existentes.
- Nueva paleta corporativa: azul indigo `#1e40af` como primario, neutrales slate.
- Sistema de design tokens (colores, espaciado, radios, sombras, tipografia) en `:root`.
- Tipografia con stack `ui-sans-serif, system-ui` y jerarquia consistente.
- Pestanas reemplazadas: ahora son texto con indicador inferior animado (estilo dashboard moderno) en vez de chips coloreados.
- Topbar convertida en card con borde sutil y sombra suave.
- Botones planos (sin gradientes), con foco visible accesible.
- Tablas con cabecera en mayusculas tipograficas, zebra mas suave, hover por fila.
- Auth view simplificada: sin gradientes radiales decorativos, mas centrada.
- Modales con backdrop con blur y animacion sutil de entrada.
- Scrollbar personalizada (delgada, color borde).

### Anadido
- Estados `:focus-visible` accesibles en todos los botones e inputs.
- Variables CSS legacy (`--ui-*`) preservadas para compatibilidad.

### Notas
- No se modifico `js/functions.js` ni `index.html` estructuralmente.
- Todas las clases que el JS manipula siguen existiendo.

---

## [1.0.0] - 2026-05-19

### Anadido
- Soporte PWA: la aplicacion se puede instalar en escritorio y movil.
- Service Worker con cache de app-shell para carga instantanea offline.
- Manejo de versiones con `version.json` y CHANGELOG.
- Banner de actualizacion: cuando hay version nueva, el usuario decide cuando recargar.
- Pildora de version visible en la barra superior.

### Notas
- Llamadas a Supabase y CDNs no se cachean por SW (siempre red).
- La logica existente de `functions.js` no se modifico en esta version.
