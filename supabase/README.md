# API externa — despliegue y operación

Uso interno. La guía que se entrega al cliente está en
[`../docs/api-cliente.md`](../docs/api-cliente.md).

---

## Qué es

Una API de **solo lectura** para que un cliente consulte la programación de
una base concreta, sin acceso a las tablas internas ni a la app.

```
Sistema del cliente ──[X-API-Key]──> Edge Function ──[service_role]──> Postgres
                                          │
                                          ├── valida la credencial (SHA-256)
                                          ├── impone la base autorizada
                                          ├── aplica el límite por hora
                                          ├── frena a quien insiste sin credencial
                                          ├── limpia los datos sensibles
                                          └── registra el acceso
```

### Por qué una Edge Function y no acceso directo a las tablas

Se pueden crear políticas RLS y dejar que el cliente use PostgREST, pero eso
**expone el esquema real**: los nombres de tablas y columnas pasan a ser parte
del contrato, y cualquier cambio interno rompe al cliente. Con la función, el
contrato es propio y por dentro se puede cambiar lo que sea.

Además permite tres cosas que RLS por sí solo no da: límite de consultas por
hora, registro de accesos, y **limpiar los datos sensibles antes de
responder** — que aquí no es opcional (ver abajo).

---

## Los datos sensibles

Las novedades registran `nombre, base, estado, fecha`, con estados como
**INCAPACITADO, CALAMIDAD, PERMISO, VACACIONES, RENUNCIA**. Eso es el estado
de salud y la situación laboral de personas identificadas: dato sensible bajo
la Ley 1581 de 2012, cuyo tratamiento exige autorización expresa del titular.

**La API no entrega los motivos sensibles.** `/novedades` sí devuelve los
estados operativos con su nombre — `DESCANSO`, `VACACIONES`,
`RECONOCIMIENTO DE RUTA`, `DISPONIBLE` —, porque dicen "hoy no trabaja" y nada
más sobre la persona. Todo lo demás (incapacidad, calamidad, permiso, día no
remunerado, renuncia) se responde agrupado como **`AUSENCIA`**, sin distinguir
cuál es.

La lista está en `ESTADOS_OPERATIVOS`, en `index.ts`. Mover un estado de un
grupo al otro es editar esa lista y volver a publicar — pero es una decisión
del negocio, no técnica: antes de sacar un estado de ahí, que quede claro que
la empresa puede entregar ese dato. Lo que no esté en la lista, incluido un
estado nuevo que se invente mañana, cae automáticamente en `AUSENCIA`.

> **Cuidado con esto si tocan el código:** en la programación el estado viene
> pegado al nombre del conductor — `"Juan Pérez [INCAPACITADO]"`. Devolver
> `row_data` en crudo filtraría el dato sin necesidad de tocar la tabla de
> novedades. De eso se encarga `nombreConductor()` en `index.ts`; si se
> modifica el mapeo de campos, hay que mantener esa limpieza.

---

## El freno por IP

El límite por hora se cuenta **por cliente**, así que no cubre a quien no tiene
credencial: cualquiera puede lanzar peticiones con keys inventadas y, aunque no
vea nada, cada intento consulta la base y escribe en `api_accesos`. No expone
datos, pero engorda la tabla y gasta invocaciones.

Pasados **20 intentos fallidos en 10 minutos** desde la misma IP se responde
`429` y **se deja de registrar** — dejar de escribir es justo el objetivo.

Dos detalles de diseño que conviene no deshacer:

- **El conteo se consulta solo cuando la credencial ya falló.** Una petición
  legítima no paga esa consulta.
- **Una credencial válida nunca llega a esa comprobación.** Aunque alguien esté
  aporreando la API desde la misma IP (una oficina compartida, por ejemplo), el
  cliente entra igual. El freno castiga el fallo, no la procedencia.

> **Por qué no va en memoria.** El primer intento llevó el contador en un `Map`
> del proceso y **no frenó absolutamente nada**: 25 intentos seguidos y ni un
> solo `429`. Cada petición cae en una instancia nueva de la función, así que el
> contador nacía vacío siempre. En un entorno efímero el único estado
> compartido es la base de datos.

El índice que lo hace barato está en
[`migrations/20260921b_freno_por_ip.sql`](migrations/20260921b_freno_por_ip.sql).
Es parcial (`where status >= 400`), así que solo indexa los fallos.

---

## Desplegar

### 1. Crear las tablas

Con el CLI:

```bash
supabase db push
```

O pegando [`migrations/20260921_api_externa.sql`](migrations/20260921_api_externa.sql)
en el SQL Editor del panel.

Crea `api_clientes` y `api_accesos`, los índices de apoyo sobre
`programacion_filas` y `novedades`, y la función de purga del registro.

Ambas tablas quedan con **RLS activo y sin ninguna política**: así no las ve
ningún rol. El `service_role` que usa la función se salta RLS por definición,
de modo que solo el servicio llega a ellas.

### 2. Publicar la función

```bash
supabase functions deploy api-externa --project-ref cbplebkmxrkaafqdhiyi --no-verify-jwt --use-api
```

