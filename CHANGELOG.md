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

## [2.14.0] - 2026-11-25

### Agregado
- **Los conductores de cada base también salen del ERP.** Además de la hoja de conductores (la lista de Sonar), cada base ve los conductores **activos en el ERP con su base**. Así:
  - el conductor nuevo sale apenas Gestión Humana lo crea en el ERP, sin esperar a que lo creen en Sonar y se refresque la hoja;
  - el que en Sonar quedó sin base, con otra base o deshabilitado sale también en la base que dice el ERP.
- No se le quita a nadie la base donde lo tiene la hoja: solo se suma. Si la persona está en la hoja, se usa el nombre de la hoja (el mismo de la programación); si no, el del ERP con su cédula.
- El resumen de la carga dice cuántos salen por el ERP y por qué («todavía no está en la hoja de Sonar», «en Sonar no tiene base», «en Sonar dice Base n»). La píldora dice «N por el ERP».
- Si la persona está en dos filas de la hoja (una sin base y otra con base), ya no cuenta como «sin base» cuando el ERP confirma su base.

### Necesita
- La función `afiliados_conductores_erp()` en Supabase (`supabase/migrations/20261125180000_conductores_del_erp_por_base.sql`). Solo lee; a cada cuenta de base le da solo sus conductores (la Base 3 también los de la Base 5) y al administrador todos: nombre, cédula y base, nada más del ERP. Si no está o falla, la página sigue con la hoja sola, como antes, y lo avisa.

---

## [2.13.0] - 2026-11-25

### Agregado
- **Mi base · descargar en Excel los ingresos, salidas y relevos.** Botón «Excel» junto a «Actualizar» (en Novedades y en Relevos). Se escoge desde y hasta (atajos: el día que se está viendo, últimos 7 días y este mes; hasta 31 días por archivo, de los últimos dos meses) y baja un libro con cuatro hojas:
  - **Resumen**: por día, programados, entraron (a tiempo, temprano, tarde, sin turno), no entraron, salidas, sin cerrar, jornadas de más de 16 h y los relevos (entregaron tarde, a tiempo, antes de la hora, todavía no, no se pudo saber), con una fila de totales.
  - **Ingresos y salidas**: cada marca del biométrico o del celular de los conductores de la base: conductor, cédula, bus (y el programado), turno y su hora, hora de entrada, llegada (a tiempo, antes o tarde, y los minutos), dónde marcó y en qué punto, el motivo escrito, la salida (día, hora, dónde y motivo), las horas, si quedó sin cerrar, la jornada de más de 16 h y la revisión que hizo la base.
  - **Programados**: quién tenía turno ese día (y los disponibles), su hora de entrada y salida, bus, puesto y si entró o no.
  - **Relevos**: cada relevo con la hora programada, el resultado, la hora real de entrega (GPS), los minutos, por qué, dónde estaba el carro, y los dos conductores con su turno, sus marcas (hora, punto, biométrico o celular y con qué cuenta), si cuadran con la entrega y con el carro, cuánto esperó cada uno y los motivos escritos.
- Los textos son los mismos de la pantalla; las fechas y los números salen como fechas y números (se pueden filtrar y sumar). Encabezado fijo, filtros y colores (tarde en rojo, a tiempo en verde).

### Necesita
- Nada nuevo en la base de datos: usa las mismas funciones de Novedades (`afiliados_novedades_base`) y Relevos (`afiliados_relevos_base`), un día a la vez.

---

## [2.12.0] - 2026-11-25

