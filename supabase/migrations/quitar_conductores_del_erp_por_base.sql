-- Quita lo de 20261125180000_conductores_del_erp_por_base.sql (CombuAsigna 2.14.0).
-- La página sigue funcionando sin la función: si la consulta falla, usa solo la hoja de Sonar, como antes.
drop function if exists public.afiliados_conductores_erp();