`--no-verify-jwt` es necesario: la autenticación es por `X-API-Key`, no por
JWT de Supabase. La función valida la credencial antes de tocar nada.

`--use-api` empaqueta en el servidor y **evita necesitar Docker**, que no está
instalado en los equipos de desarrollo. `--project-ref` ahorra tener que
vincular la carpeta con `supabase link` (que además pediría la contraseña de
la base de datos, innecesaria para publicar funciones).

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase sola. **No
hay que ponerlas en ningún archivo.**

### 3. Emitir la credencial

```bash
python crear-api-key.py "Nombre del cliente" --bases "BASE 3"
```

Muestra la key **una sola vez** e imprime el SQL para registrarla. En la base
solo queda el SHA-256.

Entrégala por un canal seguro. Si se pierde, se revoca y se emite otra:

```bash
python crear-api-key.py --revocar ck_a1b2c3d4
```

### 4. Comprobar

```bash
URL="https://cbplebkmxrkaafqdhiyi.supabase.co/functions/v1/api-externa"

curl -i "$URL/estado"                              # espera 401
curl -i -H "X-API-Key: no-existe" "$URL/estado"    # espera 401
curl -s -H "X-API-Key: $KEY" "$URL/estado"         # espera 200
curl -s -H "X-API-Key: $KEY" "$URL/programacion?fecha=2026-09-21"
```

Y lo importante: **que no se filtre nada de otras bases ni ningún motivo de
ausencia**.

```bash
curl -s -H "X-API-Key: $KEY" "$URL/programacion" -o prog.json

# 1. Ninguna base distinta de la autorizada
r=$(grep -oiE "BASE [0-9]+" prog.json | sort -u | grep -v "^BASE 3$" || true)
[ -n "$r" ] && echo "FUGA DE BASE: $r" || echo "OK - solo la base autorizada"

# 2. Ningun motivo de ausencia
r=$(grep -oiE "INCAPACI[A-Z]*|CALAMIDAD|PERMISO|VACACION[A-Z]*|RENUNCIA|DESCANSO|NO REMUNERADO|RECONOCIMIENTO" prog.json || true)
[ -n "$r" ] && echo "FUGA DE DATO SENSIBLE: $r" || echo "OK - ningun motivo de ausencia"

# 3. Ningun nombre con el estado pegado entre corchetes
r=$(grep -oE '"conductor(_2)?": "[^"]*\[' prog.json || true)
[ -n "$r" ] && echo "FUGA: $r" || echo "OK - ningun sufijo entre corchetes"
```

Las tres tienen que decir **OK**. Si alguna avisa de fuga, **no entregar la
credencial** y revisar `nombreConductor()`.

> Guardar la respuesta en un fichero y evaluarla con `$(...)` no es un
> capricho: encadenar `grep ... | sort -u` dentro de un `if` **siempre da
> verdadero**, porque el codigo de salida que se evalua es el del ultimo
> comando de la tuberia, no el de `grep`. Escrita asi, la comprobacion avisa
> de fugas que no existen, y una alarma que siempre suena acaba ignorandose.

---

## Operación

**Quién consulta y cuánto:**

```sql
select c.nombre, c.key_prefijo, count(*) as consultas, max(a.creado_en) as ultima
from public.api_accesos a
join public.api_clientes c on c.id = a.cliente_id
where a.creado_en > now() - interval '24 hours'
group by 1, 2 order by consultas desc;
```

**Intentos fallidos** (si aparecen muchos 401, alguien está probando keys):

```sql
select status, count(*), max(creado_en)
from public.api_accesos
where creado_en > now() - interval '24 hours' and status >= 400
group by status order by 2 desc;
```

**Revocar ya mismo:**

```sql
update public.api_clientes set activo = false where key_prefijo = 'ck_xxxxxxxx';
```

Surte efecto en la siguiente consulta. No se borra la fila: se conserva para
poder auditar lo que hizo.

**Purgar el registro** (se conservan 90 días). Si el proyecto tiene `pg_cron`:

```sql
select cron.schedule('purgar-api-accesos', '0 3 * * *', 'select public.api_accesos_purgar()');
```

Si no, ejecutar `select public.api_accesos_purgar();` de vez en cuando.

---

## Carga esperada

| | |
|---|---|
| Programación de una base en un día | ~30-40 filas ≈ **15 KB** |
| 60 personas del cliente, cada 30 min | 120 consultas/hora |
| Con el patrón recomendado (`/estado` primero) | **2 consultas/hora** |

El cliente consulta con **una sola credencial** desde su servidor y reparte a
sus usuarios. Repartir la credencial entre 60 personas sería el problema: no
por la carga, sino porque la primera filtración obligaría a cortarle a todos
sin saber de quién salió.

---

## Pendientes

**Programación provisional.** Se entrega el estado en vivo, con
`provisional: true`, porque hoy no existe forma de marcar un día como cerrado.
Si el cliente necesita datos en firme, hay que añadir esa marca en la app y un
parámetro `solo_cerradas` en la API.

**Sin caché propia.** Con este volumen no hace falta. Si algún día creciera,
lo natural es cachear la respuesta de `/estado` unos segundos.
