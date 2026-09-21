-- ============================================================================
-- API externa de solo lectura - CombuAsigna
--
-- Crea lo necesario para que un sistema de terceros consulte la programacion
-- de una base concreta sin tocar las tablas internas ni la app.
--
-- Principios:
--   * La API key NUNCA se guarda: se guarda su SHA-256. Si la base se filtra,
--     las keys no se pueden reconstruir.
--   * Estas tablas tienen RLS activo y NINGUNA politica, asi que solo el
--     service_role (la Edge Function) las ve. Ni anon ni los usuarios de la
--     app pueden leerlas.
--   * Cada cliente declara que bases puede ver. La Edge Function lo impone;
--     el cliente no elige la base por parametro.
--
-- Aplicar:  supabase db push
--     o:    pegar en el SQL Editor del panel de Supabase
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Clientes autorizados
-- ----------------------------------------------------------------------------
create table if not exists public.api_clientes (
  id             bigint generated always as identity primary key,
  nombre         text        not null,
  -- SHA-256 en hexadecimal de la API key. La key en claro se entrega una sola
  -- vez al cliente y no queda en ningun sitio.
  key_hash       text        not null unique,
  -- Primeros caracteres de la key, para poder identificarla en los registros
  -- ("ck_a1b2c3d4...") sin revelarla entera.
  key_prefijo    text        not null,
  -- Bases que este cliente puede consultar, con la etiqueta tal cual se guarda
  -- en programacion_filas.base. Ej: '{"BASE 3"}'
  bases          text[]      not null default '{}',
  activo         boolean     not null default true,
  -- Tope de consultas por hora. Evita que un cliente descontrolado nos afecte.
  limite_hora    integer     not null default 240,
  creado_en      timestamptz not null default now(),
  expira_en      timestamptz,
  ultimo_acceso  timestamptz,
  notas          text
);

comment on table  public.api_clientes is 'Sistemas externos autorizados a consultar la API de solo lectura.';
comment on column public.api_clientes.key_hash is 'SHA-256 de la API key. La key en claro no se almacena en ningun sitio.';
comment on column public.api_clientes.bases   is 'Bases visibles para el cliente, como aparecen en programacion_filas.base.';

create index if not exists api_clientes_key_hash_idx
  on public.api_clientes (key_hash) where activo;

-- ----------------------------------------------------------------------------
-- Registro de accesos (auditoria y control de uso)
-- ----------------------------------------------------------------------------
create table if not exists public.api_accesos (
  id               bigint generated always as identity primary key,
  cliente_id       bigint      references public.api_clientes(id) on delete set null,
  key_prefijo      text,
  endpoint         text        not null,
  fecha_consultada date,
  status           integer     not null,
  filas_devueltas  integer,
  ip               text,
  user_agent       text,
  creado_en        timestamptz not null default now()
);

comment on table public.api_accesos is 'Una fila por consulta a la API externa. Sirve para auditar y para el limite por hora.';

-- El limite por hora se calcula sobre esta tabla: el indice la hace barata.
create index if not exists api_accesos_cliente_reciente_idx
  on public.api_accesos (cliente_id, creado_en desc);

-- ----------------------------------------------------------------------------
-- Blindaje: RLS activo y sin politicas.
-- Con RLS activo y cero politicas, ningun rol pasa el filtro. El service_role
-- (que usa la Edge Function) se salta RLS por definicion, asi que solo el
-- servicio puede leer y escribir aqui.
-- ----------------------------------------------------------------------------
alter table public.api_clientes enable row level security;
alter table public.api_accesos  enable row level security;

revoke all on public.api_clientes from anon, authenticated;
revoke all on public.api_accesos  from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Indices de apoyo para las consultas que hace la API.
-- Sin esto, cada consulta recorre la tabla entera de filas.
-- ----------------------------------------------------------------------------
create index if not exists programacion_filas_base_fecha_idx
  on public.programacion_filas (base, fecha);

create index if not exists novedades_base_fecha_idx
  on public.novedades (base, fecha);

-- ----------------------------------------------------------------------------
-- Limpieza automatica del registro de accesos.
-- Sin esto la tabla crece sin freno. Se conservan 90 dias, que cubre cualquier
-- revision de auditoria razonable.
-- ----------------------------------------------------------------------------
create or replace function public.api_accesos_purgar()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.api_accesos where creado_en < now() - interval '90 days';
$$;

comment on function public.api_accesos_purgar is 'Borra los accesos de mas de 90 dias. Programar con pg_cron o llamar a mano.';

-- Si el proyecto tiene pg_cron habilitado, programarlo una vez al dia:
--   select cron.schedule('purgar-api-accesos', '0 3 * * *', 'select public.api_accesos_purgar()');