### Agregado
- **Mi base · Relevos: a qué hora se entregó de verdad cada carro.** Para cada carro de la base con relevo ese día (turno 1 y turno 2) dice la hora programada del relevo, dónde estaba el carro a esa hora (en el aeropuerto desde tal hora, en el punto o en la vía), a qué hora llegó al punto donde lo esperaba el compañero, cuántos minutos después de la hora lo entregó y por qué: esperando despacho en el aeropuerto, venía del aeropuerto, el que recibe llegó tarde, a tiempo o antes de la hora. Con los dos conductores, la hora en que marcaron y cuánto esperó el que recibe.
- La hora sale del **GPS del carro**: es la primera vez que el carro está en el punto del relevo con el que recibe ya marcado. La salida que marca el que entrega llega casi siempre después (cuando el carro ya se fue con el compañero), por eso no se usa como hora de entrega.
- **Los dos conductores cuando se juntan en la entrega, con sus marcas revisadas:** el que recibe, si marcó la entrada en su horario (desde 15 min antes hasta 10 min después de su hora) o cuánto antes o tarde, y si el carro lo tuvo que esperar; el que entrega, si su salida cuadra con la entrega (desde 5 min antes de entregar hasta 30 min después de que el carro salió con el compañero), cuánto después la marcó o si la marcó ANTES de entregar el carro. Resumen aparte ("Marcas de los conductores") y filtros "Entrada fuera de horario" y "Salida que no cuadra".
- **Conductor 1, conductor 2 y el carro en cada marca.** Primero el que entrega (a qué hora entró y salió, y dónde), luego el que recibe (a qué hora entró y dónde). En cada marca dice, con el GPS, dónde estaba el carro: si estaba en ese punto, si ya había salido de ahí y a qué hora, si llegó después (y cuánto esperó el conductor) o si no pasó por ahí. "Por dónde anduvo el carro" muestra su recorrido con las marcas y la entrega en orden de hora. Resumen y filtro "Marcaron donde no estaba el carro". La ventana de cada conductor (Novedades) trae su relevo: a quién le entregó el carro o de quién lo recibió, con lo mismo.
- **Los turnos y las fotos.** Cada conductor muestra su turno (hora programada de inicio y de salida) y sus marcas con hora, punto (Almacentro, Terminal del Norte, Nutibara) y si fue en el biométrico o en el celular; el conductor 2 también su salida. **Tocando el bus** se abre la ventana del relevo con las fotos de las marcas de los dos conductores, dónde estaba el carro en cada una y su recorrido. Explicación más clara arriba y guía de colores.
- **Cuando el que recibe va a buscar el carro a otro punto.** Si el conductor 2 marca la entrada en un punto (por ejemplo, el biométrico de Terminal del Norte) pero el carro no llega ahí, y el conductor 1 marca la salida en otro punto con el carro ahí (o recién salido), la entrega se cuenta en ese otro punto y se avisa. Si el GPS no muestra el carro en ningún punto en todo el rato (parqueado, en el taller o cambiaron de carro), también se dice.
- **Dónde andaba el carro, más claro.** Si pasó más de hora y media sin tocar ningún punto ya no dice "en la vía": dice que estuvo por fuera de los puntos y de qué hora a qué hora; si salió de un punto y volvió al mismo, lo dice así; "al aeropuerto" bien escrito.
- **La ventana del relevo, más ordenada.** Arriba la entrega en grande y explicada en palabras; después si cuadran las marcas, el paso a paso (el carro llega, el conductor 2 marca, la entrega, el conductor 1 marca la salida, la hora del relevo), los dos conductores lado a lado con fotos pequeñas (tocar una la muestra grande), todo el recorrido del carro (cerrado, en dos columnas) y qué quiere decir cada color.
- **A las bases solo les salen los conductores activos en el ERP.** La lista de conductores sale de la hoja de Sonar, que seguía con retirados habilitados (el 25-nov eran 64 de 201). Ahora cada carga se cruza con los empleados del ERP, por cédula o, si no está, por el nombre: el que está retirado o no está creado en el ERP no sale en ninguna base. El panel «Conductores disponibles» dice arriba cuántos no se muestran por eso (por ejemplo, en la Base 3, que también trae a los de la 5, pasa de 123 a 75) y «Ver cuales» abre el Historial de conductores. El resumen de la carga (Recargar CSV) dice cuántos quedaron fuera y quiénes. Si no se puede revisar con el ERP, usa la última revisión de ese computador o muestra todos y lo avisa.
- **Turnos del día más claro y fácil de llenar.** Arriba de la tabla, una barra de avance que queda a la vista: cuántas casillas están listas, cuántas sin conductor, cuántas con nota y cuántos conductores quedan sin ubicar, con «Ver solo lo que falta» e «Ir a la siguiente vacía». **Asignar con un toque**: se toca el conductor en el panel y luego la casilla (arrastrar y escribir siguen sirviendo). Filas más bajas (el nombre ya no sale dos veces, sin «BASE 3» en cada casilla), las vacías en rojo y las que tienen nota en amarillo; sin la fecha ni la base en cada fila. En computador, un solo scroll: el encabezado, la barra y el panel de conductores acompañan, y al arrastrar la página baja sola. Sin palabras técnicas («DB nueva», «Supabase»).
- **Mi base · Historial de conductores.** Todos los conductores que han trabajado en la base (según la programación, desde abril) y los que la hoja tiene en la base, con su estado en el ERP: activo, retirado (y desde cuándo) o no está creado; su primer y último turno en la base, los días y el último bus. Filtros Activos / Retirados / No están en el ERP y buscador. Avisa cuando alguien sigue habilitado en la hoja pero no sale para programar.
- **Quién registró cada marca y dónde se tomó la foto.** En la ventana del relevo, cada marca dice con qué cuenta se registró (la del conductor, la del biométrico o la del celular de un punto, u otra), dónde estaba el celular (el punto, la precisión del GPS y un enlace al mapa) y lo que escribió la persona (por ejemplo «Recibe turno, está en taller»).
- Hoy se ve en vivo: los carros que todavía no llegan dicen dónde están ahora (por ejemplo, "en el aeropuerto desde las 14:58"). Se actualiza sola cada 2 minutos; el GPS, cada 10.
- Arriba, el resumen del día: cuántos entregaron tarde (y cuántos por el aeropuerto), a tiempo, antes de la hora, todavía no y los que no se pudo saber. Filtros y buscador por bus o conductor. En el celular cada carro sale como tarjeta.

