-- Quita lo de 20261124120000_relevos_de_mi_base.sql (la pestaña Relevos de Mi base queda sin datos).
drop function if exists public.afiliados_relevos_base(date, text);
drop function if exists public.afiliados_punto_de_marca(text, numeric, numeric);
drop function if exists public.afiliados_carro_en(jsonb, timestamptz, text, timestamptz, timestamptz);
drop function if exists public.afiliados_extra_de_marca(uuid, uuid, text, numeric, numeric, numeric);
select 'relevos de mi base quitado' as estado,
       to_regprocedure('public.afiliados_relevos_base(date, text)') is null as ya_no_esta;
