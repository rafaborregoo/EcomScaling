-- ---------------------------------------------------------------------------
-- F8: efecto de negocio de cada intervencion
-- ---------------------------------------------------------------------------
--
-- F8 cerraba intervenciones sabiendo si se ejecutaron, no si movieron el
-- negocio, y por eso F9 esperaba evidencia en casi todos sus bloques. Aqui el
-- consultor declara que metrica deberia mover cada intervencion cerrada y hacia
-- donde; el motor `intervention-effect` (cadena nocturna) mide las 4 semanas
-- previas al arranque contra las siguientes y escribe el resultado en la misma
-- fila. F9 lo lee como `observed_effect`.

create table if not exists public.intervention_effects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null = la organizacion entera (todas sus tiendas sumadas).
  store_id uuid references public.shopify_stores (id) on delete cascade,
  intervention_id varchar(200) not null,

  metric varchar(40) not null,
  expected_direction varchar(8) not null,
  started_at timestamptz not null,
  declared_by uuid references public.profiles (id) on delete set null,
  declared_at timestamptz not null default now(),

  baseline_value numeric,
  observed_value numeric,
  change_relative numeric,
  observed_direction varchar(8),
  material boolean not null default false,
  sample_sufficient boolean not null default false,
  pre_days integer not null default 0,
  post_days integer not null default 0,
  maturity varchar(10),
  measured_at timestamptz,

  constraint intervention_effects_unica unique (organization_id, intervention_id),
  constraint intervention_effects_metrica check (
    metric in ('net_sales', 'orders_count', 'average_order_value', 'sessions', 'conversion_rate')
  ),
  constraint intervention_effects_esperada check (expected_direction in ('up', 'down')),
  constraint intervention_effects_observada check (
    observed_direction is null or observed_direction in ('up', 'down', 'flat')
  ),
  constraint intervention_effects_madurez check (
    maturity is null or maturity in ('EARLY', 'INTERIM', 'MATURE')
  )
);

comment on table public.intervention_effects is
  'F8: metrica objetivo que declara el consultor para una intervencion cerrada y su efecto medido (4 semanas antes contra despues del arranque). Antes/despues, no experimento: no separa la intervencion de la estacionalidad.';

create index if not exists intervention_effects_org_idx
  on public.intervention_effects (organization_id);

alter table public.intervention_effects enable row level security;

drop policy if exists "intervention_effects_select_staff" on public.intervention_effects;
create policy "intervention_effects_select_staff" on public.intervention_effects
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

grant select on public.intervention_effects to authenticated;