### Necesita
- La tabla `tarjeta_estancias` (SQL del programa de la tarjeta) y la función `afiliados_relevos_base` (`supabase/migrations/20261124120000_relevos_de_mi_base.sql`; para quitarla, `quitar_relevos_de_mi_base.sql`). Sin la función, la vista dice que todavía no está activa.
- Las funciones `afiliados_conductores_no_activos` y `afiliados_historial_conductores` (`supabase/migrations/20261125120000_conductores_activos_erp.sql`; para quitarlas, `quitar_conductores_activos_erp.sql`). Sin ellas, las bases ven a todos los habilitados de la hoja y el historial dice que todavía no está activo.

---

## [2.11.1] - 2026-11-20

### Cambiado
- **El Excel del visor ya no sale protegido.** Se puede editar todo. La nota del final ahora dice cuando se descargo y que, si algo de la programacion esta mal, se corrija en CombuAsigna para que todos lo vean igual.
- **Al imprimir el Excel del visor** sale horizontal y a lo ancho de una hoja.

### Corregido
- **El Excel del visor salia sin colores en algunos PC**, y como la letra de los buses y de los FICHO es blanca, esas celdas parecian vacias (VEH de Terminal del Norte y las filas FICHO). Ahora los colores se toman del estilo que escribe el propio visor (no de lo que diga el navegador), el relleno se guarda como lo guarda Excel y, si una celda queda sin fondo, la letra sale oscura: el dato siempre se lee.

## [2.11.0] - 2026-11-18

### Anadido
- **Despachos en vivo y Visor Excel van dentro de Mi base**, junto a Novedades, Viaje a viaje, Enturnamiento y Cambios (para las cuentas que ven Mi base sus pestanas de arriba no se ven; arriba quedan Turnos del dia, Estados del personal y Mi base). Funcionan igual que antes, con sus propios filtros de fecha.
- **Por revisar con filtros y paginas:** arriba un filtro por tipo con cuantas hay (Todas, No entro, Llego tarde, Cambio de turno...), cada novedad dice su tipo, y abajo las paginas (10 por pagina, "1-10 de 31").
- **Pestana "Mi base"**, solo para las cuentas de base (baseN@): cada una ve solo SU base. El administrador ve la base que tenga abierta. Los conductores y las demas cuentas no la ven. Arriba se escoge el dia (cualquiera de los ultimos 2 meses) y tiene tres partes:
  1. **Novedades.** Un resumen que se puede tocar (programados, entraron a tiempo / temprano / tarde, ya debian entrar, entran en la proxima hora, con motivo escrito, en turno, turnos sin cerrar, jornadas de mas de 16 h) y los estados del personal del dia (descanso, incapacitado, disponible...). Debajo: las entradas del dia contra su turno con la foto, el nombre, la cedula, el bus (y si no es el programado) y su salida, con busqueda y filtros; los motivos que escribieron los conductores; los que faltan por entrar, los que no entraron, los disponibles (turno de 2:00 a 9:00) y los que entran mas tarde; y las salidas y jornadas. Al tocar una marca se abre el detalle con la foto grande de la entrada y de la salida.
  2. **Viaje a viaje de sus buses, con la plata.** Totales del dia (buses con viajes, viajes, pasajeros del sensor, viajes que lleno el conductor, plata segun el sensor y segun el conductor y la diferencia) y, por bus, cada viaje: salida, llegada, ruta, conductor, pasajeros del sensor y los que dijo el conductor, civicas, tiquetes y plata. Avisa "Sin despacho" y "En curso". La plata se calcula igual que en el Portal de Control: (pasajeros - personal de la empresa) x tarifa.
     **Filtro de horas** (desde - hasta, con los atajos Todo el dia, Manana de 02:30 a 12:00 y Tarde y noche de 12:00 a 02:30): solo cuentan los viajes que salieron en ese rango y los totales de arriba se recalculan. El dia de la tarjeta va de 02:30 a 02:30, asi que un rango como 18:00 a 02:00 pasa la medianoche.
  3. **Enturnamiento en vivo.** "Sus buses ahora" (en que fila y en que turno, en ruta o sin despacho, viajes y pasajeros de hoy, aviso de GPS viejo o apagado) y la fila completa de los cuatro puntos con sus buses resaltados como "Suyo". En el Aeropuerto va por itinerario. De los buses de otras bases no se muestra el conductor.
