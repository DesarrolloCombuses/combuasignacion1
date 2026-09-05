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

## [2.9.0] - 2026-09-05

### Anadido
- **Calendario para elegir la fecha en "Turnos del dia"**: el desplegable con la lista larga de fechas se reemplaza por un **calendario desplegable**. Abre en el **mes en curso**, **pinta en azul los dias que ya tienen programacion cargada** en la base y deja apagados (no clicables) los que no la tienen, de modo que se ve de un vistazo **hasta que dia esta cargado el mes**. Se **cierra solo al elegir el dia** (tambien al pulsar fuera o con Escape), permite navegar entre meses y volver al mes actual, y junto al boton se lee "Programacion hasta el DD/MM/AAAA" sin necesidad de abrirlo. Esta **adaptado a celular**: ocupa el ancho de la pantalla y agranda los dias para el dedo. El `<select>` original se conserva oculto como fuente de datos, por lo que el resto del flujo (guardado, filtros, exportaciones) no cambia.
- **BASE 4 puede mover la posicion de los vehiculos y sus fichos**: hasta ahora solo BASE 3 (y el super administrador) podian arrastrar un vehiculo sobre otro para intercambiar su posicion. Ahora BASE 4 tiene exactamente la misma funcion. Las bases habilitadas quedan en una sola lista (`VEHICLE_SWAP_BASES`), de forma que habilitar otra base en el futuro es un unico cambio. Ademas, al iniciar sesion **BASE 4 ve un aviso** que le explica que ya puede arrastrar un vehiculo sobre otro, que el conductor viaja con el carro y que en los FICHO el carro se mueve pero el ficho queda sin conductor. El aviso aparece **una sola vez por usuario** (se recuerda en el navegador); para volver a mostrarlo basta con subir `SWAP_NOTICE_VERSION`.
- **BASE 3 ve tambien los conductores de BASE 5**: al haber pasado varios vehiculos de BASE 5 a BASE 3, sus conductores siguen registrados en BASE 5 (la base de un conductor se toma de su correo en el Google Sheets). Para que se puedan asignar sin esperar ese cambio, **BASE 3 muestra ahora su lista de conductores mas la de BASE 5**, sin duplicados. Se respetan las mismas reglas: un conductor ya asignado en un carro de **cualquiera** de las dos bases deja de ofrecerse, y quien tenga novedad ese dia (incapacidad, permiso, descanso...) tampoco aparece. BASE 5 sigue viendo unicamente los suyos. La relacion queda en una sola lista (`EXTRA_DRIVER_BASES`), facil de ampliar o revertir.

### Cambiado
- **Reasignacion de vehiculos entre bases**: los internos **708, 733 y 757 pasan de BASE 5 a BASE 3**, y el **747 pasa de BASE 5 a BASE 8**. Sus **fichos, turnos y despachos los siguen automaticamente**, porque la base de cada fila se deduce del vehiculo. BASE 5 queda solo con los internos cortos (15, 59, 64, 89, 100, 157, 163, 211, 232).

### Notas
- El cambio de base de un vehiculo aplica a las **programaciones que se importen a partir de ahora**; los dias ya guardados conservan la base con la que se cargaron. Si se necesita que un dia antiguo refleje el cambio, hay que volver a subir ese Excel.
- El **traslado de los conductores** entre bases no se hace en la aplicacion: la base de cada conductor se toma de su correo en la hoja de Google Sheets (`BASE n`), por lo que debe actualizarse alli.

---

## [2.8.0] - 2026-06-18

### Anadido
- **Subida de varias programaciones a la vez (DB nueva)**: el boton "Cargar Excel Programacion (DB nueva)" ahora permite **seleccionar multiples archivos** en una sola accion. Se suben **uno tras otro** (en secuencia, para no provocar carreras al guardar), con aviso de progreso ("Subiendo 2 de 5...") y un **resumen final** con cuantos se cargaron; si alguno falla, se informa cual sin detener los demas. Al terminar se refresca el selector de fechas con los dias cargados.

