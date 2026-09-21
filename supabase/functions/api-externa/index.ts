/**
 * API externa de solo lectura - CombuAsigna
 * ---------------------------------------------------------------------------
 * Expone la programacion de una base concreta a un sistema de terceros, con un
 * contrato propio que NO refleja las tablas internas. Asi el esquema de la base
 * puede cambiar sin romper al cliente, y el cliente nunca ve mas de lo suyo.
 *
 * Endpoints (todos GET, todos de solo lectura):
 *
 *   GET /estado
 *       Metadatos baratos: si cambio algo y cuantos turnos hay. Pensado para
 *       preguntar a menudo sin traerse la programacion entera.
 *
 *   GET /programacion?fecha=AAAA-MM-DD
 *       Turnos del dia: puesto, vehiculo, horas y conductores.
 *
 *   GET /disponibilidad?fecha=AAAA-MM-DD
 *       Cobertura por puesto, SIN motivos de ausencia.
 *
 *   GET /novedades?fecha=AAAA-MM-DD
 *       Quien no trabaja ese dia. Los motivos operativos (descanso,
 *       vacaciones...) salen tal cual; los que tocan salud o situacion
 *       personal se agrupan como AUSENCIA.
 *
 * Autenticacion: cabecera  X-API-Key: <key>
 *
 * Decisiones deliberadas:
 *
 *   - NO se habilita CORS. Esto es servidor-a-servidor: si se pudiera llamar
 *     desde un navegador, la API key acabaria dentro de un frontend, a la vista
 *     de cualquiera. Que el navegador lo bloquee es la intencion.
 *
 *   - La base NO es un parametro. Sale de lo que el cliente tiene autorizado en
 *     api_clientes.bases. Aunque pida otra, para el no existe.
 *
 *   - Los motivos de ausencia (incapacidad, calamidad, permiso...) no salen por
 *     ninguna via. Son datos de salud y situacion laboral de personas con
 *     nombre y apellido: dato sensible bajo la Ley 1581 de 2012, que exige
 *     autorizacion expresa del titular. El cliente necesita saber si el turno
 *     esta cubierto, no por que. Ojo: en la programacion el estado viene pegado
 *     al nombre ("Juan Perez [INCAPACITADO]"), asi que hay que limpiarlo —
 *     devolver row_data en crudo filtraria el dato sin tocar la tabla novedades.
 *
 * Variables de entorno (las pone Supabase, nunca van en el codigo):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERSION = "v1";

// Turnos de una fecha futura o muy antigua no tienen sentido para el cliente.
const DIAS_ATRAS_MAX = 30;
const DIAS_ADELANTE_MAX = 60;

// ---------------------------------------------------------------------------
// Normalizacion de las columnas
//
// Los nombres de columna salen del Excel que se importa, asi que varian
// ("VEH", "VEHICULO", "MOVIL"...). Estos alias son los mismos que usa la app
// en renderTable2(); si alli se anaden variantes, hay que reflejarlas aqui.
// ---------------------------------------------------------------------------
const ALIAS: Record<string, string[]> = {
  puesto:     ["#"],
  inicia:     ["INICIA", "INICIO", "HORAINICIO", "HORAINICIO1"],
  vehiculo:   ["VEH", "VEHICULO", "MOVIL"],
  conductor:  ["CONDUCTOR1", "CONDUCTOI1", "CONDUCTOR", "CONDUCTOI"],
  inicia2:    ["INICIA2", "INICIO2", "HORAINICIO2"],
  conductor2: ["CONDUCTOR2", "CONDUCTOI2"],
  horaFin:    ["HORAFIN", "HORAFINAL", "FIN"],
};

/** Quita acentos, mayusculas y todo lo que no sea letra o numero. */
function tok(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Busca en la fila la primera columna que encaje con alguno de los alias. */
function campo(fila: Record<string, unknown>, campoLogico: string): unknown {
  const alias = ALIAS[campoLogico] || [];
  // "#" se queda en cadena vacia al normalizar, asi que va por nombre exacto.
  if (campoLogico === "puesto" && Object.hasOwn(fila, "#")) return fila["#"];
  for (const clave of Object.keys(fila)) {
    if (clave.startsWith("__")) continue;           // claves internas de la app
    const t = tok(clave);
    if (t && alias.some((a) => tok(a) === t)) return fila[clave];
  }
  return undefined;
}

// Cualquier sufijo entre corchetes, no solo los estados que existen hoy. La app
// pega el estado al nombre ("Juan Perez [INCAPACITADO]") y la lista de estados
// puede crecer: si aqui se enumeraran los conocidos, un estado nuevo pasaria
// derecho y filtraria un dato sensible. Se limpia a ciegas, que es el lado
// seguro del error.
const ESTADOS_PEGADOS = /\s*\[[^\]]*\]\s*$/;