- **Por revisar: la base gestiona cada novedad.** Las novedades que piden atencion (entro antes de tiempo, cambio de turno, llego tarde, no ha entrado / no entro, turno sin cerrar mas de 12 h y jornada de mas de 16 h) salen de primeras en una bandeja. La base toca "Revisar", escribe que se hizo (de 5 a 500 letras) y guarda: queda quien la reviso y cuando, y si se cambia la nota queda cuantas veces. Un numero rojo al lado de "Novedades" dice cuantas faltan; "Pendientes" / "Todas" muestra tambien las ya revisadas. Solo la cuenta de la base revisa; el administrador ve lo revisado pero no revisa por ella.
- **Bien organizada para un dia real.** Con "Mi base" abierta la pagina usa todo el ancho (el cuadro "Conductores disponibles" es de la asignacion de turnos y vuelve al cambiar de pestana). "Por revisar" va agrupado por lo que paso, primero lo mas grave (no entro, sin cerrar, mas de 16 h, tarde) y al final las entradas antes de tiempo, con un indice arriba que dice cuantas hay de cada una. En Enturnamiento va primero la fila de cada punto y despues todos sus buses agrupados en "En la fila", "En ruta" y "Sin despacho"; la fila manda: un bus que ya tiene su siguiente despacho pero sigue esperando sale en la fila, con el mismo turno que en la tabla del punto. En el celular cada bus sale en su propio bloque y las tablas de la fila caben sin correrse.
- **Quien cambio que (cambios de conductores).** La base de datos anota cada cambio en el momento en que se guarda: quien lo hizo (la cuenta de base, el administrador u otra cuenta), a que hora, que bus / puesto / hora, que habia antes y que quedo. Cubre los turnos del dia (bus, puesto, horas, conductor 1 y 2 y sus notas, filas agregadas o quitadas) y los estados del personal. En **Turnos del dia** cada celda cambiada dice "✎ BASE 3 · 10:32" (con lo que habia antes al pasar el mouse) y arriba sale cuantos cambios hubo y quien los hizo. En **Mi base -> Cambios** esta la lista completa con filtros (conductores, buses y horas, filas, estados del personal) y busqueda; se puede ver hasta 7 dias adelante (la programacion de manana). Cada base ve los cambios de su base; el administrador, los de todas. Nadie puede borrar ni cambiar ese registro.
- **El Excel del visor sale protegido.** Igual al visor (colores, celdas unidas, anchos) y con la hoja bloqueada con una clave al azar que no se guarda: se puede cambiar el formato (colores, letra, anchos, altos), pero no lo escrito, para que no haya diferencias con CombuAsigna. Al final del archivo dice que es de solo lectura y como corregir.
- Se actualiza solo (novedades cada minuto, viaje a viaje cada 2 minutos, fila cada 30 segundos), solo con la pestana abierta, la pantalla a la vista y la ventana de revisar cerrada. Las fotos se guardan 15 dias.

### Corregido
- Las horas de la fila (llegada, GPS, ultimo viaje, publicacion) llegan de la base de datos como "...+00" y ahora se leen bien: antes salian todos los buses "Sin GPS", sin hora de llegada y con el aviso de "lista vieja".

### Quitado
- **Pestana "Consulta por fechas".** Se quitaron el boton, su contenido (programados, estados del personal y la linea de tiempo por rango de fechas) y su codigo en `functions.js`; en Supabase no se toco nada.
- **Pestana "Asistencias".** Mostraba las marcas de todas las bases. Las marcas de cada base, con sus novedades y la foto, se ven en Mi base. Se quitaron el boton, su contenido y su modulo en `functions.js`; en Supabase no se toco nada.
- **Pestanas "Planilla de enturnamiento aeropuerto" y "Mapa enturnamiento aeropuerto".** La fila del aeropuerto se ve ahora en Mi base -> Enturnamiento en vivo. Se quitaron sus botones, su contenido, el modulo Llegadas 104, el canal en vivo de la tabla `llegadas_104` (que cada CombuAsigna abierto mantenia aunque nadie viera el mapa) y Leaflet, que solo lo usaba el mapa.
- **Pestana "Datos compartidos con el cliente"** (solo la veia la Base 3): era una pagina que explicaba que datos se le comparten al sistema externo. Lo que se comparte no cambia: eso esta en Supabase y no se toco.
- **Pestana "Parque automotor y documentacion de vehiculos".** Los vehiculos y sus documentos los maneja el Kardex, que ademas cerro la tabla `parque_automotor` a las demas cuentas (a las bases les salia vacia). Se quitaron el boton de la pestana, su contenido, la ventana de documentos, sus estilos y su modulo en `functions.js`. Las tablas `parque_automotor` y `parque_documentos` y el bucket `parque-docs` siguen en Supabase, sin cambios.