### Corregido
- **"Eliminar dia" no eliminaba**: la accion operaba sobre la base de datos anterior (`rows` + sync viejo) en lugar de la base en uso, por lo que el dia seguia apareciendo. Ahora **borra las filas de ese dia directamente en `programacion_filas` (por `fecha`) de la base activa**, pide **confirmacion** antes de borrar (accion irreversible), refresca la tabla, la lista de conductores, las novedades y el **selector de fechas**, y muestra cuantas filas se eliminaron. Disponible solo para el super administrador.

---

## [2.7.1] - 2026-06-18

### Anadido
- **Actualizacion automatica (sin clic)**: cuando se publica una version nueva (cambia `version.json`), la app la detecta (cada 2 min o al volver el foco) y **recarga sola** para dejar a todos en la ultima version, mostrando un breve aviso "Actualizando...". Ya no es necesario pulsar "Recargar ahora". Si el usuario esta escribiendo en ese momento, la recarga se **difiere** unos segundos (y se ofrece el banner manual) para no perder lo que esta tecleando. *(Aplica a partir de esta version en adelante.)*

---

## [2.7.0] - 2026-06-18

### Corregido
- **Perdida de asignaciones al cambiar de pestana/fecha/base (DB nueva)**: al asignar conductores en "Turnos del dia" y cambiar rapido a "Estados del personal" (u otra pestana), una recarga asincrona podia leer los datos viejos de la base y **pisar las asignaciones recien hechas** antes de que terminaran de guardarse. Ahora, antes de cualquier recarga (cambio de pestana, cambio de fecha, boton "Actualizar DB nueva" y cambio de base) se **confirma primero el guardado pendiente** (`flushPendingTargetSave`), de modo que la recarga siempre trae lo ya guardado y nunca se pierden asignaciones.
- **Casilla no se refrescaba tras asignar (falso "SIN CONDUCTOR PROGRAMADO")**: al escribir o arrastrar un conductor, el dato se guardaba pero la etiqueta de la casilla seguia mostrando "SIN CONDUCTOR PROGRAMADO", lo que hacia creer que no se habia guardado. Ahora la casilla se actualiza al instante al asignar, quitar o arrastrar (`renderLabel`).

### Anadido
- **Aviso "GUARDADO Y CONFIRMADO"**: cada vez que se asigna un conductor aparece un modal verde con el nombre, el vehiculo y la casilla, que se cierra solo (~1.6s). **Solo se muestra cuando el dato quedo verificado en la base de datos**, para que el aviso sea siempre veraz y el usuario quede tranquilo.

---

## [2.6.0] - 2026-06-04

### Anadido
- **Aviso de nueva version en vivo**: estando dentro de la app, ahora se revisa `version.json` cada **2 minutos** y tambien **al volver el foco** a la pestana. Si hay una version mas nueva publicada, aparece el banner **"Nueva version disponible"** indicando el numero de version (ej. `v2.5.0 → v2.6.0`) con el boton **"Recargar ahora"**, sin que el usuario tenga que recargar manualmente. Asi todos trabajan siempre con la ultima version.

### Cambiado
- El chequeo de actualizaciones paso de cada 1 hora a cada 2 minutos y se basa en comparar la version (no solo en el Service Worker), que es mas confiable cuando la pestana queda abierta.

---

## [2.5.0] - 2026-06-04

### Anadido
- **Despachos en vivo - columna "Sentido"**: cada despacho se clasifica automaticamente segun su itinerario como **Bajada del aeropuerto** (el itinerario *empieza* en "Aeropuerto", ej. `Aeropuerto-Tunel-ccsandiego`) o **Subida al aeropuerto** (el itinerario *termina* en "Aeropuerto", ej. `Almacentro-Tunel-Aeropuerto`). Se muestra con etiqueta de color (azul/ambar) y se incluye en la descarga del Excel.
- **Filtro de sentido** en Despachos en vivo: desplegable para ver solo **Bajada**, solo **Subida** o **Todos** (filtra del lado del servidor para no romper la paginacion).

---

## [2.4.0] - 2026-06-04

