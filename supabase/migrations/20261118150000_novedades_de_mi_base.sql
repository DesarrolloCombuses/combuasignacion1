-- Mi base (CombuAsigna · Portal de Afiliados), 18-nov-2026.
--
-- Pedido: que cada afiliado tenga, bien organizado y solo de SU base:
--   A. Novedades del día:
--      1. Entradas: quién inició labores, a qué hora y contra qué turno (a tiempo / temprano / tarde).
--      2. Motivos escritos: entró más de 15 min antes, en otro turno, fuera de horario, jornada larga.
--      3. Los que faltan: programados que ya debían entrar, los que entran pronto, los disponibles.
--      4. Salidas y jornadas: la salida de cada entrada, turnos sin cerrar, jornadas de más de 16 h.
--      Con nombre, cédula, bus y foto (la foto la firma la app con el bucket asistencia-fotos).
--   B. "Cada novedad debe ser gestionada por la base": la base marca cada novedad como REVISADA y escribe una
--      nota. Se revisan: entradas con motivo, llegadas tarde, programados que no entraron, turnos sin cerrar y
--      jornadas de más de 16 h. Queda quién y cuándo.
--   C. El viaje a viaje de sus carros, con la plata (la misma vista v_tarjeta_viajes que usa el Portal de Control).
--   D. El nuevo enturnamiento: la fila de cada punto con sus buses resaltados, y dónde está cada bus suyo.
--
-- Quién ve qué (lo decide la base de datos, no la página):
--   - Cuenta de base (baseN@combuses.com.co): SOLO la BASE N, pida lo que pida. Solo ella revisa sus novedades.
--   - Administrador de CombuAsigna o administrador del biométrico (perfiles.rol = 'admin'): ve la base que abra.
--   - Cualquier otra cuenta (un conductor, por ejemplo): no ve nada.
--
-- Los buses de una base: los que la programación puso en esa base en los últimos 30 días (cada bus está siempre
-- en una sola base: 51 de 51 en oct-nov 2026).
--
-- Solo agrega cosas nuevas (1 tabla, 6 funciones). No cambia tablas, triggers ni permisos que ya existan.
-- Para quitarlo todo: supabase/migrations/quitar_mi_base.sql (en la misma carpeta).

-- ---------------------------------------------------------------------------------------------------------------
-- Quién es la cuenta y qué base puede ver. Devuelve 'BASE N' o corta con el error que ve la página.
create or replace function public.afiliados_base_de_la_cuenta(p_base text default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_num   text;
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión para ver su base.' using errcode = '42501';
  end if;
  v_num := substring(v_email from '^base\s*([0-9]+)@combuses\.com\.co$');
  if v_num is not null then
    return 'BASE ' || v_num;
  end if;
  if v_email = 'administrador@combuses.com.co'
     or exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo and p.rol = 'admin') then
    v_num := substring(upper(trim(coalesce(p_base, ''))) from '^(?:BASE\s*)?([0-9]+)$');
    if v_num is null then
      raise exception 'Abra una base para ver sus novedades.' using errcode = '22023';
    end if;
    return 'BASE ' || v_num;
  end if;
  raise exception 'Esta sección es solo para las cuentas de base.' using errcode = '42501';
end;
$function$;