### Seguridad
- Todo sale de la base de datos (`supabase/migrations/20261118150000_novedades_de_mi_base.sql`): 1 tabla nueva, `afiliados_novedades_revision` (con RLS y sin politicas: solo se toca por las funciones), y 6 funciones: `afiliados_base_de_la_cuenta`, `afiliados_base_canonica`, `afiliados_novedades_base`, `afiliados_revisar_novedad`, `afiliados_viajes_base` y `afiliados_fila_base`. Es la **base de datos** la que decide la base por el correo de la sesion: una cuenta baseN@ recibe solo la BASE N aunque se cambie el codigo de la pagina. Antes de guardar una revision se vuelven a calcular las novedades y se rechaza la que no sea de esa base o de ese dia. Sin sesion, o con una cuenta que no sea de base ni administrador, no se recibe nada.
- `supabase/migrations/quitar_mi_base.sql` quita la tabla y las 6 funciones si hiciera falta.
- El registro de cambios (`supabase/migrations/20261118170000_cambios_de_conductores.sql`): 1 tabla (`combuasigna_cambios`, RLS sin politicas y sin permisos: nadie la toca desde la pagina), disparadores en `programacion_filas` y `novedades` que anotan al guardar (si anotar fallara, el guardado NO se frena) y la funcion `combuasigna_cambios_dia`, que da a cada base solo lo suyo. Se quita con `quitar_cambios_conductores.sql`.

## [2.10.0] - 2026-11-07

### Anadido
- **Reporte de errores para enviar a soporte por WhatsApp.** Antes los errores salian en un `alert()` del navegador o en un aviso rojo que se iba a los 2,6 segundos: no se alcanzaban a leer, no se podian copiar y a soporte le llegaba "salio un error" sin ningun detalle. Ahora sale una ventana con lo que paso, los pasos ("1. Toca Copiar error. 2. Pegalo en el WhatsApp de soporte") y un recuadro con el reporte, listo para copiar.
- **El reporte trae todo lo necesario para revisarlo sin preguntar**: que paso, el mensaje tecnico (con codigo, detalle y pista cuando viene de Supabase, y las primeras lineas del rastro cuando es un error del codigo), usuario, base, pestana, fecha de trabajo, version, navegador, si habia internet, la hora y un codigo de referencia `ERR-XXXXXX` que tambien queda en la consola del navegador.
- **Botones**: "Copiar error" (si el navegador no deja copiar solo, el texto queda seleccionado y se explica como copiarlo a mano) y "Cerrar". El usuario pega el error en el chat de soporte. Si se intenta cerrar sin haber copiado, la ventana lo recuerda **una vez** ("Cerrar sin copiar") antes de cerrarse.
- **Errores de acciones del usuario abren la ventana directamente**: registrar, cambiar de estado o quitar a un conductor en Estados del personal, asignar conductor, cambiar carro de posicion, subir archivos de programacion, eliminar un dia, actualizar la programacion, generar el reporte de turnos, guardar documentos del parque automotor e iniciar la aplicacion. Reemplaza a los `alert()` que habia.
- **Errores de cargas en segundo plano no tapan la pantalla**: siguen como aviso rojo (algunas cargas se repiten cada 15 segundos y abrir una ventana cada vez seria peor), pero ahora el aviso dura 9 segundos, dice "Toca aqui para ver y copiar el error" y al tocarlo abre el mismo reporte. La pildora roja del encabezado ("Error novedades", etc.) tambien se puede tocar para abrir el ultimo error. El guardado de turnos que queda pendiente para reintento tambien adjunta su error.
- Si salen varios errores seguidos con la ventana abierta, se juntan en el mismo reporte (hasta 5) en vez de reemplazar al primero, que suele ser la causa de los demas.

