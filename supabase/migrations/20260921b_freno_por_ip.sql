-- ============================================================================
-- Freno por IP para las peticiones sin credencial valida
--
-- La API cuenta cuantos intentos fallidos lleva una IP en los ultimos minutos
-- y, pasado el tope, deja de atenderla y de registrarla. Ese conteo se hace
-- SOLO cuando la credencial ya fallo, pero aun asi conviene que sea barato:
-- sin este indice, cada intento fallido recorreria api_accesos entera.
--
-- Es un indice parcial (solo status >= 400): ocupa una fraccion de lo que
-- ocuparia uno completo, porque los accesos normales son la inmensa mayoria y
-- aqui no hacen falta.
--
-- Aplicar: pegar en el SQL Editor del panel de Supabase.
-- ============================================================================

create index if not exists api_accesos_ip_fallos_idx
  on public.api_accesos (ip, creado_en desc)
  where status >= 400;

comment on index public.api_accesos_ip_fallos_idx is
  'Soporta el freno por IP: cuenta intentos fallidos recientes de una misma IP.';