### Anadido
- **Formato operativo por rango de fechas (1 hoja por dia)**: nuevos campos **Desde/Hasta** junto a "Descargar Formato Operativo". Al indicar un rango, se genera un solo Excel con **una hoja por cada fecha** (`DIA_aaaa-mm-dd`), cada una con su programacion completa (secciones por terminal, FICHOS, filas en rojo y NOVEDADES DEL DIA). Si el rango se deja **vacio**, descarga solo el dia seleccionado en "Turnos del dia 2" (igual que antes). Rango maximo ~2 meses; la programacion de cada fecha se lee de `programacion_filas` sin afectar la pantalla.

### Interno
- Se refactorizo la generacion del formato operativo a una funcion reutilizable `buildOperativoSheet(wb, fecha, filas, novedades)`.

---

## [2.3.3] - 2026-05-31

### Cambiado
- **Parque automotor renombrado**: la pestana y el titulo ahora dicen **"Parque automotor y documentacion de vehiculos"**.
- **Edicion deshabilitada temporalmente**: la columna Acciones ya no muestra el boton "Editar"; muestra **"Proximamente"** (la edicion de fechas/fotos de documentos se habilitara mas adelante).

---

## [2.3.2] - 2026-05-31

### Cambiado
- **Planilla de enturnamiento aeropuerto — barra simplificada**: se quitaron el boton **"Actualizar"** y los filtros **Desde/Hasta** (ya no son necesarios porque la vista se refresca **sola cada 15s**). Se conservan el indicador de estado y el boton **Descargar Excel**.

---

## [2.3.1] - 2026-05-31

### Corregido
- **Enturnamiento aeropuerto no se actualizaba en vivo**: se agrego un **refresco automatico cada 15s** (respaldo del Realtime) que recarga la Planilla de enturnamiento y el Mapa mientras estan activos y la ventana visible. Asi se ve "en vivo" aunque Supabase Realtime no este entregando eventos de la tabla `llegadas_104`. Para Realtime instantaneo real, habilitar la tabla en la publicacion: `alter publication supabase_realtime add table public.llegadas_104;`.

---

## [2.3.0] - 2026-05-31

### Cambiado
- **Llegadas en pausa**: se ocultaron las pestanas **Llegadas Aeropuerto, San Diego, Nutibara y Novedades Llegadas**, y se **desactivaron sus consultas** a Supabase (`planilla_afiliados_2`) y el **realtime** asociado, para reducir carga. La **Planilla de enturnamiento aeropuerto** (tabla `llegadas_104`) sigue activa. Es **reversible**: basta cambiar la bandera `LLEGADAS_PAUSED` a `false` en `functions.js`.

---

## [2.2.1] - 2026-05-31

### Cambiado
- **Asistencias — vista por defecto**: ahora abre directamente en la vista **"entrada y salida"** (emparejada, con Entrada/Salida/Horas). El selector sigue disponible para volver al detalle marca por marca.

---

## [2.2.0] - 2026-05-31

### Anadido
- **Asistencias — vista "entrada y salida"**: nuevo selector de vista. En modo **"entrada y salida"** las marcas se **agrupan por colaborador y dia** en una sola fila con columnas **Entrada**, **Salida** y **Horas** trabajadas (toma la primera entrada y la ultima salida del dia; calcula horas incluso si el turno cruza medianoche). La vista **"detalle"** (una fila por marca) sigue disponible. La **descarga a Excel** respeta la vista elegida.

---

## [2.1.5] - 2026-05-31

### Cambiado
- **Despachos en vivo — columna Pasajeros**: en vez de mostrar "0", ahora muestra una etiqueta **"Proximamente"** (el conteo de pasajeros se integrara mas adelante). Aplica en la tabla y en la descarga.

---

## [2.1.4] - 2026-05-31

### Cambiado
- **Asistencias — se oculta la columna "Origen"**: ya no se muestra el origen de la marca (movil_sin_foto, web, admin_form, etc.) ni en la tabla en pantalla, ni en la descarga a Excel, ni en el buscador.

---

## [2.1.3] - 2026-05-31

### Anadido
- **Reporte de Turnos — validacion de dias sin turno**: cuando una persona no tuvo turno un dia, la celda ya no queda vacia: si existe una **novedad** ese dia en la tabla `novedades`, se muestra la novedad (p. ej. DESCANSO, INCAPACITADO, PERMISO); si **no hay ninguna novedad**, se muestra **"NO PROGRAMADO"**.

---

## [2.1.2] - 2026-05-31