### Corregido
- **"No se pudo guardar la novedad en Supabase. Unexpected end of JSON input"** (reportado en BASE 3, al arrastrar conductores a "Estados del personal" y al cambiar carros de posicion). El error **no venia de Supabase**: la novedad ni siquiera llegaba a enviarse. Cada arrastre lleva sus datos (que conductor o que vehiculo) como texto JSON dentro del propio arrastre, y cada destino los leia con `JSON.parse(getData(...))` sin comprobar nada. Cuando el navegador entregaba ese texto **vacio** al soltar, `JSON.parse("")` fallaba con "Unexpected end of JSON input" y, como la lectura estaba dentro del mismo bloque que el guardado, el aviso culpaba a Supabase.
- **El arrastre ya no depende de que el navegador conserve los datos**: al empezar a arrastrar, la aplicacion guarda ademas una copia en memoria (`setDragPayload`). Origen y destino estan en la misma pagina, asi que si los datos llegan vacios se usa la copia y la accion se completa. La lectura (`readDragPayload`) ya no lanza errores: devuelve el conductor/vehiculo o nada. Aplica a los cinco destinos de arrastre: Estados del personal, casillas CONDUCTOR 1/2 y cambio de carro, en las dos tablas de turnos.
- **Mensajes que dicen lo que paso**: si se suelta algo que no es un conductor ni un vehiculo de la aplicacion (texto seleccionado, un archivo), sale un aviso que explica como hacerlo, en lugar de "No se pudo guardar en Supabase". Ese aviso queda solo para errores reales de Supabase.

### Notas
- Sobre el arrastre: la copia en memoria **no** se usa si lo soltado trae otro texto o un archivo (viene de fuera de la app), se descarta al terminar cada arrastre y caduca a los 2 minutos, para que un arrastre viejo nunca pueda crear una novedad por error. Si vuelve a pasar, la consola del navegador (F12) deja una linea `[arrastre] ...` con los tipos de datos que llegaron.
- La 2.9.5 (solo el arreglo del arrastre) no llego a publicarse: sale junto con esta version.
- Actualizacion normal (no obligatoria): la version anterior no dana datos.

---

## [2.9.4] - 2026-09-30

### Anadido
- **La carga de conductores dice ahora quien quedo fuera y por que.** La aplicacion solo puede usar a un conductor si en la hoja de conductores esta **habilitado** (`ENABLED`) **y** tiene base escrita en su columna. Quien no cumple las dos cosas se descartaba **en silencio**: el contador decia "Conductores: 107 en 6 bases" y no habia forma de saber, desde la aplicacion, que otros 68 habilitados se estaban quedando fuera por no tener base. Averiguarlo obligaba a descargar el CSV y contarlo a mano.
- La pildora del encabezado pasa a decir **"Conductores: 107 en 6 bases - 68 sin base"** y se pone en **ambar** cuando hay alguno sin ubicar.
- En la tarjeta de administracion de bases, junto a "Recargar CSV", se muestra el detalle: cuantos entraron, cuantas filas estan inactivas (normal, no se cargan) y un aviso desplegable con **los nombres** de los habilitados sin base, para poder corregir la hoja sin salir de la aplicacion.

### Notas
- El problema que destapo esto: en BASE 4 faltaban conductores en el panel. No era la lectura del CSV, que funciona bien; eran personas activas a las que **nunca se les escribio la base** en la hoja. La aplicacion no tiene forma de adivinar a que base pertenecen, asi que no las puede mostrar en ninguna.
- Cuando la carga cae al **cache local** (sin internet), el resumen lo dice y **no reporta** cuentas de descartados: el cache solo guarda el listado por base y no sabe quien quedo fuera. Arrastrar la cifra de la carga anterior seria mentir.

---

## [2.9.3] - 2026-09-30

### Corregido
- **El panel "Conductores disponibles" no explicaba por que faltaba gente**: una base con 22 conductores podia mostrar uno solo, sin ninguna indicacion de donde estaba el resto. Un conductor sale del panel por dos motivos y nada mas (tiene turno asignado ese dia, o tiene un estado registrado en "Estados del personal" para esa fecha), pero ninguno de los dos se veia en pantalla. Ahora el panel encabeza siempre con el reparto completo -- **cuantos con turno, cuantos con estado y cuantos sin ubicar** -- de modo que un panel casi vacio deja de parecer una falla.
- **El mensaje del panel vacio era falso**: decia "Todos los conductores asignados" aunque estuvieran en Estados del personal, que es justo el sitio donde habria que ir a buscarlos. Ahora distingue los dos casos y da la cuenta de cada uno.
- **El aviso de sobrantes nunca aparecia en la pestana de la base nueva**: el mensaje "Quedan N conductores sobrantes, arrastralos a Estados del personal" se calculaba sobre `rows`, el conjunto de filas de la **base vieja**, mientras el panel trabaja sobre `rowsTarget`. Con la base vieja apagada (`USE_ONLY_NEW_DB`) la cuenta daba siempre cero y el aviso no salia jamas. Ahora se calcula sobre las filas que realmente se estan viendo.
- **La guia de pasos y el buscador de conductores estaban muertos**: `updateWorkflowGuide()` leia la fecha del `<select id="filterDate">`, que es el selector de la base vieja: esta oculto y nunca se llena. La guia se quedaba clavada en "Paso 1: selecciona la fecha" y, como efecto secundario, dejaba el campo **"Buscar por nombre..." deshabilitado de forma permanente**. Ahora lee la fecha de la pestana activa.

