-- Quita lo de 20261125120000_conductores_activos_erp.sql (CombuAsigna 2.12.0). No borra datos: solo las 3 funciones.
-- Sin ellas, la página vuelve a mostrar a las bases a todos los habilitados de la hoja (y avisa que no pudo revisar
-- con el ERP), y Mi base · Historial de conductores dice que esa parte no está activa.
drop function if exists public.afiliados_historial_conductores(text, jsonb);
drop function if exists public.afiliados_conductores_no_activos(jsonb);
drop function if exists public.afiliados_clave_nombre(text);

select 'conductores del erp quitado' as estado,
       not exists (select 1 from pg_proc
                    where proname in ('afiliados_conductores_no_activos', 'afiliados_historial_conductores', 'afiliados_clave_nombre')) as ya_no_esta;