### Corregido
- **Cedula (RUT) ahora se llena**: el Reporte de Turnos y la Planilla de Turnos toman la cedula del **CSV de conductores** (columna `cedula` del Google Sheet), que es la fuente real, en vez de depender de la tabla `colaboradores`. El cruce es por nombre (ignora orden y acentos) y el mapa nombre→cedula queda en cache local. Si el CSV no tiene a la persona, se usa `colaboradores` como respaldo.

---

## [2.1.1] - 2026-05-31

### Corregido
- **Reporte de Turnos — personas correctas**: las filas ya NO salen de todo el maestro `colaboradores` (traia gente que no opera en el aplicativo). Ahora se arman **solo** con quienes aparecen en la **programacion del rango** + las personas registradas en **novedades** del mismo rango. La **cedula (RUT)** se obtiene cruzando el nombre contra `colaboradores` (tolerante a orden de nombres y acentos).

---

## [2.1.0] - 2026-05-31

### Anadido
- **Reporte de Turnos (matriz por dias)**: nuevo boton + rango de fechas (Desde/Hasta) en el panel de administracion que genera un Excel con el formato de "ReporteTurnosColaboradores": filas = **todos los colaboradores** (Nombre, RUT/cedula, Area = OPERATIVA, Supervisor fijo) y **una columna por fecha** del rango. Cada celda muestra el **TURNO N (1-102)** que esa persona tuvo ese dia (vacio si no tuvo). La programacion de cada fecha se lee de `programacion_filas` sin afectar la pantalla. Rango maximo ~2 meses.

---

## [2.0.0] - 2026-05-31

### Anadido
- **Planilla de turnos (con cedulas)**: nuevo boton "Descargar Planilla de Turnos (cedulas)" en el panel de administracion. Genera un Excel con la lista **plana** de turnos a partir del operativo del dia: primero los **51 CONDUCTOR 1** (hora = relevo / INICIA 2) y luego los **51 CONDUCTOR 2** (hora = HORA FIN), numerados 1..102. Columnas: **#, TURNO, CEDULA, CONDUCTOR, HORA**.
- La **cedula** se obtiene cruzando el nombre del conductor contra la tabla `colaboradores`, tolerando diferencias de **orden de nombres/apellidos** y de **acentos/n~**. Si un conductor no se encuentra, se deja la cedula vacia y se avisa cuantos quedaron sin cedula.

---

## [1.9.9] - 2026-05-31

### Anadido
- **Formato operativo — filas en rojo**: al descargar el formato operativo, las filas de los turnos **24, 26, 28, 30, 32 y 34** (seccion San Diego) se resaltan con fondo **rojo**. El conjunto de turnos esta centralizado en `OPERATIVO_RED_TURNS` por si se necesita ajustar.

---

## [1.9.8] - 2026-05-31

### Anadido
- **Parque automotor — filtro por Ruta**: nuevo desplegable "Ruta" en la barra de herramientas que filtra tanto el **Listado** como la vista **Por renovar / Vencidos**. Las opciones de ruta se ajustan a la base seleccionada (admin) o a la base del operador.

---

## [1.9.7] - 2026-05-31

### Anadido
- **Parque automotor — ruta en vista "Por renovar / Vencidos"**: cada fila del tablero de vencimientos ahora muestra el **nombre de la ruta** ademas del interno, la placa y la base.

---

## [1.9.6] - 2026-05-31

### Anadido
- **Parque automotor — columna Ruta**: el listado ahora muestra el **nombre de la ruta** (columna "Nombre Ruta"; si no hay, el codigo "Ruta"). Tambien se puede **buscar** por ruta y se incluye en la **exportacion a Excel**.

### Corregido
- El filtro de **VINCULADOS** ahora ignora espacios invisibles (NBSP/tabs del CSV) y mayusculas, evitando que se cuelen DESVINCULADO o filas vacias/NULL.

---

## [1.9.4] - 2026-05-31

