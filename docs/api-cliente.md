# API de programación — Guía de integración

Documento para el equipo técnico que va a consumir la API.

API de **solo lectura** para consultar la programación diaria de la base
autorizada. Todo va por HTTPS y requiere una credencial propia.

---

## 1. Lo esencial

```
URL base:       https://cbplebkmxrkaafqdhiyi.supabase.co/functions/v1/api-externa
Autenticación:  cabecera  X-API-Key: <su credencial>
Métodos:        solo GET
Formato:        JSON (UTF-8)
```

La credencial se entrega por separado y **no se puede recuperar**: si se
pierde, se revoca y se emite otra.

> **Es una integración servidor-a-servidor.** La API no admite llamadas desde
> un navegador (no habilita CORS), y es a propósito: una credencial dentro de
> una página web queda a la vista de cualquiera. Llámenla desde su backend y
> sirvan el resultado a sus usuarios desde ahí.

---

## 2. Cómo consultar sin saturar

Está pensada para que consultar seguido salga prácticamente gratis. La idea:
**pregunten primero si cambió algo, y solo entonces pidan la programación.**

```
cada 30 min  ->  GET /estado            (~200 bytes)
                 ¿cambió la huella?
                       │
                   sí  └──>  GET /programacion   (~15 KB)
                             GET /novedades      (~2 KB)
                   no  └──>  no hacer nada
```

El campo `huella` cambia únicamente si cambió algún turno. Guárdenlo y
compárenlo en la siguiente consulta.

`/programacion` también admite `ETag`: si envían la cabecera `If-None-Match`
con el valor recibido antes y nada cambió, responde **304** sin cuerpo.

**Límite:** 240 consultas por hora. Consultando cada 30 minutos usan 2, así
que hay margen de sobra. Al superarlo se responde `429` con `Retry-After`.

---

## 3. Endpoints

### `GET /estado`

Metadatos baratos. Sirve para saber si vale la pena pedir el resto.

| Parámetro | Obligatorio | Descripción |
|-----------|-------------|-------------|
| `fecha`   | No | `AAAA-MM-DD`. Por defecto, hoy. |

```json
{
  "version": "v1",
  "bases": ["BASE 3"],
  "fecha": "2026-09-21",
  "hay_programacion": true,
  "total_turnos": 34,
  "huella": "9f2a1c...",
  "consultado_en": "2026-09-21T14:32:11.000Z"
}
```

---

### `GET /programacion`

Turnos del día.

| Parámetro | Obligatorio | Descripción |
|-----------|-------------|-------------|
| `fecha`   | No | `AAAA-MM-DD`. Por defecto, hoy. Rango: 30 días atrás a 60 adelante. |

```json
{
  "version": "v1",
  "bases": ["BASE 3"],
  "fecha": "2026-09-21",
  "provisional": true,
  "total": 34,
  "turnos": [
    {
      "puesto": 1,
      "vehiculo": "708",
      "inicia": "04:30",
      "conductor": "Juan Pérez",
      "inicia_2": "12:15",
      "conductor_2": "María Gómez",
      "hora_fin": "20:00"
    }
  ],
  "consultado_en": "2026-09-21T14:32:11.000Z"
}
```

**`provisional: true` importa.** La programación se sigue editando durante el
día: lo que reciben es el estado en ese momento, no una versión cerrada. Un
turno sin conductor puede significar que todavía no lo han asignado, no que
vaya a quedar sin cubrir. Consúltenlo de nuevo antes de tomar decisiones sobre
la operación del día.

`conductor` y `conductor_2` vienen en `null` cuando el turno aún no tiene a
nadie asignado. `inicia_2` y `conductor_2` van en `null` si ese puesto solo
tiene una jornada.

---

### `GET /disponibilidad`

Cobertura por puesto, sin datos personales.

| Parámetro | Obligatorio | Descripción |
|-----------|-------------|-------------|
| `fecha`   | No | `AAAA-MM-DD`. Por defecto, hoy. |

```json
{
  "version": "v1",
  "fecha": "2026-09-21",
  "provisional": true,
  "total_puestos": 34,
  "puestos_cubiertos": 31,
  "puestos_sin_cubrir": 3,
  "puestos": [
    { "puesto": 1, "vehiculo": "708", "turnos_cubiertos": 2, "turnos_totales": 2, "cubierto": true },
    { "puesto": 2, "vehiculo": "733", "turnos_cubiertos": 1, "turnos_totales": 2, "cubierto": false }
  ]
}
```

> **Los motivos de ausencia no se entregan por ninguna vía.** Incapacidades,
> calamidades, permisos y similares son datos de salud y situación laboral de
> personas identificadas: dato sensible bajo la Ley 1581 de 2012, cuyo
> tratamiento exige autorización expresa del titular. La API responde si el
> turno está cubierto, que es lo que la operación necesita saber.

---

### `GET /novedades`

Quién no trabaja ese día en la base.

