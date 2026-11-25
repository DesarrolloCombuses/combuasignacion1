-- CombuAsigna 2.12.0 · Conductores cruzados con el ERP (25-nov-2026)
--
-- La lista de conductores de CombuAsigna sale de la hoja de Google (la lista de Sonar): el que dice ENABLED y tiene
-- "BASE n" le sale a esa base. Pero en Sonar siguen habilitados conductores que ya se retiraron: el 25-nov eran 64 de
-- los 201 que veían las bases, todos con fecha de salida en el ERP. El ERP (employees, el del Kardex) es el que sabe
-- quién trabaja hoy.
--
-- 1) afiliados_conductores_no_activos: recibe la lista de la hoja (una clave, la cédula y el nombre de cada uno) y
--    devuelve SOLO los que NO están activos en el ERP, para que la página no se los muestre a las bases para programar.
-- 2) afiliados_historial_conductores (Mi base · Historial de conductores): todos los que han trabajado en la base
--    (programacion_turnos, desde abril de 2026) y los que la hoja tiene en esa base, con su estado en el ERP, su primer
--    y último turno en la base, los días y el último bus. De los que trabajaron en la base dice desde cuándo están
--    retirados; de los que solo están en la hoja, solo el estado (la página puede mandar cualquier nombre: no se le dan
--    fechas de quien no trabajó en su base).
--
-- El cruce con el ERP (igual en las dos):
--   - por cédula: si la cédula está en el ERP y ningún registro suyo está activo -> retirado (un reingreso tiene un
--     registro activo y cuenta como activo);
--   - si la cédula no está en el ERP (o la hoja no la trae), por el nombre: el mismo nombre, sin tildes y aunque esté
--     en otro orden;
--   - si una cédula del ERP está retirada pero el mismo nombre está activo con otra cédula (la corrigieron en el ERP),
--     cuenta como activo;
--   - si no aparece ni por cédula ni por nombre -> no está en el ERP.
--
-- No abren employees: no devuelven cédulas, salario, teléfonos, cargos ni motivos. Solo las usan las cuentas de base y
-- el administrador (afiliados_base_de_la_cuenta, de Mi base). Solo leen. Agrega 3 funciones; se quitan con
-- quitar_conductores_activos_erp.sql.

-- La clave de un nombre para cruzarlo: sin tildes, en mayúsculas y con las palabras en orden alfabético
-- ("Muñoz José" y "JOSE MUNOZ" dan lo mismo).
create or replace function public.afiliados_clave_nombre(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(t, ' ' order by t), '')
    from regexp_split_to_table(
           upper(translate(coalesce(p, ''), 'áéíóúüñàèìòùÁÉÍÓÚÜÑÀÈÌÒÙ', 'aeiouunaeiouAEIOUUNAEIOU')),
           '[^A-Z0-9]+') t
   where t <> '';
$$;