### Anadido
- **Parque automotor — vista "Por renovar / Vencidos"**: nuevo selector (Listado / Por renovar) que muestra un tablero **agrupado por documento** (SOAT, Tecnomecanica, Tarjeta de operacion). Cada documento lista los **vehiculos vencidos** (que se deben renovar, con los dias de vencimiento) y los **proximos a renovar**, mostrando numero interno, placa, base y fecha.
- Umbral de "proximos a vencer" **configurable** (15 / 30 / 45 / 60 / 90 dias) y resumen total de vencidos/por vencer. Respeta el filtro por base (operador ve solo la suya) y la busqueda.

---

## [1.9.3] - 2026-05-31

### Cambiado
- **Parque automotor — rediseno del modal de documentos**: ahora cada documento (SOAT, Tecnomecanica, Tarjeta de operacion) se muestra como una tarjeta con **icono**, **estado de vigencia** (vigente / por vencer / vencido con dias restantes), borde de color segun el estado, campo de fecha mas claro y **zona de carga de foto** estilizada con **miniatura** de la imagen actual.
- El estado (badge) se **actualiza en vivo** al cambiar la fecha y se muestra **vista previa** de la foto al seleccionarla, antes de guardar. Encabezado con chips de Interno / Placa / Base.

---

## [1.9.2] - 2026-05-29

### Anadido
- **Parque automotor — edicion por base**: cada base puede **editar las fechas de vencimiento** de SOAT, Tecnomecanica y Tarjeta de operacion, y **subir una foto** de cada documento (boton "Editar" por vehiculo -> modal). El operador solo edita su base; el admin, cualquiera.
- Las ediciones se guardan en una tabla **separada** `parque_documentos` (no se pierden al reimportar el CSV); la vista muestra la fecha editada si existe y, si no, la del CSV. Las fotos van a **Supabase Storage** (bucket `parque-docs`) y se muestran como enlace `[foto]`.
- Nuevo `prueddd/sql/parque_documentos.sql`: crea la tabla, **RLS por base** (operador solo su base via correo `baseN@`, admin todo), auditoria (`actualizado_por`/`actualizado_en`) y el bucket de Storage con sus politicas.

---

## [1.9.1] - 2026-05-29

### Cambiado
- **Parque automotor**: ahora muestra **solo vehiculos VINCULADOS** y se filtra **por base** (el operador de base ve unicamente su base; el admin puede elegir base o ver todas). La base se deduce del interno con `VEHICLE_TO_BASE_MAP` (mismo criterio que Despachos/enturnamiento).
- Las columnas cambian a foco documental: Interno, Placa, Marca, Modelo, Base y el **vencimiento** de **SOAT**, **Tecnomecanica** y **Tarjeta de operacion**, con semaforo de color (vigente / por vencer &le;30 dias / vencido). La descarga a Excel refleja lo mismo.

---

## [1.9.0] - 2026-05-29

### Anadido
- Nueva pestana **Parque automotor** (solo consulta) sobre la tabla `parque_automotor` de Supabase. Carga todo el listado (tabla pequena) y permite **busqueda** (placa, interno, marca, modelo, ruta, propietario), **filtro por estado** (Vinculado/Desvinculado), orden por interno y **descarga a Excel**. Columnas: Interno, Placa, Clase, Marca, Modelo, Estado, Ruta, Nombre ruta y Propietario.
- Se incluye `prueddd/sql/parque_automotor.sql` para crear la tabla en Supabase (columnas con el mismo nombre que los encabezados del CSV para que la importacion las mapee sola; RLS de solo lectura para usuarios autenticados).

---

## [1.8.4] - 2026-05-29

### Corregido
- **Asistencias**: solo cargaba 1000 registros aunque el limite fuera 20.000, porque PostgREST/Supabase topa cada respuesta en ~1000 filas. Ahora la carga es **paginada por bloques de 1000 con `range`**, acumulando hasta completar todo o llegar a `ASIST_FETCH_LIMIT` (20.000). Aplica tanto a la tabla como a la descarga a Excel.

---

## [1.8.3] - 2026-05-29

### Cambiado
- **Asistencias**: el limite de carga sube de **500 a 20.000** registros (`ASIST_FETCH_LIMIT`). Nota: depende del `max-rows` configurado en PostgREST/Supabase; si el servidor topa antes, habria que ajustar ese limite o paginar con `range`.

---

## [1.8.2] - 2026-05-29