| Parámetro | Obligatorio | Descripción |
|-----------|-------------|-------------|
| `fecha`   | No | `AAAA-MM-DD`. Por defecto, hoy. |

```json
{
  "version": "v1",
  "bases": ["BASE 3"],
  "fecha": "2026-09-21",
  "provisional": true,
  "total": 20,
  "resumen": { "DESCANSO": 13, "VACACIONES": 4, "DISPONIBLE": 1, "AUSENCIA": 2 },
  "novedades": [
    { "conductor": "Juan Pérez",  "estado": "DESCANSO" },
    { "conductor": "María Gómez", "estado": "VACACIONES" },
    { "conductor": "Ana Díaz",    "estado": "AUSENCIA" }
  ]
}
```

**Estados que pueden llegar:**

| Estado | Significado |
|--------|-------------|
| `DESCANSO` | Turno libre previsto |
| `VACACIONES` | En periodo de vacaciones |
| `RECONOCIMIENTO DE RUTA` | En formación |
| `DISPONIBLE` | Sin novedad |
| `AUSENCIA` | No trabaja ese día por un motivo que no se detalla |

> **`AUSENCIA` agrupa varios motivos a propósito.** Cuando la razón tiene que
> ver con la salud o la situación personal del trabajador (incapacidades,
> calamidades y similares), se trata de dato sensible bajo la Ley 1581 de 2012
> y no se entrega desglosado. A efectos operativos el dato útil es el mismo:
> esa persona no está disponible ese día.

Un conductor con novedad **no puede quedar asignado** a un turno ese día, así
que lo verán también reflejado en `/programacion` (turno sin conductor) y en
`/disponibilidad` (`cubierto: false`).

---

## 4. Errores

Todos llegan con esta forma:

```json
{ "error": { "codigo": "credencial_invalida", "mensaje": "Credencial no valida." } }
```

| HTTP | Código | Qué hacer |
|------|--------|-----------|
| 400 | `fecha_invalida` | Revisar el formato `AAAA-MM-DD` y el rango permitido. |
| 401 | `sin_credencial` | Falta la cabecera `X-API-Key`. |
| 401 | `credencial_invalida` | La credencial no sirve o fue revocada. Contactar. |
| 401 | `credencial_expirada` | Caducó. Solicitar una nueva. |
| 403 | `sin_alcance` | La credencial no tiene base asignada. Contactar. |
| 405 | `metodo_no_permitido` | Solo se admite `GET`. |
| 429 | `limite_alcanzado` | Esperar lo que indique `Retry-After` y espaciar las consultas. |
| 500 | `error_interno` | Fallo del lado nuestro. Reintentar con espera progresiva. |

**Reintentos:** ante un `429` o `500`, esperar y reintentar de forma
progresiva (1 min, 2, 4...). No reintentar en bucle: cuenta para el límite.

---

## 5. Ejemplos

**curl**

```bash
curl -H "X-API-Key: $COMBUSES_API_KEY" \
     "https://cbplebkmxrkaafqdhiyi.supabase.co/functions/v1/api-externa/programacion?fecha=2026-09-21"
```

**Python** — el patrón recomendado, consultando cada 30 minutos:

```python
import requests

BASE = "https://cbplebkmxrkaafqdhiyi.supabase.co/functions/v1/api-externa"
CABECERAS = {"X-API-Key": os.environ["COMBUSES_API_KEY"]}

huella_previa = None   # persistir entre ejecuciones

def sincronizar():
    global huella_previa
    estado = requests.get(f"{BASE}/estado", headers=CABECERAS, timeout=15).json()

    if estado["huella"] == huella_previa:
        return None                      # nada cambió, no se pide más

    datos = requests.get(f"{BASE}/programacion",
                         params={"fecha": estado["fecha"]},
                         headers=CABECERAS, timeout=15).json()
    huella_previa = estado["huella"]
    return datos
```

---

## 6. Compromisos

**La credencial es de la empresa, no de cada persona.** Su sistema consulta
con una sola credencial y reparte el resultado a sus usuarios. No la
distribuyan entre varias personas ni la incluyan en aplicaciones que se
instalen en equipos de usuario final: si se filtra, hay que revocarla y eso
deja sin servicio a todos.

**Guárdenla como una contraseña**: en variables de entorno o en un gestor de
secretos, nunca en el código ni en un repositorio.

**Avisen de inmediato** si sospechan que quedó expuesta. Revocarla y emitir
otra toma un minuto.

**Versionado:** el campo `version` identifica el contrato. Si hay cambios que
rompan compatibilidad se publicará como `v2` y `v1` seguirá funcionando
durante la transición. Los campos nuevos pueden aparecer sin aviso, así que
conviene que su lectura ignore los que no conozca.

**Todos los accesos quedan registrados** (credencial, endpoint, fecha, hora e
IP), tanto para auditoría como para diagnosticar problemas.
