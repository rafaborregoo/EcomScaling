-- Benchmarks sectoriales para el analista de métricas (ADR-0027, niveles 5 y 6
-- de la jerarquía del corpus 6.00: "benchmark sectorial" y "benchmark ecommerce
-- general"). Son la última referencia: solo se usan si la tienda no tiene
-- umbral económico, objetivo ni historial, y nunca pueden dar "mal".
--
-- Tabla y no documento del RAG: una cifra tiene que recuperarse exacta, con su
-- fuente y su fecha; la búsqueda semántica devuelve "algo parecido". Cómo se
-- rellena: docs/PLANTILLA_BENCHMARKS_SECTORIALES.md. Idempotente.

create table if not exists public.metric_benchmarks (
  id uuid primary key default gen_random_uuid(),
  -- Id de la ficha en METRIC_SPECS (packages/contracts/src/metric-analyst.ts).
  metric_id text not null,
  -- 'general' = ecommerce en general; si no, el sector de organizations.sector.
  sector text not null default 'general',
  country text not null default 'ES',
  -- Percentiles en la unidad del valor de la métrica: ratio (MER/ROAS 3.2),
  -- tasa en 0-1 (conversión 0.021) o importe en la moneda indicada (CAC).
  p25 numeric not null,
  p50 numeric not null,
  p75 numeric not null,
  currency text,
  source text not null,
  source_url text,
  -- Fecha de los datos, no de la carga: un benchmark de 2022 no vale igual.
  as_of date not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint metric_benchmarks_percentiles_ordered check (p25 <= p50 and p50 <= p75),
  constraint metric_benchmarks_unique unique (metric_id, sector, country, as_of, source)
);

alter table public.metric_benchmarks enable row level security;

drop policy if exists metric_benchmarks_select on public.metric_benchmarks;
create policy metric_benchmarks_select on public.metric_benchmarks
  for select to authenticated using (true);

comment on table public.metric_benchmarks is
  'Referencias externas por métrica y sector (nivel 5-6 del corpus 6.00). Solo lectura para authenticated; se cargan con service role.';

-- Sector de la tienda para elegir benchmark. Null = se usa 'general'.
alter table public.organizations add column if not exists sector text;