### Cambiado
- **Asistencias**: deja de filtrar por base. La vista (y la descarga a Excel) ahora muestran **todas las bases**, sin importar el rol o la base abierta. El indicador pasa de "Filtrando: BASE N" a "Mostrando todas las bases".

---

## [1.8.1] - 2026-05-29

### Cambiado
- **Mapa enturnamiento aeropuerto**: los marcadores pasan de un pin grande + etiqueta flotante separada a un unico **marcador compacto tipo bus** con icono de bus y el numero interno integrado y legible. Borde blanco y sombra para distinguirlos cuando se solapan, y color por estado (**verde** = listo, **azul** = en espera). Reduce la saturacion visual del mapa. Se mantiene el popup con el detalle al hacer clic.

### Notas
- El mapa ya se actualizaba en tiempo real (la suscripcion Realtime de `llegadas_104` cubre tanto la planilla como el mapa de enturnamiento).

---

## [1.8.0] - 2026-05-29

### Anadido
- **Tiempo real (Supabase Realtime)**: suscripciones `postgres_changes` a las tablas `llegadas_104`, `despachos_realizados` y `planilla_afiliados_2`. Cuando cambian los datos en Supabase, la vista correspondiente se recarga al instante (con debounce de 800 ms para agrupar rafagas, p. ej. posiciones GPS). Solo recarga la vista que esta activa y si la ventana esta visible, para no consultar de mas. Las suscripciones se inician al iniciar sesion y se cierran al cerrar sesion.
  - Vistas en vivo: Planilla de enturnamiento aeropuerto / Mapa (llegadas_104), Despachos en vivo (despachos_realizados) y Llegadas Aeropuerto/San Diego/Nutibara/Novedades (planilla_afiliados_2).

### Cambiado
- **Despachos en vivo** pasa de sondeo periodico (cada 60 s) a actualizacion por Realtime. Se mantiene la recarga al entrar a la pestana.

### Notas
- Requiere que Realtime/Replication este habilitado para esas tablas en Supabase. El WebSocket de Realtime no pasa por el Service Worker, asi que no requiere cambios de cache.

---

## [1.7.9] - 2026-05-29

### Corregido
- **Planilla de enturnamiento aeropuerto** (`llegadas_104`): la columna **HORA** mostraba el valor en crudo de Supabase (UTC), apareciendo **+5 horas** adelantada respecto a la hora real. `splitFechaHora` ahora convierte el instante a hora local de Colombia (`America/Bogota`), de modo que la HORA coincide con la columna **HACE** y con la base de datos. La descarga a Excel queda igualmente corregida (conserva ademas el ISO original en `HoraLlegadaISO`).

---

## [1.7.7] - 2026-05-29

### Anadido
- En **Despachos en vivo**, nueva columna **Base**: muestra la base a la que pertenece el vehiculo. Se resuelve por `interno` usando el mapeo `VEHICLE_TO_BASE_MAP` del codigo y, como complemento, la programacion cargada en memoria (`getRowCanonicalBase`). No requiere consultas adicionales a Supabase. Si no se encuentra, muestra `-`. La base tambien se incluye en la descarga a Excel.

### Cambiado
- La columna **Base** dejo de cruzarse con `llegadas_104` (cobertura limitada) y ahora usa el mapeo del codigo y la programacion (cobertura completa, inmediata).

---

## [1.7.6] - 2026-05-29

### Cambiado
- En **Despachos en vivo**, la columna **Pax** se renombra a **Pasajeros**.

---

## [1.7.5] - 2026-05-29

### Cambiado
- La vista **Despachos realizados** pasa a llamarse **Despachos en vivo** (pestana y titulo).
- Se quitan las columnas **Placa** y **Conductor** de la tabla. La tabla queda con: Fecha/hora, Interno, Itinerario, Pax, Estado, Cancelado y Observaciones.

---

## [1.7.4] - 2026-05-29

### Anadido
- **Despachos realizados**: auto-refresco automatico cada 60 segundos mientras la pestana esta activa. Al salir a otra pestana el temporizador se detiene (deja de consultar Supabase) y al volver a entrar se recarga de inmediato y se reanuda. No consulta si la ventana del navegador no esta visible.

---

## [1.7.3] - 2026-05-29

