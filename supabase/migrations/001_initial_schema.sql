-- ============================================================
-- Battery Price Comparator MX — Schema inicial
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensión para cron jobs
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Tipos enumerados
create type store_type as enum ('oreilly', 'autozone', 'lth');
create type battery_grade as enum ('basica', 'estandar', 'premium', 'agm', 'otro');

-- Tabla principal de baterías
create table if not exists baterias (
  id              bigserial primary key,
  tienda          store_type        not null,
  nombre          text              not null,
  gama            battery_grade     not null default 'otro',
  amperaje        integer,                          -- CCA o Ah
  grupo           text,                             -- BCI group (24, 35, 65, etc.)
  garantia_meses  integer,
  precio          numeric(10, 2)    not null,
  precio_original numeric(10, 2),                  -- precio antes de descuento
  url             text              not null,
  imagen_url      text,
  disponible      boolean           not null default true,
  scraped_at      timestamptz       not null default now(),
  created_at      timestamptz       not null default now()
);

-- Índices para búsquedas frecuentes
create index idx_baterias_tienda     on baterias (tienda);
create index idx_baterias_gama       on baterias (gama);
create index idx_baterias_precio     on baterias (precio);
create index idx_baterias_scraped_at on baterias (scraped_at desc);
create index idx_baterias_amperaje   on baterias (amperaje);

-- Vista: última versión de cada producto por URL
create or replace view baterias_actuales as
select distinct on (url)
  id, tienda, nombre, gama, amperaje, grupo,
  garantia_meses, precio, precio_original,
  url, imagen_url, disponible, scraped_at
from baterias
where disponible = true
order by url, scraped_at desc;

-- Tabla de historial de scraping (logs)
create table if not exists scraping_logs (
  id          bigserial primary key,
  tienda      store_type    not null,
  status      text          not null,  -- 'success' | 'error' | 'partial'
  productos   integer       default 0,
  mensaje     text,
  ejecutado_at timestamptz  not null default now()
);

-- Row Level Security (RLS): solo lectura pública
alter table baterias enable row level security;
alter table scraping_logs enable row level security;

create policy "baterias_public_read"
  on baterias for select using (true);

create policy "scraping_logs_public_read"
  on scraping_logs for select using (true);

-- ============================================================
-- pg_cron: ejecutar scraper cada 6 horas
-- Ajustar la URL de tu proyecto Supabase antes de ejecutar
-- ============================================================
/*
select cron.schedule(
  'battery-scraper',
  '0 */6 * * *',
  $$
    select net.http_post(
      url := 'https://TU_PROYECTO.supabase.co/functions/v1/battery-scraper',
      headers := '{"Authorization": "Bearer TU_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
*/
