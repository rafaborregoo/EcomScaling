-- Mi Camino / panel de consultor: catalogo editable de "tipos de objetivo".
--
-- Hasta ahora el catalogo de objetivos era cerrado y hardcodeado en
-- strategic-plans.ts (OBJECTIVE_CATALOG, 8 metricas de Shopify/Meta). El
-- consultor pidio poder crear sus propios tipos: unos medidos con las
-- metricas que ya recogemos de las plataformas, otros de valor manual que
-- el mismo introduce. Un tipo puede ser para toda su cartera
-- (organization_id null) o para un cliente concreto.
--
-- El valor objetivo por cliente sigue viviendo en organization_metric_targets
-- (alta 1 a 1 desde Mi Camino, sin cambios). Aqui solo se define el "tipo".
--
-- Insert/update/delete solo via API (service client) con frontera de rol
-- consultor/platform_admin; el select por RLS lo hace el propio dueno (el
-- panel de /consultor). Mi Camino resuelve que tipos aplican a un cliente
-- server-side con service client, tras comprobar membership.

create table if not exists public.objective_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  slug varchar(80) not null,
  label varchar(120) not null,
  unit varchar(12) not null,
  direction varchar(4) not null default 'up',
  source varchar(12) not null,
  metric_key varchar(80),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint objective_definitions_unit_values
    check (unit in ('money', 'pct', 'count', 'ratio', 'number')),
  constraint objective_definitions_direction_values
    check (direction in ('up', 'down')),
  constraint objective_definitions_source_values
    check (source in ('shopify', 'meta', 'manual')),
  -- source de plataforma exige la metrica que alimenta el "actual";
  -- source manual nunca la lleva.
  constraint objective_definitions_metric_key_shape
    check (
      (source = 'manual' and metric_key is null)
      or (source in ('shopify', 'meta') and metric_key is not null)
    ),
  constraint objective_definitions_unique_slug
    unique (owner_user_id, organization_id, slug)
);

create index if not exists objective_definitions_owner_idx on public.objective_definitions (owner_user_id)
  where archived_at is null;
create index if not exists objective_definitions_org_idx on public.objective_definitions (organization_id)
  where archived_at is null;

drop trigger if exists set_objective_definitions_updated_at on public.objective_definitions;
create trigger set_objective_definitions_updated_at
before update on public.objective_definitions
for each row execute function private.set_updated_at();

alter table public.objective_definitions enable row level security;

drop policy if exists "objective_definitions_select_owner_or_admin" on public.objective_definitions;
create policy "objective_definitions_select_owner_or_admin" on public.objective_definitions for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or private.is_platform_admin()
);

grant select on public.objective_definitions to authenticated;

comment on table public.objective_definitions is
  'Tipos de objetivo definidos por un consultor: de metrica de plataforma (source shopify/meta + metric_key) o de valor manual. organization_id null = toda la cartera del consultor. Write solo via API service role; el valor objetivo por cliente vive en organization_metric_targets.';

-- Valor "actual" para objetivos de tipo manual, introducido a mano desde la
-- card del objetivo en Mi Camino. Una sola lectura vigente por objetivo
-- (ponytail: sin historico, anadir tabla de lecturas si se pide seguimiento).
alter table public.organization_metric_targets
  add column if not exists manual_actual_value numeric(14, 2),
  add column if not exists manual_actual_at timestamptz;

comment on column public.organization_metric_targets.manual_actual_value is
  'Ultimo valor real introducido a mano para objetivos de tipo manual (objective_definitions.source = manual). Null para objetivos medidos por metrica de plataforma.';