### Eliminado
- Se retira la vista **PLANILLA DE DESPACHOS** (pestana y seccion `tab-planilla-afiliados`). La carga de datos subyacente (`loadPlanillaAfiliadosFromSupabase`) se conserva porque la comparten las vistas de Llegadas.

### Corregido
- Se revierte la eliminacion accidental de **Despachos realizados** (1.7.2): la vista vuelve completa (pestana, seccion y logica).

---

## [1.7.2] - 2026-05-29

### Eliminado
- Se retira por completo la vista **Despachos realizados** (pestana, seccion HTML y toda la logica en `functions.js`) introducida en 1.7.0.

### Corregido
- Se restaura el boton **Descargar despachos** de la PLANILLA DE DESPACHOS, que habia quedado afectado por una declaracion/funcion duplicada (`btnDownloadDespachos` / `handleDownloadDespachos`).

---

## [1.7.1] - 2026-05-29

### Corregido
- Declaracion duplicada de `btnDownloadDespachos` que rompia la carga de `functions.js` e impedia iniciar sesion.

---

## [1.7.0] - 2026-05-29

### Anadido
- Nueva pestana **Despachos realizados** (solo consulta) sobre la tabla `despachos_realizados`.
  - Paginacion server-side de 50 en 50, ordenada del mas reciente al mas antiguo (Primero / Anterior / Siguiente / Ultimo).
  - Filtros por estado (ACTIVO / CANCELADO), rango de fechas (desde / hasta) y busqueda por interno, placa, itinerario, observaciones o vehiculo (Enter).
  - Badge de color para el estado y columna de fecha de cancelacion.
  - Nombre del conductor resuelto cruzando `driver_id` (cedula) con la tabla `colaboradores` (autodeteccion de columnas; cae a mostrar la cedula si no hay acceso).
  - Boton **Descargar pagina** que exporta a Excel los registros visibles.

### Notas
- Usa el mismo cliente Supabase de la planilla. La visibilidad de filas depende de las politicas RLS del usuario autenticado.

---

## [1.6.5] - 2026-05-20

### Eliminado
- Columna **Estado** de la tabla de planilla. La descomposicion `Listos / Espera` sigue visible en las cards superiores y reacciona al chip de itinerario activo. Cache-bust subido a `?v=1.6.5`.

---

## [1.6.4] - 2026-05-20

### Anadido
- **Planilla de enturnamiento aeropuerto**: nueva columna **Base** entre `Bus` y `Estado`, con el valor de `llegadas_104.base` formateado como `BASE N`.
- Cache-busting subido a `?v=1.6.4` en `styles.css` y `functions.js` para que el navegador descargue las versiones nuevas tras este cambio.

---

## [1.6.3] - 2026-05-20

### Cambiado
- **Planilla de enturnamiento aeropuerto**: la barra superior se rediseno como una **toolbar compacta** dentro de una card con borde y radio. Layout `flex` con justify-between:
  - Izquierda: boton `Actualizar` + grupos `Desde` / `Hasta` (labels en mayusculas pequeñas, inputs con radius).
  - Derecha: texto de status + boton `Descargar Excel`.
  - Se eliminio el `<h3>` redundante (la pestaña ya identifica la vista).
- Resultado: la zona de cards Total/Listos/Espera y los chips quedan visualmente protagonistas, sin chocar con controles dispersos.

---

## [1.6.2] - 2026-05-20

### Cambiado
- Primera columna de la planilla renombrada de `#` a **Pos** y ahora muestra el valor real de la columna `posicion` en `llegadas_104` (antes mostraba el indice secuencial 1..N que coincidia por suerte cuando los datos venian ordenados; ahora siempre refleja la posicion fijada en Supabase, asi cada bus mantiene su numero por itinerario sin importar como llegue ordenado).

---

## [1.6.1] - 2026-05-20

### Eliminado
- Columna **Accion** y boton **+ Asignar** de la planilla. La tabla queda con 5 columnas: `#`, `Hora`, `Hace`, `Bus`, `Estado`. Solo lectura sobre `llegadas_104`.