const SIN_CONDUCTOR = "SIN CONDUCTOR PROGRAMADO";

// ---------------------------------------------------------------------------
// Que estados de novedad salen con su nombre y cuales se agrupan
//
// Los de esta lista se entregan tal cual: dicen "hoy no trabaja" y nada mas
// sobre la persona. Cualquier otro se responde como AUSENCIA, sin el motivo,
// porque toca la salud o la situacion personal del trabajador y es dato
// sensible bajo la Ley 1581 de 2012.
//
// Mover un estado de un grupo al otro es editar esta lista y volver a publicar.
// Es una decision del negocio, no tecnica: antes de sacar un estado de aqui,
// conviene que quede claro que la empresa puede entregar ese dato.
// ---------------------------------------------------------------------------
const ESTADOS_OPERATIVOS = [
  "DESCANSO",                 // turno libre previsto
  "VACACIONES",               // derecho laboral ordinario y previsible
  "RECONOCIMIENTO DE RUTA",   // esta en formacion: es informacion operativa
  "DISPONIBLE",               // sin novedad
];

// Los demas (INCAPACITADO, CALAMIDAD, PERMISO, DIA NO REMUNERADO, RENUNCIA)
// se responden con esta etiqueta, sin distinguirlos entre si.
const ESTADO_RESERVADO = "AUSENCIA";

function estadoPublico(estado: unknown): string {
  const t = tok(estado);
  if (!t) return ESTADO_RESERVADO;
  const operativo = ESTADOS_OPERATIVOS.find((e) => tok(e) === t);
  return operativo ?? ESTADO_RESERVADO;
}

/**
 * Devuelve solo el nombre, sin el estado que la app le pega entre corchetes.
 * Es la barrera que impide que un motivo de ausencia salga por la API.
 */
function nombreConductor(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  if (tok(texto) === tok(SIN_CONDUCTOR)) return null;
  const limpio = texto.replace(ESTADOS_PEGADOS, "").trim();
  return limpio || null;
}

