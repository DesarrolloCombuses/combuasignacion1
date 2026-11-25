-- CombuAsigna 2.14.0 · Los conductores de cada base también salen del ERP (25-nov-2026)
--
-- La lista de conductores de CombuAsigna sale de la hoja de Google (la lista de Sonar): al conductor le sale a la base
-- que diga "BASE n" en Sonar. Pero:
--   - el conductor nuevo tarda en llegar a la hoja (hay que crearlo en Sonar y refrescar la hoja), y
--   - en Sonar a veces queda con otra base o sin base. El 25-nov, a 15 conductores activos del ERP no los veía su base:
--     9 no estaban en la hoja, 5 tenían otra base en Sonar y 1 no tenía base.
-- El ERP (employees) es el que sabe quién trabaja hoy y en qué base: de los programados en 30 días, el 98 % están en
-- la base que dice el ERP.
--
-- afiliados_conductores_erp(): los conductores ACTIVOS del ERP (cargo CONDUCTOR) con base, para que la página los
-- sume al panel de su base. La página no quita a nadie de la base donde ya lo tiene la hoja: solo suma.
--   - Una cuenta de base recibe solo los de su base (y la Base 3 también los de la Base 5, igual que EXTRA_DRIVER_BASES
--     de la página).
--   - El administrador recibe los de todas las bases.
--   - Devuelve el nombre, la cédula (la programación la necesita) y la base. Nada más del ERP.
-- Solo lee. Agrega 1 función; se quita con quitar_conductores_del_erp_por_base.sql.

create or replace function public.afiliados_conductores_erp()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  -- corta a quien no sea cuenta de base ni el administrador. La cuenta de base recibe siempre SU base, pida la que
  -- pida; el administrador recibe la que pida: si pidiendo la 1 y la 2 salen distintas, es el administrador.
  v_base  text := public.afiliados_base_de_la_cuenta('1');
  v_admin boolean := public.afiliados_base_de_la_cuenta('2') <> v_base;
  v_bases text[];
  v_res   jsonb;
begin
  if not v_admin then
    v_bases := case v_base when 'BASE 3' then array['BASE 3', 'BASE 5'] else array[v_base] end;
  end if;

  with act as (
    -- reingresos: varios registros por cédula; vale el activo
    select distinct on (regexp_replace(upper(coalesce(e.cedula::text, '')), '[^0-9A-Z]', '', 'g'))
           btrim(regexp_replace(coalesce(e.nombre::text, ''), '\s+', ' ', 'g')) as nombre,
           regexp_replace(upper(coalesce(e.cedula::text, '')), '[^0-9A-Z]', '', 'g') as cedula,
           btrim(e.base::text) as base
      from public.employees e
     where e.activo
       and upper(coalesce(e.cargo::text, '')) like '%CONDUCTOR%'
       and btrim(coalesce(e.base::text, '')) ~ '^0*[1-9][0-9]*$'
     order by regexp_replace(upper(coalesce(e.cedula::text, '')), '[^0-9A-Z]', '', 'g'), e.created_at desc nulls last
  )
  select coalesce(jsonb_agg(jsonb_build_object('n', a.nombre, 'c', a.cedula, 'b', ltrim(a.base, '0'))
                            order by ltrim(a.base, '0')::int, a.nombre), '[]'::jsonb)
    into v_res
    from act a
   where a.nombre <> '' and length(a.cedula) >= 5
     and (v_admin or ('BASE ' || ltrim(a.base, '0')) = any (v_bases));

  return v_res;
end;
$function$;

revoke all on function public.afiliados_conductores_erp() from public, anon;
grant execute on function public.afiliados_conductores_erp() to authenticated;