### Cambiado
- Las cards **Total / Listos / Espera** ahora se calculan sobre el itinerario seleccionado. Cuando el chip "Todos" esta activo muestran los totales globales; al elegir un itinerario las cards se ajustan al subconjunto. Esto permite ver de un vistazo cuantos buses tiene el itinerario seleccionado y cuantos estan listos / en espera.

---

## [1.6.0] - 2026-05-20

### Cambiado
- **Planilla de enturnamiento aeropuerto** rediseniada por completo, mas operativa:
  - **3 cards de metricas** arriba: Total / Listos (verde) / Espera (naranja). Se recalculan en tiempo real al asignar.
  - **Chips por itinerario** en lugar de dropdown: Todos N, ItinerarioA N, ItinerarioB N, ... y "Sin llegada 104 hoy N" cuando hay filas con `itinerario` nulo o vacio. Click instantaneo, sin re-consulta a Supabase.
  - **Tabla compacta** con 6 columnas: `#` (orden secuencial), `Hora` (formato AM/PM), `Hace` (tiempo relativo desde `hora_llegada`), `Bus` (interno), `Estado` (chip ESPERA naranja o LISTO verde) y `Accion`.
  - Cuando el chip activo es "Todos", la tabla muestra cabeceras de grupo por itinerario (fondo oscuro, contador de buses en el grupo).
- **Boton "+ Asignar"** en cada fila en espera: dispara un `UPDATE llegadas_104 SET listo = true WHERE vehicle_id = X AND hora_llegada = Y` en Supabase. Boton se deshabilita durante la peticion, luego pasa a chip "Listo" verde y la card de metricas se actualiza. Si la peticion falla (RLS u otro), se muestra toast con el detalle.

### Anadido
- Estilos CSS especificos (`lleg104-*` y `tag-espera` / `tag-listo`) al final de `styles.css`.

### Notas
- "Sin llegada 104 hoy" actualmente agrupa las filas de `llegadas_104` con `itinerario` nulo o vacio. Si en el futuro se quiere comparar contra una lista externa de buses esperados, sera necesario definir la fuente (tabla `programacion`, CSV de Google Sheets, etc.).

---

## [1.5.4] - 2026-05-20

### Cambiado
- **Planilla de enturnamiento aeropuerto**: en modo "Todos" la tabla ahora muestra una **cabecera de grupo** azul cada vez que cambia el itinerario, con el nombre del itinerario en mayusculas y el numero de vehiculos en ese grupo. Hace mas legible la cola completa de varios itinerarios a la vez.
- En las filas de detalle dentro del grupo, la columna `Itinerario` aparece atenuada (gris claro) para reducir ruido visual, ya que el grupo ya esta identificado por la cabecera.
- Con un itinerario especifico seleccionado, las cabeceras de grupo no se muestran (vista plana, igual que antes).

---

## [1.5.3] - 2026-05-20

### Cambiado
- **Planilla de enturnamiento aeropuerto**: vista rediseniada para ver la cola de cada itinerario.
  - Nuevo selector **Itinerario** (Todos / lista detectada dinamicamente de los registros cargados).
  - Con un itinerario seleccionado, la tabla se ordena por **POSICION ascendente**.
  - Con "Todos", la tabla se ordena por itinerario (alfabetico) y luego posicion.
  - Columnas visibles reducidas a las 8 esenciales: **Posicion, Interno, Vehiculo, Hora llegada, Itinerario, Base, Conductor, Listo**.
  - El Excel respeta el filtro de itinerario y el orden por posicion. Sigue exportando las columnas adicionales (`distancia_m`, `ubicacion`, `lat`, `lon`, `updated_at`) para no perder dato historico.
  - Mapa de la pestana hermana se sincroniza con el filtro (solo pinta los markers visibles).

---

## [1.5.2] - 2026-05-20

### Cambiado
- Cache-busting de assets criticos: `index.html` ahora referencia `js/functions.js?v=1.5.2` y `css/styles.css?v=1.5.2` (antes el query era `?v=20260512-novedades-refresh`, lo que dejaba navegadores con copias antiguas tras la migracion al nuevo repositorio).
- El Service Worker ya hacia network-first sobre `version.json` y la navegacion, asi que tras este cambio los navegadores con copia rancia veran el banner de actualizacion en el siguiente refresco.

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