/** Normaliza la hora a HH:MM, venga como texto o como fraccion de dia de Excel. */
function hora(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;

  if (typeof valor === "number" && Number.isFinite(valor)) {
    const fraccion = valor % 1;
    const totalMin = Math.round(fraccion * 24 * 60);
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  const texto = String(valor).trim();
  const m = texto.match(/^(\d{1,2})[:.h](\d{2})/i);
  if (m) {
    const hh = Math.min(23, parseInt(m[1], 10));
    const mm = Math.min(59, parseInt(m[2], 10));
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return texto || null;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function json(cuerpo: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(cuerpo, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Sin CORS a proposito: ver la nota de arriba.
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
      ...extra,
    },
  });
}

function error(status: number, codigo: string, mensaje: string, extra: Record<string, string> = {}): Response {
  return json({ error: { codigo, mensaje } }, status, extra);
}

async function sha256(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const buffer = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fechaValida(texto: string | null): string | null {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const d = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;

  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < -DIAS_ATRAS_MAX || dias > DIAS_ADELANTE_MAX) return null;
  return texto;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Autenticacion y control de uso
// ---------------------------------------------------------------------------
interface Cliente {
  id: number;
  nombre: string;
  key_prefijo: string;
  bases: string[];
  limite_hora: number;
}

async function autenticar(req: Request, db: ReturnType<typeof createClient>) {
  const key = req.headers.get("x-api-key")?.trim();
  if (!key) {
    return { fallo: error(401, "sin_credencial", "Falta la cabecera X-API-Key.") };
  }

  const hash = await sha256(key);
  const { data, error: errDb } = await db
    .from("api_clientes")
    .select("id, nombre, key_prefijo, bases, limite_hora, expira_en")
    .eq("key_hash", hash)
    .eq("activo", true)
    .maybeSingle();

  if (errDb) {
    console.error("[api-externa] error consultando api_clientes:", errDb.message);
    return { fallo: error(500, "error_interno", "No se pudo validar la credencial.") };
  }
  // Mismo mensaje para key inexistente y key desactivada: no damos pistas.
  if (!data) {
    return { fallo: error(401, "credencial_invalida", "Credencial no valida.") };
  }
  if (data.expira_en && new Date(data.expira_en) < new Date()) {
    return { fallo: error(401, "credencial_expirada", "La credencial expiro.") };
  }
  if (!Array.isArray(data.bases) || data.bases.length === 0) {
    return { fallo: error(403, "sin_alcance", "La credencial no tiene ninguna base asignada.") };
  }

  // Limite por hora, contado sobre el registro de accesos.
  const desde = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db
    .from("api_accesos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", data.id)
    .gte("creado_en", desde);

  if ((count ?? 0) >= data.limite_hora) {
    return {
      fallo: error(429, "limite_alcanzado",
        `Superaste el limite de ${data.limite_hora} consultas por hora.`,
        { "Retry-After": "600" }),
    };
  }

  return { cliente: data as Cliente };
}

async function registrarAcceso(
  db: ReturnType<typeof createClient>,
  cliente: Cliente | null,
  req: Request,
  endpoint: string,
  status: number,
  fecha: string | null,
  filas: number | null,
) {
  try {
    await db.from("api_accesos").insert({
      cliente_id: cliente?.id ?? null,
      key_prefijo: cliente?.key_prefijo ?? null,
      endpoint,
      fecha_consultada: fecha,
      status,
      filas_devueltas: filas,
      ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    });
    if (cliente) {
      await db.from("api_clientes").update({ ultimo_acceso: new Date().toISOString() }).eq("id", cliente.id);
    }
  } catch (e) {
    // El registro no puede tumbar la respuesta al cliente.
    console.error("[api-externa] no se pudo registrar el acceso:", e);
  }
}

// ---------------------------------------------------------------------------
// Lectura de la programacion
// ---------------------------------------------------------------------------
interface Turno {
  puesto: number | string | null;
  vehiculo: string | null;
  inicia: string | null;
  conductor: string | null;
  inicia_2: string | null;
  conductor_2: string | null;
  hora_fin: string | null;
}

async function leerTurnos(
  db: ReturnType<typeof createClient>,
  bases: string[],
  fecha: string,
): Promise<Turno[]> {
  // La app puede tener varias cargas del mismo dia; vale la ultima, igual que
  // hace loadTargetProgramacionByDate() en el cliente.
  const { data: ultima, error: errUltima } = await db
    .from("programacion_filas")
    .select("programacion_id")
    .eq("fecha", fecha)
    .in("base", bases)
    .order("programacion_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errUltima) throw errUltima;
  if (!ultima?.programacion_id) return [];

  const filas: Record<string, unknown>[] = [];
  const pagina = 1000;
  for (let desde = 0; ; desde += pagina) {
    const { data, error: errFilas } = await db
      .from("programacion_filas")
      .select("row_data")
      .eq("fecha", fecha)
      .eq("programacion_id", ultima.programacion_id)
      .in("base", bases)
      .order("id", { ascending: true })
      .range(desde, desde + pagina - 1);

    if (errFilas) throw errFilas;
    const lote = data ?? [];
    for (const f of lote) {
      if (f?.row_data && typeof f.row_data === "object") {
        filas.push(f.row_data as Record<string, unknown>);
      }
    }
    if (lote.length < pagina) break;
  }

  const turnos = filas.map((fila): Turno => {
    const puestoBruto = campo(fila, "puesto");
    const n = Number(puestoBruto);
    return {
      puesto: Number.isFinite(n) && String(puestoBruto).trim() !== "" ? n : (puestoBruto as string) ?? null,
      vehiculo: String(campo(fila, "vehiculo") ?? "").trim() || null,
      inicia: hora(campo(fila, "inicia")),
      conductor: nombreConductor(campo(fila, "conductor")),
      inicia_2: hora(campo(fila, "inicia2")),
      conductor_2: nombreConductor(campo(fila, "conductor2")),
      hora_fin: hora(campo(fila, "horaFin")),
    };
  });

  turnos.sort((a, b) => {
    const pa = typeof a.puesto === "number" ? a.puesto : Number.MAX_SAFE_INTEGER;
    const pb = typeof b.puesto === "number" ? b.puesto : Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });
  return turnos;
}

// ---------------------------------------------------------------------------
// Enrutado
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // La ruta llega como /api-externa/<endpoint>
  const partes = url.pathname.split("/").filter(Boolean);
  const endpoint = partes[partes.length - 1] || "";

  if (req.method !== "GET") {
    return error(405, "metodo_no_permitido", "Esta API es de solo lectura: usa GET.");
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const auth = await autenticar(req, db);
  if (auth.fallo) {
    await registrarAcceso(db, null, req, endpoint, auth.fallo.status, null, null);
    return auth.fallo;
  }
  const cliente = auth.cliente!;
  const bases = cliente.bases;

  try {
    // -- /estado ------------------------------------------------------------
    // Barato de pedir: dice si cambio algo sin mandar la programacion entera.
    if (endpoint === "estado") {
      const fecha = fechaValida(url.searchParams.get("fecha")) ?? hoyIso();
      const turnos = await leerTurnos(db, bases, fecha);
      const huella = await sha256(JSON.stringify(turnos));
      const cuerpo = {
        version: VERSION,
        bases,
        fecha,
        hay_programacion: turnos.length > 0,
        total_turnos: turnos.length,
        huella,                       // cambia si cambio cualquier turno
        consultado_en: new Date().toISOString(),
      };
      await registrarAcceso(db, cliente, req, endpoint, 200, fecha, turnos.length);
      return json(cuerpo, 200, { ETag: `"${huella}"` });
    }

    // -- /programacion ------------------------------------------------------
    if (endpoint === "programacion") {
      const fechaPedida = url.searchParams.get("fecha");
      const fecha = fechaValida(fechaPedida) ?? (fechaPedida ? null : hoyIso());
      if (!fecha) {
        await registrarAcceso(db, cliente, req, endpoint, 400, null, null);
        return error(400, "fecha_invalida",
          `Usa fecha=AAAA-MM-DD, entre ${DIAS_ATRAS_MAX} dias atras y ${DIAS_ADELANTE_MAX} adelante.`);
      }

      const turnos = await leerTurnos(db, bases, fecha);
      const huella = await sha256(JSON.stringify(turnos));

      // Si el cliente ya tiene esta misma version, no se reenvia nada.
      // El ETag hay que normalizarlo: el proxy que hay delante lo devuelve como
      // weak (W/"..."), asi que el cliente nos lo reenvia con ese prefijo y una
      // comparacion literal no casaria nunca -- se mandaria el cuerpo entero
      // cada vez, que es justo lo que este atajo evita.
      const etagRecibido = (req.headers.get("if-none-match") ?? "")
        .replace(/^W\//i, "")
        .replace(/"/g, "")
        .trim();
      if (etagRecibido && etagRecibido === huella) {
        await registrarAcceso(db, cliente, req, endpoint, 304, fecha, 0);
        return new Response(null, { status: 304, headers: { ETag: `"${huella}"` } });
      }

      const cuerpo = {
        version: VERSION,
        bases,
        fecha,
        // La programacion se sigue editando durante el dia: lo que se entrega
        // es el estado actual, no una version cerrada.
        provisional: true,
        total: turnos.length,
        turnos,
        consultado_en: new Date().toISOString(),
      };
      await registrarAcceso(db, cliente, req, endpoint, 200, fecha, turnos.length);
      return json(cuerpo, 200, { ETag: `"${huella}"` });
    }

    // -- /disponibilidad ----------------------------------------------------
    // Cobertura, nunca el motivo de una ausencia.
    if (endpoint === "disponibilidad") {
      const fechaPedida = url.searchParams.get("fecha");
      const fecha = fechaValida(fechaPedida) ?? (fechaPedida ? null : hoyIso());
      if (!fecha) {
        await registrarAcceso(db, cliente, req, endpoint, 400, null, null);
        return error(400, "fecha_invalida", "Usa fecha=AAAA-MM-DD.");
      }

      const turnos = await leerTurnos(db, bases, fecha);
      const detalle = turnos.map((t) => {
        // Un puesto tiene 1 o 2 turnos segun si hay segunda jornada definida.
        const tiene2 = !!t.inicia_2;
        const cubiertos = (t.conductor ? 1 : 0) + (tiene2 && t.conductor_2 ? 1 : 0);
        const totales = 1 + (tiene2 ? 1 : 0);
        return {
          puesto: t.puesto,
          vehiculo: t.vehiculo,
          turnos_cubiertos: cubiertos,
          turnos_totales: totales,
          cubierto: cubiertos === totales,
        };
      });

      const cuerpo = {
        version: VERSION,
        bases,
        fecha,
        provisional: true,
        total_puestos: detalle.length,
        puestos_cubiertos: detalle.filter((d) => d.cubierto).length,
        puestos_sin_cubrir: detalle.filter((d) => !d.cubierto).length,
        puestos: detalle,
        consultado_en: new Date().toISOString(),
      };
      await registrarAcceso(db, cliente, req, endpoint, 200, fecha, detalle.length);
      return json(cuerpo);
    }

    // -- /novedades ---------------------------------------------------------
    // Quien no trabaja ese dia en la base autorizada. Los motivos operativos
    // salen tal cual; los que tocan salud o situacion personal se agrupan bajo
    // AUSENCIA (ver ESTADOS_OPERATIVOS arriba).
    if (endpoint === "novedades") {
      const fechaPedida = url.searchParams.get("fecha");
      const fecha = fechaValida(fechaPedida) ?? (fechaPedida ? null : hoyIso());
      if (!fecha) {
        await registrarAcceso(db, cliente, req, endpoint, 400, null, null);
        return error(400, "fecha_invalida", "Usa fecha=AAAA-MM-DD.");
      }

      const { data, error: errNov } = await db
        .from("novedades")
        .select("nombre, estado")
        .eq("fecha", fecha)
        .in("base", bases)
        .order("nombre", { ascending: true });
      if (errNov) throw errNov;

      const novedades = (data ?? [])
        .map((n) => ({
          // Se limpia igual que en la programacion, por si el nombre llegara
          // con algo pegado entre corchetes.
          conductor: nombreConductor(n?.nombre),
          estado: estadoPublico(n?.estado),
        }))
        .filter((n) => n.conductor);

      const resumen: Record<string, number> = {};
      for (const n of novedades) resumen[n.estado] = (resumen[n.estado] ?? 0) + 1;

      const cuerpo = {
        version: VERSION,
        bases,
        fecha,
        provisional: true,
        total: novedades.length,
        resumen,
        novedades,
        consultado_en: new Date().toISOString(),
      };
      await registrarAcceso(db, cliente, req, endpoint, 200, fecha, novedades.length);
      return json(cuerpo);
    }

    await registrarAcceso(db, cliente, req, endpoint, 404, null, null);
    return error(404, "no_encontrado",
      "Endpoints disponibles: /estado, /programacion, /disponibilidad, /novedades.");
  } catch (e) {
    // Al cliente no se le cuenta nada del fallo interno; el detalle va al log.
    console.error("[api-externa] fallo atendiendo", endpoint, e);
    await registrarAcceso(db, cliente, req, endpoint, 500, null, null);
    return error(500, "error_interno", "No se pudo atender la consulta.");
  }
});