-- La base escrita de cualquier forma ('3', 'base 3', 'BASE  3') queda como 'BASE 3'.
create or replace function public.afiliados_base_canonica(p text)
returns text
language sql
immutable
as $function$
  select case when trim(coalesce(p, '')) ~ '^[0-9]+$' then 'BASE ' || trim(p)
              else upper(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g')) end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- Lo que la base revisó. Una revisión por novedad (tipo + clave); si la vuelve a revisar, se cambia la nota.
--   tipo: motivo | tarde | no_entro | sin_cerrar | jornada_larga
--   clave: el id de la marca (entrada o salida) o, para no_entro, 'cédula|fecha|turno'.
create table if not exists public.afiliados_novedades_revision (
  id             bigint generated always as identity primary key,
  base           text not null,
  fecha          date not null,
  tipo           text not null check (tipo in ('motivo', 'tarde', 'no_entro', 'sin_cerrar', 'jornada_larga')),
  clave          text not null,
  dni            text,
  nombre         text,
  nota           text not null check (char_length(nota) between 5 and 500),
  revisado_por   text not null,
  revisado_uid   uuid not null,
  revisado_en    timestamptz not null default now(),
  veces          integer not null default 1,
  unique (tipo, clave)
);
create index if not exists afiliados_novedades_revision_base_fecha on public.afiliados_novedades_revision (base, fecha);
-- Sin políticas: nadie la lee ni la escribe directo; solo por las funciones de abajo.
alter table public.afiliados_novedades_revision enable row level security;

-- ---------------------------------------------------------------------------------------------------------------
-- A + B. Novedades del día de la base, con lo que hay por revisar.
create or replace function public.afiliados_novedades_base(p_fecha date default null, p_base text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_base   text := public.afiliados_base_de_la_cuenta(p_base);
  v_ahora  timestamp := (now() at time zone 'America/Bogota');
  v_hoy    date := (now() at time zone 'America/Bogota')::date;
  v_fecha  date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_motivo constant text := '^(ENTRADA ANTES DE TIEMPO|CAMBIO DE TURNO|(ENTRADA|SALIDA) [0-9]{1,2}:[0-9]{2} vs programada|Jornada de [0-9.,]+ h|Salida manual|⚠)';
  v_res    jsonb;
begin
  if v_fecha < v_hoy - 62 or v_fecha > v_hoy + 1 then
    raise exception 'Solo se pueden consultar los últimos 2 meses.' using errcode = '22023';
  end if;

  with
  -- Programación del día de esta base.
  prog as (
    select pt.dni, pt.turno, pt.hora_entrada, pt.hora_salida, pt.entrada_ts, pt.salida_ts,
           nullif(trim(pt.vehiculo), '') as vehiculo, upper(coalesce(pt.puesto, '')) as puesto,
           coalesce(c.nombre, pt.nombre_programacion) as nombre
      from public.programacion_turnos pt
      left join lateral (select c.nombre from public.colaboradores c where c.dni = pt.dni
                          order by c.updated_at desc nulls last limit 1) c on true
     where pt.fecha = v_fecha and public.afiliados_base_canonica(pt.base) = v_base
  ),
  -- Marcas cercanas al día (la salida del turno 2 cae al día siguiente) con su base: la de la marca; si viene
  -- vacía, la de su programación de ese día; si tampoco, la base donde más lo programaron en 30 días.
  marcas as (
    select a.id, a.colaborador_id, a.fecha, a.hora, (a.fecha + a.hora) as ts, a.sentido, a.origen,
           a.observacion, a.foto_path, nullif(trim(a.vehiculo_reporte), '') as bus,
           a.vehiculo_programado, a.turno_programado, a.hora_programada, a.minutos_diferencia, a.puntualidad,
           a.punto_operativo, a.fecha_programada, c.dni, c.nombre,
           coalesce(
             nullif(public.afiliados_base_canonica(a.base_operativa), ''),
             (select public.afiliados_base_canonica(pt.base) from public.programacion_turnos pt
               where pt.dni = c.dni and pt.fecha = coalesce(a.fecha_programada, a.fecha)
               order by pt.turno limit 1),
             (select public.afiliados_base_canonica(pt.base) from public.programacion_turnos pt
               where pt.dni = c.dni and pt.fecha between coalesce(a.fecha_programada, a.fecha) - 30
                                                     and coalesce(a.fecha_programada, a.fecha)
               group by 1 order by count(*) desc limit 1)
           ) as base_marca
      from public.asistencias a
      join public.colaboradores c on c.id = a.colaborador_id
     where a.fecha between v_fecha - 1 and v_fecha + 1
  ),
  -- Entradas del día de esta base, cada una con su salida (la siguiente salida antes de otra entrada, < 20 h).
  ent as (
    select e.*, s.id as s_id, s.fecha as s_fecha, s.hora as s_hora, s.origen as s_origen,
           s.observacion as s_obs, s.foto_path as s_foto, s.punto_operativo as s_punto,
           round(extract(epoch from (s.ts - e.ts)) / 3600.0, 1) as horas,
           exists (select 1 from regexp_split_to_table(coalesce(e.observacion, ''), '\s*\|\s*') t(parte)
                    where t.parte ~* v_motivo) as e_tiene_motivo,
           exists (select 1 from regexp_split_to_table(coalesce(s.observacion, ''), '\s*\|\s*') t(parte)
                    where t.parte ~* v_motivo) as s_tiene_motivo,
           (select jsonb_build_object('horas', je.horas, 'motivo', je.motivo)
              from public.jornadas_excedidas je
             where je.entrada_id = e.id or (s.id is not null and je.salida_id = s.id)
             order by je.created_at desc limit 1) as jornada
      from marcas e
      left join lateral (
        select m0.id, m0.fecha, m0.hora, (m0.fecha + m0.hora) as ts, m0.origen, m0.observacion,
               m0.foto_path, m0.punto_operativo
          from public.asistencias m0
         where m0.colaborador_id = e.colaborador_id and m0.sentido = 'salida'
           and m0.fecha between e.fecha and e.fecha + 1
           and (m0.fecha + m0.hora) > e.ts and (m0.fecha + m0.hora) <= e.ts + interval '20 hours'
           and not exists (select 1 from public.asistencias e2
                            where e2.colaborador_id = e.colaborador_id and e2.sentido = 'entrada'
                              and e2.fecha between e.fecha and e.fecha + 1
                              and (e2.fecha + e2.hora) > e.ts and (e2.fecha + e2.hora) < (m0.fecha + m0.hora))
         order by m0.fecha, m0.hora limit 1
      ) s on true
     where e.sentido = 'entrada' and coalesce(e.fecha_programada, e.fecha) = v_fecha and e.base_marca = v_base
  ),
  -- Cada turno programado con la entrada que le corresponde (misma regla del Verificador: ±6 h).
  prog_ent as (
    select p.*, x.id as entrada_id, x.hora as entrada_hora,
           case
             when x.id is not null then 'entro'
             when p.entrada_ts is null then 'sin_hora'
             -- pasadas 6 h ya no se le une ninguna entrada (misma ventana del Verificador)
             when v_ahora >= p.entrada_ts + interval '6 hours' then 'no_entro'
             when v_ahora >= p.entrada_ts + interval '15 minutes' then 'tarde'
             when v_ahora >= p.entrada_ts - interval '60 minutes' then 'proximo'
             else 'despues' end as estado
      from prog p
      left join lateral (
        select a.id, a.hora from public.asistencias a
          join public.colaboradores c2 on c2.id = a.colaborador_id
         where c2.dni = p.dni and a.sentido = 'entrada'
           and a.fecha between v_fecha - 1 and v_fecha + 1
           and p.entrada_ts is not null
           and abs(extract(epoch from ((a.fecha + a.hora) - p.entrada_ts))) <= 6 * 3600
         order by abs(extract(epoch from ((a.fecha + a.hora) - p.entrada_ts))) limit 1
      ) x on true
  ),
  -- Lo que la base tiene que revisar (B). La jornada de más de 16 h ya incluye lo que escribió al salir.
  por_revisar as (
    select 'motivo'::text as tipo, e.id::text as clave, e.id as ref, 'entrada'::text as de, e.dni, e.nombre, e.ts as orden
      from ent e where e.e_tiene_motivo
    union all
    select 'motivo', e.s_id::text, e.id, 'salida', e.dni, e.nombre, (e.s_fecha + e.s_hora)
      from ent e where e.s_id is not null and e.s_tiene_motivo and e.jornada is null
    union all
    select 'tarde', e.id::text, e.id, 'entrada', e.dni, e.nombre, e.ts
      from ent e where e.puntualidad = 'tarde' and not e.e_tiene_motivo
    union all
    select 'no_entro', p.dni || '|' || v_fecha::text || '|' || coalesce(p.turno::text, ''), null::uuid, null, p.dni, p.nombre, p.entrada_ts
      from prog_ent p where p.puesto <> 'DISPONIBLE' and p.estado in ('tarde', 'no_entro')
    union all
    select 'sin_cerrar', e.id::text, e.id, 'entrada', e.dni, e.nombre, e.ts
      from ent e where e.s_id is null and v_ahora - e.ts > interval '12 hours'
    union all
    select 'jornada_larga', e.id::text, e.id, 'entrada', e.dni, e.nombre, e.ts
      from ent e where e.jornada is not null
  )
  select jsonb_build_object(
    'ok', true,
    'base', v_base,
    'fecha', v_fecha,
    'es_hoy', v_fecha = v_hoy,
    'ahora', to_char(v_ahora, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'puede_revisar', v_base = 'BASE ' || coalesce(substring(lower(coalesce(auth.jwt() ->> 'email', '')) from '^base\s*([0-9]+)@combuses\.com\.co$'), '-'),

    'entradas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'fecha', e.fecha, 'hora', to_char(e.hora, 'HH24:MI'),
        'nombre', e.nombre, 'dni', e.dni, 'bus', e.bus, 'bus_prog', e.vehiculo_programado,
        'turno', e.turno_programado, 'hora_prog', to_char(e.hora_programada, 'HH24:MI'),
        'dif', e.minutos_diferencia, 'puntualidad', e.puntualidad,
        'origen', e.origen, 'punto', e.punto_operativo, 'foto', e.foto_path,
        'motivos', (select jsonb_agg(t.parte) from regexp_split_to_table(coalesce(e.observacion, ''), '\s*\|\s*') t(parte)
                     where t.parte ~* v_motivo),
        'salida', case when e.s_id is null then null else jsonb_build_object(
            'id', e.s_id, 'fecha', e.s_fecha, 'hora', to_char(e.s_hora, 'HH24:MI'), 'origen', e.s_origen,
            'punto', e.s_punto, 'foto', e.s_foto,
            'motivos', (select jsonb_agg(t.parte) from regexp_split_to_table(coalesce(e.s_obs, ''), '\s*\|\s*') t(parte)
                         where t.parte ~* v_motivo)) end,
        'horas', e.horas,
        'abierta_horas', case when e.s_id is null then round(extract(epoch from (v_ahora - e.ts)) / 3600.0, 1) end,
        'jornada_excedida', e.jornada
      ) order by e.ts) from ent e), '[]'::jsonb),

    'programados', coalesce((select jsonb_agg(jsonb_build_object(
        'dni', p.dni, 'nombre', p.nombre, 'turno', p.turno,
        'hora_entrada', to_char(p.hora_entrada, 'HH24:MI'), 'hora_salida', to_char(p.hora_salida, 'HH24:MI'),
        'bus', p.vehiculo, 'puesto', p.puesto,
        'entrada_id', p.entrada_id, 'entrada_hora', to_char(p.entrada_hora, 'HH24:MI'),
        'estado', p.estado,
        'minutos', case when p.entrada_ts is not null
                        then round(extract(epoch from (v_ahora - p.entrada_ts)) / 60.0)::int end
      ) order by p.entrada_ts nulls last, p.turno, p.nombre) from prog_ent p), '[]'::jsonb),

    'por_revisar', coalesce((select jsonb_agg(jsonb_build_object(
        'tipo', r.tipo, 'clave', r.clave, 'ref', r.ref, 'de', r.de, 'dni', r.dni, 'nombre', r.nombre,
        'revision', (select jsonb_build_object('nota', v.nota, 'por', v.revisado_por,
                                               'en', to_char(v.revisado_en at time zone 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI'),
                                               'veces', v.veces)
                       from public.afiliados_novedades_revision v where v.tipo = r.tipo and v.clave = r.clave)
      ) order by r.orden nulls last, r.tipo) from por_revisar r), '[]'::jsonb),

    'estados_personal', coalesce((select jsonb_agg(jsonb_build_object('nombre', n.nombre, 'estado', upper(trim(n.estado)))
                                                   order by upper(trim(n.estado)), n.nombre)
        from public.novedades n
       where n.fecha = v_fecha and public.afiliados_base_canonica(n.base) = v_base), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- B. La base revisa una novedad: deja la nota (5 a 500 letras). Solo la cuenta de la base, solo novedades de su
-- base que de verdad estén por revisar (se recalculan aquí mismo, no se cree lo que mande la página).
create or replace function public.afiliados_revisar_novedad(p_fecha date, p_tipo text, p_clave text, p_nota text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_nota  text := btrim(regexp_replace(coalesce(p_nota, ''), '\s+', ' ', 'g'));
  v_datos jsonb;
  v_item  jsonb;
  v_fila  public.afiliados_novedades_revision;
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión para revisar.' using errcode = '42501';
  end if;
  if v_email !~ '^base\s*[0-9]+@combuses\.com\.co$' then
    raise exception 'Solo la cuenta de la base puede revisar sus novedades.' using errcode = '42501';
  end if;
  if char_length(v_nota) < 5 then
    raise exception 'Escriba qué se hizo (mínimo 5 letras).' using errcode = '22023';
  end if;
  if char_length(v_nota) > 500 then
    raise exception 'La nota es muy larga (máximo 500 letras).' using errcode = '22023';
  end if;

  v_datos := public.afiliados_novedades_base(p_fecha, null);
  select x into v_item from jsonb_array_elements(v_datos -> 'por_revisar') x
   where x ->> 'tipo' = p_tipo and x ->> 'clave' = p_clave limit 1;
  if v_item is null then
    raise exception 'Esa novedad ya no está por revisar en su base (actualice la página).' using errcode = '22023';
  end if;

  insert into public.afiliados_novedades_revision (base, fecha, tipo, clave, dni, nombre, nota, revisado_por, revisado_uid)
  values (v_datos ->> 'base', (v_datos ->> 'fecha')::date, p_tipo, p_clave, v_item ->> 'dni', v_item ->> 'nombre',
          v_nota, v_email, auth.uid())
  on conflict (tipo, clave) do update
    set nota = excluded.nota, revisado_por = excluded.revisado_por, revisado_uid = excluded.revisado_uid,
        revisado_en = now(), veces = public.afiliados_novedades_revision.veces + 1
  returning * into v_fila;

  return jsonb_build_object('ok', true, 'tipo', v_fila.tipo, 'clave', v_fila.clave,
    'revision', jsonb_build_object('nota', v_fila.nota, 'por', v_fila.revisado_por,
                                   'en', to_char(v_fila.revisado_en at time zone 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI'),
                                   'veces', v_fila.veces));
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- C. Viaje a viaje de los carros de la base, con la plata (misma vista que el Portal de Control).
create or replace function public.afiliados_viajes_base(p_fecha date default null, p_base text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_base  text := public.afiliados_base_de_la_cuenta(p_base);
  v_hoy   date := (now() at time zone 'America/Bogota')::date;
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_res   jsonb;
begin
  if v_fecha < v_hoy - 62 or v_fecha > v_hoy + 1 then
    raise exception 'Solo se pueden consultar los últimos 2 meses.' using errcode = '22023';
  end if;

  with buses as (
    select distinct regexp_replace(trim(pt.vehiculo), '^0+', '') as interno
      from public.programacion_turnos pt
     where pt.fecha between v_fecha - 30 and v_fecha
       and public.afiliados_base_canonica(pt.base) = v_base
       and nullif(trim(pt.vehiculo), '') is not null
  )
  select jsonb_build_object(
    'ok', true,
    'base', v_base,
    'fecha', v_fecha,
    'es_hoy', v_fecha = v_hoy,
    'buses', coalesce((select jsonb_agg(b.interno order by nullif(regexp_replace(b.interno, '\D', '', 'g'), '')::int nulls last, b.interno)
                         from buses b), '[]'::jsonb),
    'viajes', coalesce((select jsonb_agg(jsonb_build_object(
        'interno', regexp_replace(trim(v.interno), '^0+', ''), 'placa', v.placa, 'viaje', v.viaje,
        'sin_despacho', v.sin_despacho, 'salio_cancelado', v.salio_cancelado,
        'salida', to_char(v.hora_salida at time zone 'America/Bogota', 'HH24:MI'),
        'arranco', to_char(v.arranco_en at time zone 'America/Bogota', 'HH24:MI'),
        'llego', to_char(v.llego_en at time zone 'America/Bogota', 'HH24:MI'),
        'ruta', coalesce(nullif(v.ruta, ''), v.itinerario), 'itinerario', v.itinerario,
        'punto_salida', v.punto_salida, 'punto_llegada', v.punto_llegada,
        'conductor', v.conductor,
        'pasajeros_sensor', v.pasajeros_sensor, 'pasajeros_conductor', v.pasajeros_conductor,
        'diferencia', v.diferencia_con_sensor, 'personal', v.personal,
        'civicas', v.civicas, 'tiquetes', v.tiquetes_escaneados,
        'tarifa', v.tarifa, 'plata_sensor', v.plata_sensor, 'plata_conductor', v.plata_conductor,
        'diferencia_plata', v.diferencia_plata, 'estado', v.estado_calculo
      ) order by nullif(regexp_replace(v.interno, '\D', '', 'g'), '')::int nulls last, v.hora_salida, v.viaje)
        from public.v_tarjeta_viajes v
       where v.dia = v_fecha
         and regexp_replace(trim(v.interno), '^0+', '') in (select b.interno from buses b)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- D. El nuevo enturnamiento: la fila completa de cada punto (sus buses marcados) y dónde está cada bus suyo.
-- De los buses de otras bases no se manda el conductor.
create or replace function public.afiliados_fila_base(p_base text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_base text := public.afiliados_base_de_la_cuenta(p_base);
  v_hoy  date := (now() at time zone 'America/Bogota')::date;
  v_res  jsonb;
begin
  with buses as (
    select distinct regexp_replace(trim(pt.vehiculo), '^0+', '') as interno
      from public.programacion_turnos pt
     where pt.fecha between v_hoy - 30 and v_hoy
       and public.afiliados_base_canonica(pt.base) = v_base
       and nullif(trim(pt.vehiculo), '') is not null
  )
  select jsonb_build_object(
    'ok', true,
    'base', v_base,
    'ahora', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
    'publicada_en', (select to_char(max(f.actualizado_en), 'YYYY-MM-DD"T"HH24:MI:SSOF') from public.enturne_flota f),
    'buses', coalesce((select jsonb_agg(b.interno order by nullif(regexp_replace(b.interno, '\D', '', 'g'), '')::int nulls last)
                         from buses b), '[]'::jsonb),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
        'punto', r.punto, 'pos', r.pos, 'interno', regexp_replace(trim(r.interno), '^0+', ''),
        'mio', regexp_replace(trim(r.interno), '^0+', '') in (select b.interno from buses b),
        'conductor', case when regexp_replace(trim(r.interno), '^0+', '') in (select b.interno from buses b) then r.conductor end,
        'llego_en', to_char(r.llego_en, 'YYYY-MM-DD"T"HH24:MI:SSOF'), 'espera_min', r.espera_min,
        'itinerario_id', r.itinerario_id, 'itinerario', r.itinerario, 'sentido', r.sentido,
        'llegada_tipo', r.llegada_tipo, 'turno', r.turno
      ) order by r.punto, r.pos nulls last, r.llego_en) from public.enturne_filas r), '[]'::jsonb),
    'mis_buses', coalesce((select jsonb_agg(jsonb_build_object(
        'interno', regexp_replace(trim(f.interno), '^0+', ''), 'placa', f.placa, 'conductor', f.conductor,
        'estado', f.estado, 'punto', f.punto, 'posicion', f.posicion,
        'itinerario', f.itinerario, 'sentido', f.sentido,
        'gps_en', to_char(f.gps_en, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'viajes_hoy', f.viajes_hoy, 'movilizados_hoy', f.movilizados_hoy,
        'ultimo_viaje', to_char(f.ultimo_viaje, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'novedad', f.novedad
      ) order by nullif(regexp_replace(f.interno, '\D', '', 'g'), '')::int nulls last, f.gps_en desc nulls last)
        from public.enturne_flota f
       where regexp_replace(trim(f.interno), '^0+', '') in (select b.interno from buses b)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
revoke all on function public.afiliados_base_de_la_cuenta(text) from public, anon;
revoke all on function public.afiliados_novedades_base(date, text) from public, anon;
revoke all on function public.afiliados_revisar_novedad(date, text, text, text) from public, anon;
revoke all on function public.afiliados_viajes_base(date, text) from public, anon;
revoke all on function public.afiliados_fila_base(text) from public, anon;
grant execute on function public.afiliados_base_de_la_cuenta(text) to authenticated;
grant execute on function public.afiliados_novedades_base(date, text) to authenticated;
grant execute on function public.afiliados_revisar_novedad(date, text, text, text) to authenticated;
grant execute on function public.afiliados_viajes_base(date, text) to authenticated;
grant execute on function public.afiliados_fila_base(text) to authenticated;