### Notas
- El panel y el texto que lo explica salen ahora de **una sola cuenta** (`getDriverAvailabilityBreakdown`). Calcularlos por separado era lo que permitia que el mensaje contradijera a la lista.
- El numero del aviso de sobrantes se toma del propio panel y no de `getRemainingDriversCountForDate`: esa funcion descarta las filas FICHO y el panel no, asi que las dos cuentas podian mostrar numeros distintos en la misma pantalla.

---

## [2.9.2] - 2026-09-21

### Anadido
- **Pestana "Datos compartidos con el cliente"** para las bases cuya programacion se consulta desde fuera (hoy solo BASE 3). Explica **que informacion sale y cual no**: se comparten los turnos del dia, el conductor asignado, cuantos turnos faltan por asignar y quien descansa o esta de vacaciones; **no** salen las incapacidades, calamidades ni permisos (se entregan agrupados como "ausencia", sin el motivo), ni las cedulas, ni ninguna otra base. Aclara tambien que lo que se asigna se ve enseguida, porque el sistema externo consulta cada pocos minutos, y que solo puede leer: no puede asignar, borrar ni modificar nada. La lista de bases esta en `API_SHARING_BASES`, de modo que habilitar otra base en el futuro es un unico cambio.

### Notas
- La pestana **no muestra la credencial de acceso ni la direccion de la API**, y es deliberado: la aplicacion es un sitio estatico, asi que cualquiera puede leer su HTML y su JavaScript **sin iniciar sesion**. El inicio de sesion decide que se ve en pantalla, no que se puede descargar. Todo secreto que se pusiera aqui quedaria igual de expuesto que publicandolo; las credenciales se entregan por separado, en un documento que no vive en el repositorio.

---

## [2.9.1] - 2026-09-21

### Corregido
- **El calendario de "Turnos del dia" se veia cortado**: el panel se dibujaba dentro de la tarjeta de la pestana, asi que se recortaba en cuanto no cabia. En computador se salia por el **borde inferior de la ventana** y las ultimas semanas del mes quedaban fuera de vista; en celular y tablet se cortaba **tambien por los lados**, porque el contenedor de la pestana (`.tab-content`) usa `overflow-x:auto` en pantallas de 900px o menos para poder desplazar las tablas anchas, y eso recorta cualquier cosa que sobresalga. Ahora el panel **flota sobre la pagina** en coordenadas de pantalla (`position:fixed`), de modo que **ningun contenedor lo puede recortar**: se ve el mes completo siempre.
- **El calendario se abre hacia arriba cuando no cabe hacia abajo**: si el boton esta cerca del borde inferior, el panel se despliega **por encima** del boton en lugar de salirse de la pantalla. En pantallas muy bajas, donde no cabe entero de ninguna forma, el panel toma **scroll propio** en vez de quedar cortado. Ademas se mantiene pegado al boton al **hacer scroll o cambiar el tamano** de la ventana, y se reacomoda al cambiar de mes (los meses de 6 semanas son mas altos).

- **La programacion de una base se perdia cuando otra base guardaba (perdida de datos)**: al abrir un dia se cargaban en memoria **todas las filas de esa fecha, de todas las bases**, pero la tabla solo deja editar las de la base abierta. Al guardar se reenviaba **la copia completa del dia**, y ademas se **borraban** de la base las filas que no estuvieran en esa copia. Resultado: si BASE 3 abria el dia a las 8:00 y guardaba cualquier cosa a las 10:00, escribia su foto de las 8:00 encima y **el trabajo que BASE 4 habia hecho entre medias desaparecia**, dejando el dia "como estaba antes". El aviso "GUARDADO Y CONFIRMADO" no mentia: en ese instante el dato si estaba verificado en la base; lo pisaban despues. Ahora **cada guardado escribe y borra unicamente las filas de la base que esta abierta**, que son las unicas que ese usuario puede haber modificado, de modo que dos bases trabajando la misma fecha **ya no se pisan entre si**.
- **El aviso verde "GUARDADO Y CONFIRMADO" se quedaba pegado en pantalla**: el modal se encendia con `requestAnimationFrame` y se apagaba con un temporizador. Si la pestana pasaba a segundo plano justo despues de guardar (algo habitual al cambiar de ventana mientras sincroniza), el navegador **congelaba** el `requestAnimationFrame` pero **no** el temporizador, asi que primero corria el cierre y luego, al volver a la pestana, el modal se **volvia a encender sin nadie que lo apagara**. Ademas solo se bajaba su opacidad a 0: el nodo seguia cubriendo la pagina. Ahora se enciende sin depender de `requestAnimationFrame`, se **oculta de verdad** al cerrarse y, como red de seguridad, se apaga al volver a la pantalla si quedo encendido.

