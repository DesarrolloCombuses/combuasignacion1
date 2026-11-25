-- Relevos de Mi base (CombuAsigna · Portal de Afiliados), 24-nov-2026.
--
-- Pedido: "nosotros tenemos conductor hora de ingreso/salida y conductor 2 lo mismo, no se puede llegar a saber la hora
-- posible en que entregó el carro … hay conductores que entregan más tarde porque les toca esperar que el carro lo
-- despachen desde el aeropuerto … las posiciones de los vehículos es fundamental".
--
-- Para cada bus de la base con relevo ese día (turno 1 y turno 2 de personas distintas) dice:
--   - dónde estaba el carro a la hora del relevo (en el aeropuerto, en el punto, en la vía de X a Y);
--   - a qué hora llegó al punto donde lo esperaba el que recibe, y a qué hora volvió a salir;
--   - la HORA PROBABLE DE ENTREGA: la primera vez que el carro está en ese punto con el que recibe ya marcado
--     (la más tarde de las dos: el carro llegó / el que recibe marcó la entrada);
--   - cuántos minutos después de la hora del relevo, y por qué;
--   - si las MARCAS de los dos cuadran con la entrega (pedido del mismo día: "tener los 2 conductores cuando se junte
--     la entrega para ver si el conductor 2 entra en el horario que es y si la salida del primero es concordante"):
--       el que recibe: en su horario (de 15 min antes, la regla del biométrico, a 10 min después de su hora),
--                      temprano o tarde; y si ya estaba cuando llegó el carro o el carro lo esperó;
--       el que entrega: su salida CUADRA si la marcó desde 5 min antes de la entrega hasta 30 min después de que el
--                      carro salió del punto con el compañero; si no, la marcó después (cuántos min) o ANTES de
--                      entregar el carro.
--     Semana 17-23 nov: salidas que cuadran 198 de 273, después 59, antes de entregar 13; entradas en horario 115 de
--     307, temprano 150, tarde 36.
--
-- Las posiciones vienen de tarjeta_estancias (el programa de la tarjeta guarda cuándo estuvo cada bus en cada punto,
-- con el GPS de Sonar). Las marcas, de asistencias: la entrada del que recibe y la salida del que entrega más cercanas
-- (±6 h) a su hora programada, como en tarjeta_viajes_conductor. El punto del relevo es donde marcó la entrada el que
-- recibe; si no marcó, donde marcó la salida el que entrega; si tampoco, el puesto de la programación.
--
-- Probado con la semana del 17 al 23-nov-2026 (307 relevos): la entrega sale en 273 (89 %); la salida que marca el que
-- entrega llega una mediana de 26 min después de que el carro llegó al punto (ya se fue con el compañero), por eso no
-- sirve como hora de entrega.
--
-- Quién ve qué: lo mismo que el resto de Mi base (afiliados_base_de_la_cuenta): la cuenta de base solo su base; el
-- administrador la base que abra; cualquier otra cuenta, nada.
--
-- v2, mismo día en la tarde: "en el caso de los conductores 1 entró, salió y quién le recibió … y saber si el carro
-- estaba en esos puntos de entrega". Cada relevo trae además la ENTRADA del que entrega (hora y punto), DÓNDE ESTABA
-- EL CARRO cuando marcó la salida el que entrega y cuando marcó la entrada el que recibe (afiliados_carro_en: en el
-- mismo punto, en otro, o en la vía; y si no estaba, cuándo se había ido o cuándo llegó a ese punto), y el RECORRIDO
-- del carro en la ventana (sus estancias en los puntos).
--
-- v3, esa noche: "poner la hora de inicio, salida y sus turnos, con las fotos al tocar el vehículo … decir si es
-- Almacentro o es Terminal del Norte". Cada relevo trae los dos TURNOS (hora programada de inicio y de salida) y las
-- 4 MARCAS (entrada y salida de cada conductor) con hora, punto, si fue biométrico o celular, y la foto (la ruta en el
-- bucket asistencia-fotos; la app la firma igual que en Novedades).
--
-- v4, revisión con los datos reales: a veces el que recibe marca la entrada en un punto (por ejemplo el biométrico de
-- Terminal Norte) y va a buscar el carro a otro, donde el que entrega marca la salida CON el carro ahí. Si el carro no
-- llegó al punto del que recibe antes de esa salida, la entrega fue en el punto de la salida del que entrega (si el
-- carro estaba ahí o acababa de salir de ahí, hasta 60 min antes): "entrega_en_salida" y "punto_recibe".
--
-- v5 (25-nov), pedido: "quiero saber en qué punto se tomó la foto y qué usuario lo hizo … muéstramelo en la tarjeta".
-- Cada marca trae además lat/lon y precisión del celular, la cuenta que la registró (afiliados_extra_de_marca: la del
-- conductor, una de la empresa —el biométrico o el celular de un punto, p. ej. expo@ en Terminal del Norte— u otra,
-- tapada) y los motivos escritos.
--
-- Solo agrega 4 funciones. Necesita la tabla tarjeta_estancias (SQL del programa de la tarjeta).
-- Para quitarlas: supabase/migrations/quitar_relevos_de_mi_base.sql.

-- El punto donde se marcó: lo que dice la marca o, si no, el punto de marca más cercano (a menos de 400 m).
create or replace function public.afiliados_punto_de_marca(p_punto text, p_lat numeric, p_lon numeric)
returns text
language sql
immutable
set search_path = public
as $function$
  select coalesce(
    case when nullif(trim(coalesce(p_punto, '')), '') is null then null
         when lower(trim(p_punto)) in ('cc san diego', 'san diego') then 'Almacentro'
         else trim(p_punto) end,
    (select q.punto
       from (values ('Almacentro', 6.23640, -75.57095), ('Almacentro', 6.23692, -75.57000),
                    ('Nutibara', 6.25184, -75.56211), ('Nutibara', 6.25290, -75.56683),
                    ('Terminal Norte', 6.27981, -75.57143)) q(punto, la, lo)
      where p_lat is not null and p_lon is not null
        and sqrt(power((p_lat::float8 - q.la::float8) * 110540, 2)
                 + power((p_lon::float8 - q.lo::float8) * 111320 * cos(radians(q.la::float8)), 2)) <= 400
      order by power((p_lat::float8 - q.la::float8) * 110540, 2)
               + power((p_lon::float8 - q.lo::float8) * 111320 * cos(radians(q.la::float8)), 2)
      limit 1));
$function$;

-- Dónde estaba el carro a una hora (la de una marca), con sus estancias en los puntos. p_punto = donde marcó.
--   {"gps": false}                       no hay GPS del carro a esa hora
--   {"gps": true, "en": P, "desde", "hasta", "alli": true|false}      estaba en un punto (alli = el mismo de la marca)
--   {"gps": true, "de": X, "a": Y, "alli": false}                       iba en la vía de X a Y
--   si no estaba allí: "se_fue" (+ "se_fue_min") = cuándo había salido de ese punto antes de la marca, y
--                      "llego"  (+ "llego_min")  = cuándo llegó a ese punto después de la marca.
create or replace function public.afiliados_carro_en(p_est jsonb, p_ts timestamptz, p_punto text,
                                                     p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language sql
immutable
set search_path = public
as $function$
  with e as (
    select x.e ->> 0 as punto, (x.e ->> 1)::timestamptz as llego, (x.e ->> 2)::timestamptz as salio
      from jsonb_array_elements(coalesce(p_est, '[]'::jsonb)) x(e)
  ), en as (
    select e.* from e
     where p_ts between e.llego - interval '2 minutes' and e.salio + interval '2 minutes'
     order by (e.punto is not distinct from p_punto) desc, e.llego
     limit 1
  ), antes as (
    select e.* from e where e.salio < p_ts - interval '2 minutes' order by e.salio desc limit 1
  ), despues as (
    select e.* from e where e.llego > p_ts + interval '2 minutes' order by e.llego limit 1
  ), fue as (
    select e.* from e
     where e.punto = p_punto and e.salio < p_ts - interval '2 minutes'
       and not exists (select 1 from en where en.punto = p_punto)
     order by e.salio desc limit 1
  ), llega as (
    select e.* from e
     where e.punto = p_punto and e.llego > p_ts + interval '2 minutes'
       and not exists (select 1 from en where en.punto = p_punto)
     order by e.llego limit 1
  )
  select case
    when p_ts is null then null
    when p_desde is null or p_hasta is null or p_ts < p_desde or p_ts > p_hasta + interval '2 minutes'
      then jsonb_build_object('gps', false)
    else jsonb_strip_nulls(jsonb_build_object(
      'gps', true,
      'en', (select en.punto from en),
      'desde', (select to_char(en.llego at time zone 'America/Bogota', 'HH24:MI') from en),
      'hasta', (select to_char(en.salio at time zone 'America/Bogota', 'HH24:MI') from en
                 where en.salio < p_hasta - interval '5 minutes'),
      'de', (select antes.punto from antes where not exists (select 1 from en)),
      'a', (select despues.punto from despues where not exists (select 1 from en)),
      'alli', case when p_punto is not null then exists (select 1 from en where en.punto = p_punto) end,
      'se_fue', (select to_char(fue.salio at time zone 'America/Bogota', 'HH24:MI') from fue),
      'se_fue_min', (select round(extract(epoch from (date_trunc('minute', p_ts) - date_trunc('minute', fue.salio))) / 60)::int
                       from fue),
      'llego', (select to_char(llega.llego at time zone 'America/Bogota', 'HH24:MI') from llega),
      'llego_min', (select round(extract(epoch from (date_trunc('minute', llega.llego) - date_trunc('minute', p_ts))) / 60)::int
                      from llega)
    )) end;
$function$;

-- v5 (25-nov): de cada marca, lo que muestra la ventana del relevo: dónde estaba el celular (y con qué precisión), qué
-- cuenta la registró (la del mismo conductor; una de la empresa, como el biométrico o el celular de un punto; u otra,
-- tapada) y los motivos que se escribieron (los mismos de Mi base; nunca el texto automático "Conductor: vehiculo…").
-- Lee auth.users: security definer, y nadie la llama directo (solo afiliados_relevos_base).
create or replace function public.afiliados_extra_de_marca(p_user uuid, p_colab uuid, p_obs text,
                                                          p_lat numeric, p_lon numeric, p_prec numeric)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'lat', round(p_lat, 6), 'lon', round(p_lon, 6), 'precision_m', round(p_prec),
    'cuenta', case when u.email is null or lower(u.email) = lower(coalesce(c.email, '')) then null
                   when u.email ~* '@combuses[.]com([.]co)?$' then lower(u.email)
                   else left(u.email, 3) || '•••@' || split_part(u.email, '@', 2) end,
    'cuenta_tipo', case when p_user is null then 'ninguna'
                        when u.email is null then 'otra'
                        when lower(u.email) = lower(coalesce(c.email, '')) then 'propia'
                        when u.email ~* '@combuses[.]com([.]co)?$' then 'empresa'
                        else 'otra' end,
    'motivos', (select jsonb_agg(t.parte) from regexp_split_to_table(coalesce(p_obs, ''), '\s*\|\s*') t(parte)
                 where t.parte ~* '^(ENTRADA ANTES DE TIEMPO|CAMBIO DE TURNO|(ENTRADA|SALIDA) [0-9]{1,2}:[0-9]{2} vs programada|Jornada de [0-9.,]+ h|Salida manual|Cierre declarado|Motivo:|⚠)')))
    from (select 1) uno
    left join auth.users u on u.id = p_user
    left join public.colaboradores c on c.id = p_colab;
