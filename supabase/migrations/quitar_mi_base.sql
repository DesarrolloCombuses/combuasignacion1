-- Quita todo lo de "Mi base" (20261118150000_novedades_de_mi_base.sql). Borra también las revisiones que hayan
-- escrito las bases: si se quieren guardar, sacar antes una copia de public.afiliados_novedades_revision.
drop function if exists public.afiliados_revisar_novedad(date, text, text, text);
drop function if exists public.afiliados_novedades_base(date, text);
drop function if exists public.afiliados_viajes_base(date, text);
drop function if exists public.afiliados_fila_base(text);
drop function if exists public.afiliados_base_de_la_cuenta(text);
drop function if exists public.afiliados_base_canonica(text);
drop table if exists public.afiliados_novedades_revision;