- **El administrador que trabaja sin abrir una base tambien podia pisar el dia entero**: con una base abierta el guardado ya queda acotado a esa base, pero **sin** base abierta (viendo todas a la vez) no hay ambito que acotar y se seguia escribiendo el dia completo. Para ese caso el guardado pasa a ser **por cambios**: al cargar la programacion se toma una **foto de como estaba en la base**, y al guardar se escriben unicamente las filas que **cambiaron en ese equipo**. El borrado deja de deducirse por diferencia (que arrasaba con las filas que otros estaban editando) y se limita a las filas que **estaban al cargar y ya no estan**. Si no cambio nada, no se toca la base. La verificacion en este modo se hace **fila a fila**, porque la base contiene legitimamente mas filas de las que se enviaron.

### Cambiado
- **La actualizacion pasa a ser obligatoria**: `version.json` gana el campo `minVersion`. Cualquier pestana abierta con una version **inferior** a ese minimo recibe una actualizacion que **no se puede aplazar**: no ofrece "Mas tarde" y no espera a que el usuario deje de escribir. En esta version `minVersion` queda en **2.9.1**, porque la version anterior puede borrar el trabajo de otras bases y no debe seguir en uso.
- **Se cierra el hueco por el que un usuario podia quedarse en la version vieja para siempre**: si habia foco en un campo de texto, la recarga se aplazaba 15 segundos **y se reintentaba indefinidamente**, asi que un cursor olvidado en un buscador bastaba para no actualizar nunca. Ahora el aplazamiento tiene un tope de **60 segundos**, pasado el cual se suelta el campo y se actualiza igual.
- **Antes de recargar se confirma lo que quede sin guardar**: la actualizacion automatica llama a `flushPendingTargetSave()` antes de irse, de modo que una recarga forzada no se lleve asignaciones sin confirmar.

### Corregido
- **La pildora de version podia anunciar una version que no era la que estaba corriendo**: el numero se lee de `version.json`, no del codigo cargado. Si `index.html` seguia pidiendo `js/functions.js?v=<version anterior>`, esa URL ya estaba en cache y el Service Worker la servia tal cual (`stale-while-revalidate`), asi que el usuario **trabajaba con el codigo viejo mientras la pildora decia que estaba al dia** — y la deteccion de actualizaciones no veia nada raro, porque ambos numeros salian del mismo `version.json`. Ahora `js/main.js` declara `APP_CODE_VERSION` **dentro del propio codigo**: `pwa.js` la compara con `version.json` y, si no coinciden, borra los caches, da de baja el Service Worker y recarga limpio (con tope de 2 intentos para no entrar en bucle si el despliegue quedara a medias).

### Anadido
- **`bump.py`**: el numero de version vivia en cuatro archivos que habia que sincronizar a mano (`version.json`, los `?v=` de `index.html`, `APP_CODE_VERSION` de `js/main.js` y `CHANGELOG.md`), y olvidar uno dejaba a los usuarios con el codigo viejo — ya habia pasado antes (ver v1.5.2). `python bump.py <version>` actualiza los tres archivos de codigo de una vez, `--obligatoria` sube ademas `minVersion`, y `python bump.py --check` verifica que los cuatro coincidan antes de publicar.

### Notas
- Cambio solo visual: no se toco la logica de seleccion de fecha ni el `<select>` oculto que sigue siendo la fuente de datos, por lo que el guardado, los filtros y las exportaciones funcionan igual.
- **Regla de seguridad del guardado por cambios**: si por cualquier motivo no hay foto de referencia (por ejemplo, se recupero una copia local pendiente), se considera que **todo cambio** y se escribe todo, que es el comportamiento de siempre. El fallo nunca ocurre al reves, de modo que un problema aqui no puede dejar cambios sin guardar.
- La subida de programaciones desde Excel y la migracion entre proyectos **no cambian**: siguen escribiendo el conjunto completo, como deben.
- **Queda un caso sin cubrir**: dos personas de la **misma base** editando la misma fecha a la vez (dos equipos, o dos pestanas del mismo usuario) todavia pueden pisarse, porque con base abierta se escribe el ambito completo de esa base. Si llega a pasar, el mismo mecanismo de guardado por cambios se puede extender a ese caso.

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