$$;

create or replace function public.afiliados_relevos_base(p_fecha date default null, p_base text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_base  text := public.afiliados_base_de_la_cuenta(p_base);
  v_ahora timestamptz := now();
  v_hoy   date := ((now() at time zone 'America/Bogota') - interval '2 hours 30 minutes')::date;
  v_fecha date := coalesce(p_fecha, ((now() at time zone 'America/Bogota') - interval '2 hours 30 minutes')::date);
  v_res   jsonb;
begin
  if v_fecha < v_hoy - 62 or v_fecha > v_hoy + 1 then
    raise exception 'Solo se pueden consultar los últimos 2 meses.' using errcode = '22023';
  end if;

  with t as (
    select regexp_replace(trim(pt.vehiculo), '^0+', '') as bus, pt.turno, coalesce(pt.dni, '') as dni,
           pt.nombre_programacion as nombre, pt.entrada_ts, pt.salida_ts, pt.puesto,
           public.afiliados_base_canonica(pt.base) as base,
           (select c.id from public.colaboradores c where c.dni = pt.dni limit 1) as colab
      from public.programacion_turnos pt
     where pt.fecha = v_fecha
       and pt.entrada_ts is not null and pt.salida_ts is not null
       and nullif(trim(pt.vehiculo), '') is not null
  ), pares as (
    select a.bus, a.base, coalesce(b.puesto, a.puesto) as puesto,
           a.nombre as entrega_nombre, b.nombre as recibe_nombre, a.colab as entrega_colab, b.colab as recibe_colab,
           a.salida_ts as relevo_local, b.entrada_ts as recibe_local, a.entrada_ts as entrega_entra_local,
           b.salida_ts as recibe_sale_local
      from t a
      join t b on b.bus = a.bus and b.turno = 2
     where a.turno = 1 and a.base = v_base and a.dni <> b.dni
       and (select count(*) from t x where x.bus = a.bus and x.turno = 1) = 1
       and (select count(*) from t x where x.bus = a.bus and x.turno = 2) = 1
  ), m as (
    select p.*, (p.relevo_local at time zone 'America/Bogota') as relevo,
           e.ts as e2, e.punto as e2_punto, s.ts as s1, s.punto as s1_punto, i.ts as e1, i.punto as e1_punto,
           e.origen as e2_origen, e.foto as e2_foto, s.origen as s1_origen, s.foto as s1_foto,
           i.origen as e1_origen, i.foto as e1_foto, o.ts as s2, o.punto as s2_punto, o.origen as s2_origen, o.foto as s2_foto,
           e.extra as e2_extra, s.extra as s1_extra, i.extra as e1_extra, o.extra as s2_extra
      from pares p
      left join lateral (
        select ((a.fecha + a.hora) at time zone 'America/Bogota') as ts,
               public.afiliados_punto_de_marca(a.punto_operativo, a.latitud, a.longitud) as punto,
               a.origen, a.foto_path as foto,
               public.afiliados_extra_de_marca(a.registrado_por, a.colaborador_id, a.observacion,
                                               a.latitud, a.longitud, a.ubicacion_precision_m) as extra
          from public.asistencias a
         where p.recibe_colab is not null and a.colaborador_id = p.recibe_colab and a.sentido = 'entrada'
           and a.fecha between v_fecha - 1 and v_fecha + 1
           and abs(extract(epoch from ((a.fecha + a.hora) - p.recibe_local))) <= 6 * 3600
         order by abs(extract(epoch from ((a.fecha + a.hora) - p.recibe_local))) limit 1) e on true
      left join lateral (
        select ((a.fecha + a.hora) at time zone 'America/Bogota') as ts,
               public.afiliados_punto_de_marca(a.punto_operativo, a.latitud, a.longitud) as punto,
               a.origen, a.foto_path as foto,
               public.afiliados_extra_de_marca(a.registrado_por, a.colaborador_id, a.observacion,
                                               a.latitud, a.longitud, a.ubicacion_precision_m) as extra
          from public.asistencias a
         where p.entrega_colab is not null and a.colaborador_id = p.entrega_colab and a.sentido = 'salida'
           and a.fecha between v_fecha - 1 and v_fecha + 2
           and abs(extract(epoch from ((a.fecha + a.hora) - p.relevo_local))) <= 6 * 3600
         order by abs(extract(epoch from ((a.fecha + a.hora) - p.relevo_local))) limit 1) s on true
      left join lateral (
        select ((a.fecha + a.hora) at time zone 'America/Bogota') as ts,
               public.afiliados_punto_de_marca(a.punto_operativo, a.latitud, a.longitud) as punto,
               a.origen, a.foto_path as foto,
               public.afiliados_extra_de_marca(a.registrado_por, a.colaborador_id, a.observacion,
                                               a.latitud, a.longitud, a.ubicacion_precision_m) as extra
          from public.asistencias a
         where p.entrega_colab is not null and a.colaborador_id = p.entrega_colab and a.sentido = 'entrada'
           and a.fecha between v_fecha - 1 and v_fecha + 1
           and abs(extract(epoch from ((a.fecha + a.hora) - p.entrega_entra_local))) <= 6 * 3600
         order by abs(extract(epoch from ((a.fecha + a.hora) - p.entrega_entra_local))) limit 1) i on true
      left join lateral (
        select ((a.fecha + a.hora) at time zone 'America/Bogota') as ts,
               public.afiliados_punto_de_marca(a.punto_operativo, a.latitud, a.longitud) as punto,
               a.origen, a.foto_path as foto,
               public.afiliados_extra_de_marca(a.registrado_por, a.colaborador_id, a.observacion,
                                               a.latitud, a.longitud, a.ubicacion_precision_m) as extra
          from public.asistencias a
         where p.recibe_colab is not null and a.colaborador_id = p.recibe_colab and a.sentido = 'salida'
           and a.fecha between v_fecha and v_fecha + 2
           and abs(extract(epoch from ((a.fecha + a.hora) - p.recibe_sale_local))) <= 6 * 3600
         order by abs(extract(epoch from ((a.fecha + a.hora) - p.recibe_sale_local))) limit 1) o on true
  ), r as (
    select m.*,
           coalesce(m.e2_punto, m.s1_punto,
                    case when upper(m.puesto) like '%TERMINAL%' then 'Terminal Norte'
                         when upper(m.puesto) like '%NUTIBARA%' or upper(m.puesto) like '%EXPOSICIONES%' then 'Nutibara'
                         when nullif(trim(coalesce(m.puesto, '')), '') is not null then 'Almacentro' end) as punto,
           te.estancias, te.hasta as gps_hasta, te.desde as gps_desde, te.ultimo, te.reportes as gps_reportes,
           (te.interno is not null and coalesce(te.reportes, 0) > 0) as con_gps
      from m
      left join public.tarjeta_estancias te on te.dia = v_fecha and te.interno = m.bus
  ), e as (
    select r.bus, x.n, x.e ->> 0 as punto, (x.e ->> 1)::timestamptz as llego, (x.e ->> 2)::timestamptz as salio
      from r
      cross join lateral jsonb_array_elements(coalesce(r.estancias, '[]'::jsonb)) with ordinality x(e, n)
  ), c as (
    select r.*,
           case when u.usa then sq.llego else el.llego end as p_llego,
           case when u.usa then sq.salio else el.salio end as p_salio,
           case when u.usa then date_trunc('minute', greatest(sq.llego, least(coalesce(r.e2, sq.llego), sq.salio)))
                when el.llego is not null then date_trunc('minute', greatest(el.llego, r.e2)) end as entrega,
           case when u.usa then r.s1_punto else r.punto end as punto_final,
           u.usa as entrega_en_salida,
           en.punto as en_punto, en.llego as en_llego, en.salio as en_salio,
           antes.punto as antes_punto, despues.punto as despues_punto,
           ul.punto as ul_punto, ul.llego as ul_llego, ul.salio as ul_salio,
           not u.usa and exists (select 1 from e o where o.bus = r.bus and o.punto = r.punto and el.llego is not null
                     and o.llego > el.llego + interval '20 minutes' and r.s1 is not null
                     and o.llego <= r.s1 + interval '10 minutes') as otra_pasada,
           (r.gps_desde is not null and r.gps_desde <= r.relevo and r.gps_hasta >= r.relevo) as cubre_la_hora
      from r
      left join lateral (
        select e.llego, e.salio from e
         where e.bus = r.bus and e.punto = r.punto
           and e.salio >= coalesce(r.e2 - interval '5 minutes', r.relevo - interval '60 minutes')
         order by e.llego limit 1) el on true
      left join lateral (
        select e.punto, e.llego, e.salio from e
         where e.bus = r.bus and r.relevo between e.llego - interval '2 minutes' and e.salio + interval '2 minutes'
         order by e.llego limit 1) en on true
      left join lateral (select e.punto from e where e.bus = r.bus and e.salio < r.relevo order by e.salio desc limit 1) antes on true
      left join lateral (select e.punto from e where e.bus = r.bus and e.llego > r.relevo order by e.llego limit 1) despues on true
      left join lateral (select e.punto, e.llego, e.salio from e where e.bus = r.bus order by e.llego desc limit 1) ul on true
      -- v4: el rato del carro en el punto donde el que entrega marcó la salida (estaba ahí o salió hasta 60 min antes)
      left join lateral (
        select e.llego, e.salio from e
         where e.bus = r.bus and r.s1 is not null and r.s1_punto is not null and r.s1_punto is distinct from r.punto
           and e.punto = r.s1_punto
           and e.llego <= r.s1 + interval '2 minutes' and e.salio >= r.s1 - interval '60 minutes'
         order by e.llego desc limit 1) sq on true
      cross join lateral (select (sq.llego is not null and (el.llego is null or el.llego > r.s1)) as usa) u
  ), d as (
    select c.*,
           (c.entrega is not null
            and (c.e2 is not null or v_ahora >= c.relevo + interval '60 minutes')) as entregado
      from c
  ), f as (
    select d.*,
           case
             when d.entregado then 'entregado'
             when v_ahora < d.relevo - interval '4 hours' then 'falta'
             when v_ahora <= d.relevo + interval '5 hours' then 'en_curso'
             when not d.con_gps then 'sin_gps'
             else 'sin_dato'
           end as estado,
           case
             when not d.entregado then null
             when d.entrega < d.relevo - interval '30 minutes' then 'antes'
             when d.entrega <= d.relevo + interval '10 minutes' then 'a_tiempo'
             when d.e2 > d.relevo + interval '10 minutes' and d.e2 >= d.p_llego then 'recibe_tarde'
             when d.en_punto = 'Aeropuerto' then 'aeropuerto'
             when d.en_punto is null and d.despues_punto = 'Aeropuerto' then 'iba_aeropuerto'
             when d.en_punto is null and d.antes_punto = 'Aeropuerto' then 'venia_aeropuerto'
             when d.en_punto = d.punto_final then 'en_punto'
             else 'otro'
           end as causa,
           round(extract(epoch from (date_trunc('minute', d.e2) - date_trunc('minute', d.relevo))) / 60)::int as recibe_min,
           case when d.p_salio < d.gps_hasta - interval '5 minutes' then d.p_salio end as p_salio_ok
      from d
  )
  select jsonb_build_object(
    'ok', true,
    'base', v_base,
    'fecha', v_fecha,
    'es_hoy', v_fecha = v_hoy,
    'ahora', to_char(v_ahora at time zone 'America/Bogota', 'HH24:MI'),
    'relevos', coalesce((select jsonb_agg(jsonb_build_object(
        'interno', f.bus, 'puesto', f.puesto, 'punto', f.punto_final,
        'punto_recibe', f.punto, 'entrega_en_salida', f.entrega_en_salida,
        'relevo', to_char(f.relevo at time zone 'America/Bogota', 'HH24:MI'),
        'entrega_nombre', f.entrega_nombre, 'recibe_nombre', f.recibe_nombre,
        'recibe_marco', to_char(f.e2 at time zone 'America/Bogota', 'HH24:MI'), 'recibe_marco_en', f.e2_punto,
        'entrega_marco', to_char(f.s1 at time zone 'America/Bogota', 'HH24:MI'), 'entrega_marco_en', f.s1_punto,
        'entrega_entro', to_char(f.e1 at time zone 'America/Bogota', 'HH24:MI'), 'entrega_entro_en', f.e1_punto,
        -- v2: dónde estaba el carro cuando marcó cada uno, y por dónde anduvo
        'carro_en_salida', public.afiliados_carro_en(f.estancias, f.s1, f.s1_punto,
                                                     case when f.con_gps then f.gps_desde end, f.gps_hasta),
        'carro_en_entrada', public.afiliados_carro_en(f.estancias, f.e2, f.e2_punto,
                                                      case when f.con_gps then f.gps_desde end, f.gps_hasta),
        'recorrido', (select jsonb_agg(jsonb_build_array(x.e ->> 0,
                         to_char(((x.e ->> 1)::timestamptz) at time zone 'America/Bogota', 'HH24:MI'),
                         case when ((x.e ->> 2)::timestamptz) < f.gps_hasta - interval '5 minutes'
                              then to_char(((x.e ->> 2)::timestamptz) at time zone 'America/Bogota', 'HH24:MI') end)
                         order by x.n)
                        from jsonb_array_elements(coalesce(f.estancias, '[]'::jsonb)) with ordinality x(e, n)),
        'gps_desde', case when f.con_gps then to_char(f.gps_desde at time zone 'America/Bogota', 'HH24:MI') end,
        'gps_hasta', case when f.con_gps then to_char(f.gps_hasta at time zone 'America/Bogota', 'HH24:MI') end,
        -- v3: los dos turnos (hora programada) y las 4 marcas con su foto
        'turnos', jsonb_build_object(
            't1', jsonb_build_object('desde', to_char(f.entrega_entra_local, 'HH24:MI'), 'hasta', to_char(f.relevo_local, 'HH24:MI')),
            't2', jsonb_build_object('desde', to_char(f.recibe_local, 'HH24:MI'), 'hasta', to_char(f.recibe_sale_local, 'HH24:MI'))),
        'marcas', jsonb_build_object(
            'e1', case when f.e1 is not null then jsonb_strip_nulls(jsonb_build_object(
                 'hora', to_char(f.e1 at time zone 'America/Bogota', 'HH24:MI'),
                 'fecha', (f.e1 at time zone 'America/Bogota')::date,
                 'punto', f.e1_punto, 'origen', f.e1_origen, 'foto', f.e1_foto)) || coalesce(f.e1_extra, '{}'::jsonb) end,
            's1', case when f.s1 is not null then jsonb_strip_nulls(jsonb_build_object(
                 'hora', to_char(f.s1 at time zone 'America/Bogota', 'HH24:MI'),
                 'fecha', (f.s1 at time zone 'America/Bogota')::date,
                 'punto', f.s1_punto, 'origen', f.s1_origen, 'foto', f.s1_foto)) || coalesce(f.s1_extra, '{}'::jsonb) end,
            'e2', case when f.e2 is not null then jsonb_strip_nulls(jsonb_build_object(
                 'hora', to_char(f.e2 at time zone 'America/Bogota', 'HH24:MI'),
                 'fecha', (f.e2 at time zone 'America/Bogota')::date,
                 'punto', f.e2_punto, 'origen', f.e2_origen, 'foto', f.e2_foto)) || coalesce(f.e2_extra, '{}'::jsonb) end,
            's2', case when f.s2 is not null then jsonb_strip_nulls(jsonb_build_object(
                 'hora', to_char(f.s2 at time zone 'America/Bogota', 'HH24:MI'),
                 'fecha', (f.s2 at time zone 'America/Bogota')::date,
                 'punto', f.s2_punto, 'origen', f.s2_origen, 'foto', f.s2_foto)) || coalesce(f.s2_extra, '{}'::jsonb) end),
        'estado', f.estado, 'causa', f.causa,
        'a_la_hora', case
            when not f.cubre_la_hora then null
            when f.en_punto is not null then jsonb_build_object('en', f.en_punto,
                 'desde', to_char(f.en_llego at time zone 'America/Bogota', 'HH24:MI'),
                 'hasta', case when f.en_salio < f.gps_hasta - interval '5 minutes'
                               then to_char(f.en_salio at time zone 'America/Bogota', 'HH24:MI') end)
            else jsonb_build_object('de', f.antes_punto, 'a', f.despues_punto) end,
        'llego_al_punto', to_char(f.p_llego at time zone 'America/Bogota', 'HH24:MI'),
        'salio_del_punto', case when f.p_salio < f.gps_hasta - interval '5 minutes'
                                then to_char(f.p_salio at time zone 'America/Bogota', 'HH24:MI') end,
        'entrega', case when f.entregado then to_char(f.entrega at time zone 'America/Bogota', 'HH24:MI') end,
        'minutos', case when f.entregado then round(extract(epoch from (f.entrega - date_trunc('minute', f.relevo))) / 60)::int end,
        'aeropuerto_despues_min', case when f.en_punto = 'Aeropuerto' and f.en_salio < f.gps_hasta - interval '5 minutes'
                                       then round(extract(epoch from (date_trunc('minute', f.en_salio) - date_trunc('minute', f.relevo))) / 60)::int end,
        'otra_pasada', f.otra_pasada,
        'salida_despues_min', case when f.entregado and f.s1 is not null and f.p_salio < f.gps_hasta - interval '5 minutes'
                                   then round(extract(epoch from (date_trunc('minute', f.s1) - date_trunc('minute', f.p_salio))) / 60)::int end,
        'recibe_espero_min', case when f.entregado and f.e2 is not null and not f.entrega_en_salida
                                  then greatest(0, round(extract(epoch from (date_trunc('minute', f.p_llego) - date_trunc('minute', f.e2))) / 60))::int end,
        -- las marcas contra la entrega
        'recibe_horario', case when f.e2 is not null then
                                 case when f.recibe_min < -15 then 'temprano' when f.recibe_min > 10 then 'tarde' else 'en_horario' end
                               when v_ahora > f.relevo + interval '10 minutes' then 'sin_marca' end,
        'recibe_vs_hora_min', f.recibe_min,
        'carro_espero_min', case when f.entregado and f.e2 is not null and not f.entrega_en_salida
                                 then greatest(0, round(extract(epoch from (date_trunc('minute', f.e2) - date_trunc('minute', f.p_llego))) / 60))::int end,
        'entrega_salida', case
            when not f.entregado then null
            when f.s1 is null then case when v_ahora > coalesce(f.p_salio_ok, f.entrega) + interval '30 minutes' then 'sin_marca' end
            when date_trunc('minute', f.s1) < f.entrega - interval '5 minutes' then 'antes'
            when date_trunc('minute', f.s1) <= coalesce(date_trunc('minute', f.p_salio_ok), f.entrega) + interval '30 minutes' then 'cuadra'
            else 'despues' end,
        'entrega_salida_min', case when f.entregado and f.s1 is not null
                                   then round(extract(epoch from (date_trunc('minute', f.s1) - f.entrega)) / 60)::int end,
        'ahora', case when f.estado = 'en_curso' and f.ultimo is not null then jsonb_build_object(
                   'gps', to_char(((f.ultimo ->> 't')::timestamptz) at time zone 'America/Bogota', 'HH24:MI'),
                   'en', f.ultimo ->> 'punto',
                   'desde', case when f.ultimo ->> 'punto' is not null and f.ul_punto = f.ultimo ->> 'punto'
                                 then to_char(f.ul_llego at time zone 'America/Bogota', 'HH24:MI') end,
                   'salio_de', case when f.ultimo ->> 'punto' is null then f.ul_punto end,
                   'salio', case when f.ultimo ->> 'punto' is null
                                 then to_char(f.ul_salio at time zone 'America/Bogota', 'HH24:MI') end) end
      ) order by f.relevo, nullif(regexp_replace(f.bus, '\D', '', 'g'), '')::int nulls last, f.bus) from f), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$function$;

revoke all on function public.afiliados_punto_de_marca(text, numeric, numeric) from public, anon;
revoke all on function public.afiliados_relevos_base(date, text) from public, anon;
revoke all on function public.afiliados_carro_en(jsonb, timestamptz, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.afiliados_extra_de_marca(uuid, uuid, text, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.afiliados_punto_de_marca(text, numeric, numeric) to authenticated;
grant execute on function public.afiliados_relevos_base(date, text) to authenticated;

-- Para revisar: debe decir "relevos de mi base listo | true | false".
select 'relevos de mi base listo' as estado,
       has_function_privilege('authenticated', 'public.afiliados_relevos_base(date, text)', 'execute') as la_usan_las_bases,
       has_function_privilege('anon', 'public.afiliados_relevos_base(date, text)', 'execute') as sin_sesion;