create or replace function public.afiliados_conductores_no_activos(p_conductores jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_res jsonb;
begin
  -- corta a quien no sea cuenta de base ni el administrador (el administrador pasa con cualquier base)
  perform public.afiliados_base_de_la_cuenta('1');
  if p_conductores is null or jsonb_typeof(p_conductores) <> 'array' then
    raise exception 'Lista de conductores no válida.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_conductores) > 2000 then
    raise exception 'Demasiados conductores en la lista.' using errcode = '22023';
  end if;

  with emp as (
    select regexp_replace(upper(coalesce(e.cedula, '')), '[^0-9A-Z]', '', 'g') as ced,
           public.afiliados_clave_nombre(e.nombre) as nom,
           e.activo
      from public.employees e
  ),
  entrada as (
    select x.ord, x.v ->> 'k' as k,
           regexp_replace(upper(coalesce(x.v ->> 'c', '')), '[^0-9A-Z]', '', 'g') as ced,
           public.afiliados_clave_nombre(x.v ->> 'n') as nom
      from jsonb_array_elements(p_conductores) with ordinality as x(v, ord)
     where jsonb_typeof(x.v) = 'object' and coalesce(x.v ->> 'k', '') <> ''
  ),
  cruce as (
    select en.ord, en.k,
           length(en.ced) >= 5 and exists (select 1 from emp where emp.ced = en.ced) as ced_esta,
           length(en.ced) >= 5 and exists (select 1 from emp where emp.ced = en.ced and emp.activo) as ced_activo,
           en.nom <> '' and exists (select 1 from emp where emp.nom = en.nom) as nom_esta,
           en.nom <> '' and exists (select 1 from emp where emp.nom = en.nom and emp.activo) as nom_activo
      from entrada en
  )
  select coalesce(jsonb_agg(jsonb_build_object('k', c.k,
                                               'motivo', case when c.ced_esta or c.nom_esta then 'retirado' else 'no_esta' end)
                            order by c.ord), '[]'::jsonb)
    into v_res
    from cruce c
   where not c.ced_activo and not c.nom_activo;

  return v_res;
end;
$function$;

create or replace function public.afiliados_historial_conductores(p_base text default null, p_hoja jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_base text := public.afiliados_base_de_la_cuenta(p_base);
  v_hoja jsonb := coalesce(p_hoja, '[]'::jsonb);
  v_res  jsonb;
begin
  if jsonb_typeof(v_hoja) <> 'array' then
    raise exception 'Lista de conductores no válida.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_hoja) > 2000 then
    raise exception 'Demasiados conductores en la lista.' using errcode = '22023';
  end if;

  with emp as (
    select regexp_replace(upper(coalesce(e.cedula, '')), '[^0-9A-Z]', '', 'g') as ced,
           public.afiliados_clave_nombre(e.nombre) as nom,
           e.nombre, e.activo, e.fecha_salida, e.created_at
      from public.employees e
  ),
  -- una fila por cédula: activo si algún registro está activo; la salida del último retiro; el nombre más reciente
  emp_ced as (
    select ced, bool_or(activo) as activo,
           max(fecha_salida) filter (where not activo) as salida,
           (array_agg(nombre order by activo desc, created_at desc nulls last))[1] as nombre
      from emp
     where ced <> ''
     group by ced
  ),
  -- lo que trabajó cada uno en ESTA base (la programación)
  trabajo as (
    select regexp_replace(upper(t.dni), '[^0-9A-Z]', '', 'g') as ced,
           min(t.fecha) as primero, max(t.fecha) as ultimo, count(distinct t.fecha) as dias,
           (array_agg(t.vehiculo order by t.fecha desc, t.turno desc nulls last))[1] as bus
      from public.programacion_turnos t
     where t.base = v_base and coalesce(t.dni, '') <> ''
     group by 1
  ),
  -- los de la hoja en esta base (sin repetidos), cruzados con el ERP como afiliados_conductores_no_activos
  hoja as (
    select distinct on (coalesce(nullif(z.ced, ''), z.nom)) z.*
      from (select x.ord, trim(x.v ->> 'n') as nombre,
                   regexp_replace(upper(coalesce(x.v ->> 'c', '')), '[^0-9A-Z]', '', 'g') as ced,
                   public.afiliados_clave_nombre(x.v ->> 'n') as nom
              from jsonb_array_elements(v_hoja) with ordinality as x(v, ord)
             where jsonb_typeof(x.v) = 'object' and coalesce(trim(x.v ->> 'n'), '') <> '') z
     order by coalesce(nullif(z.ced, ''), z.nom), z.ord
  ),
  hoja_erp as (
    select h.*,
           length(h.ced) >= 5 and exists (select 1 from emp where emp.ced = h.ced) as ced_esta,
           length(h.ced) >= 5 and exists (select 1 from emp where emp.ced = h.ced and emp.activo) as ced_activo,
           h.nom <> '' and exists (select 1 from emp where emp.nom = h.nom) as nom_esta,
           h.nom <> '' and exists (select 1 from emp where emp.nom = h.nom and emp.activo) as nom_activo
      from hoja h
  ),
  todos as (
    -- los que trabajaron en la base (estén o no en la hoja)
    select coalesce(he.nombre, ec.nombre, 'SIN NOMBRE') as nombre,
           case when coalesce(ec.activo, false) or coalesce(he.ced_activo, false) or coalesce(he.nom_activo, false) then 'activo'
                when ec.ced is not null then 'retirado'
                else 'no_esta' end as estado,
           case when not (coalesce(ec.activo, false) or coalesce(he.ced_activo, false) or coalesce(he.nom_activo, false))
                then ec.salida end as salida,
           he.ord is not null as en_hoja, tr.primero, tr.ultimo, tr.dias, tr.bus
      from trabajo tr
      left join emp_ced ec on ec.ced = tr.ced
      left join lateral (select h.* from hoja_erp h
                          where (length(h.ced) >= 5 and h.ced = tr.ced)
                             or (h.nom <> '' and h.nom = public.afiliados_clave_nombre(ec.nombre))
                          order by (h.ced = tr.ced) desc, h.ord
                          limit 1) he on true
    union all
    -- los de la hoja que no han trabajado en la base: solo el estado
    select h.nombre,
           case when h.ced_activo or h.nom_activo then 'activo'
                when h.ced_esta or h.nom_esta then 'retirado'
                else 'no_esta' end,
           null::date, true, null::date, null::date, null::bigint, null::text
      from hoja_erp h
     where not exists (select 1 from trabajo tr where length(h.ced) >= 5 and tr.ced = h.ced)
       and not exists (select 1 from trabajo tr join emp_ced ec on ec.ced = tr.ced
                        where h.nom <> '' and public.afiliados_clave_nombre(ec.nombre) = h.nom)
  )
  select jsonb_build_object(
           'ok', true,
           'base', v_base,
           'desde', (select min(t.fecha) from public.programacion_turnos t where t.base = v_base),
           'conductores', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'nombre', x.nombre, 'estado', x.estado, 'salida', x.salida, 'en_hoja', x.en_hoja,
               'primero', x.primero, 'ultimo', x.ultimo, 'dias', x.dias, 'bus', x.bus))
             order by case x.estado when 'activo' then 0 when 'no_esta' then 1 else 2 end,
                      x.ultimo desc nulls last, x.salida desc nulls last, x.nombre), '[]'::jsonb))
    into v_res
    from todos x;
  return v_res;
end;
$function$;

revoke all on function public.afiliados_clave_nombre(text) from public, anon, authenticated;
revoke all on function public.afiliados_conductores_no_activos(jsonb) from public, anon;
grant execute on function public.afiliados_conductores_no_activos(jsonb) to authenticated;
revoke all on function public.afiliados_historial_conductores(text, jsonb) from public, anon;
grant execute on function public.afiliados_historial_conductores(text, jsonb) to authenticated;

-- Revisión (solo lee): debe decir 'conductores del erp listo', true, true, false.
select 'conductores del erp listo' as estado,
       has_function_privilege('authenticated', 'public.afiliados_conductores_no_activos(jsonb)', 'execute') as la_usan_las_bases,
       has_function_privilege('authenticated', 'public.afiliados_historial_conductores(text, jsonb)', 'execute') as historial_las_bases,
       has_function_privilege('anon', 'public.afiliados_historial_conductores(text, jsonb)', 'execute')
         or has_function_privilege('anon', 'public.afiliados_conductores_no_activos(jsonb)', 'execute') as sin_sesion;
